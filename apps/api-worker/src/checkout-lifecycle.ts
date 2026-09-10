import type { ApiFailure, ApiSuccess, CheckoutInput } from '@beeecom/contracts';
import {
  calculateCartTotals,
  type Cart,
  type Customer,
  type Order,
  type OrderLine,
  type PaymentMethod,
  type Product,
  type Promotion,
  type ShippingMethod,
} from '@beeecom/domain';

interface D1Result<T = unknown> { results: T[]; success: boolean }
interface D1PreparedStatement {
  bind(...values: Array<string | number | null>): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = unknown>(): Promise<D1Result<T>>;
}
interface D1Database { prepare(query: string): D1PreparedStatement }
export interface CheckoutLifecycleEnv { DB: D1Database; DEFAULT_SCENARIO?: string; CORS_ORIGINS?: string }
interface RequestContext { requestId: string; scenario: string }

const SHIPPING_AMOUNT: Record<ShippingMethod, number> = {
  standard: 900,
  express: 1800,
};

function allowedOrigin(request: Request, env: CheckoutLifecycleEnv): string | null {
  const origin = request.headers.get('origin');
  if (!origin) return null;
  const configured = (env.CORS_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  return configured.includes('*') || configured.includes(origin) ? origin : null;
}
function headers(request: Request, env: CheckoutLifecycleEnv): Headers {
  const result = new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  const origin = allowedOrigin(request, env);
  if (origin) {
    result.set('access-control-allow-origin', origin);
    result.set('vary', 'origin');
    result.set('access-control-allow-headers', 'authorization, content-type, x-demo-reset-token');
    result.set('access-control-allow-methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  }
  return result;
}
async function context(env: CheckoutLifecycleEnv): Promise<RequestContext> {
  const row = await env.DB.prepare('SELECT scenario FROM demo_state WHERE id = 1').first<{ scenario: string }>();
  return { requestId: crypto.randomUUID(), scenario: row?.scenario ?? env.DEFAULT_SCENARIO ?? 'healthy' };
}
async function ok<T>(request: Request, env: CheckoutLifecycleEnv, data: T, status = 200): Promise<Response> {
  const payload: ApiSuccess<T> = { ok: true, data, meta: await context(env) };
  return new Response(JSON.stringify(payload), { status, headers: headers(request, env) });
}
async function fail(request: Request, env: CheckoutLifecycleEnv, status: number, code: string, message: string): Promise<Response> {
  const payload: ApiFailure = { ok: false, error: { code, message }, meta: await context(env) };
  return new Response(JSON.stringify(payload), { status, headers: headers(request, env) });
}
function parse<T>(value: string): T { return JSON.parse(value) as T }
async function rowById<T>(env: CheckoutLifecycleEnv, table: string, id: string): Promise<T | null> {
  const row = await env.DB.prepare(`SELECT data_json FROM ${table} WHERE id = ?`).bind(id).first<{ data_json: string }>();
  return row ? parse<T>(row.data_json) : null;
}

async function listPromotions(env: CheckoutLifecycleEnv): Promise<Promotion[]> {
  const rows = await env.DB.prepare('SELECT data_json FROM promotions ORDER BY active DESC, code ASC').all<{ data_json: string }>();
  return rows.results.map((row) => parse<Promotion>(row.data_json));
}

function supportedShipping(value: unknown): value is ShippingMethod {
  return value === 'standard' || value === 'express';
}
function supportedPayment(value: unknown): value is PaymentMethod {
  return value === 'card' || value === 'wallet';
}

async function submitCheckout(request: Request, env: CheckoutLifecycleEnv, input: CheckoutInput): Promise<Response> {
  if (!input.cartId || !input.addressId) {
    return fail(request, env, 400, 'INVALID_CHECKOUT', 'Cart and delivery address are required.');
  }
  if (input.shippingMethod !== undefined && !supportedShipping(input.shippingMethod)) {
    return fail(request, env, 400, 'INVALID_SHIPPING_METHOD', 'A supported shipping method is required.');
  }
  if (input.paymentMethod !== undefined && !supportedPayment(input.paymentMethod)) {
    return fail(request, env, 400, 'INVALID_PAYMENT_METHOD', 'A supported payment method is required.');
  }
  if (input.paymentScenario !== undefined && input.paymentScenario !== 'success' && input.paymentScenario !== 'failure') {
    return fail(request, env, 400, 'INVALID_PAYMENT_SCENARIO', 'A supported payment outcome is required.');
  }

  const cart = await rowById<Cart>(env, 'carts', input.cartId);
  if (!cart) return fail(request, env, 404, 'CART_NOT_FOUND', 'Cart was not found.');
  if (cart.lines.length === 0) return fail(request, env, 409, 'CART_EMPTY', 'Your cart is empty.');

  const customer = await rowById<Customer>(env, 'customers', cart.customerId);
  if (!customer) return fail(request, env, 404, 'CUSTOMER_NOT_FOUND', 'Customer was not found.');
  const address = customer.addresses.find((item) => item.id === input.addressId);
  if (!address) return fail(request, env, 404, 'ADDRESS_NOT_FOUND', 'Delivery address was not found for this customer.');

  const productRows = await env.DB.prepare('SELECT data_json FROM products').all<{ data_json: string }>();
  const productMap = new Map(productRows.results.map((row) => {
    const product = parse<Product>(row.data_json);
    return [product.id, product] as const;
  }));

  const lines: OrderLine[] = [];
  for (const line of cart.lines) {
    const product = productMap.get(line.productId);
    const variant = product?.variants.find((item) => item.id === line.variantId);
    if (!product || !variant) return fail(request, env, 404, 'VARIANT_NOT_FOUND', 'A cart variant is no longer available.');
    if (line.quantity > variant.inventoryQuantity) return fail(request, env, 409, 'INSUFFICIENT_STOCK', 'A cart item no longer has enough inventory.');
    lines.push({
      id: `orderline-${crypto.randomUUID()}`,
      productId: product.id,
      variantId: variant.id,
      title: product.title,
      variantTitle: variant.title,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    });
  }

  const shippingMethod = input.shippingMethod ?? 'standard';
  const paymentMethod = input.paymentMethod ?? 'card';
  const promotions = await listPromotions(env);
  const promotion = cart.couponCode ? promotions.find((item) => item.active && item.code === cart.couponCode) : undefined;
  const totals = calculateCartTotals(cart, promotion, SHIPPING_AMOUNT[shippingMethod]);
  const current = await context(env);
  const paymentFails = input.paymentScenario === 'failure' || current.scenario === 'payment-failed';
  const placedAt = new Date().toISOString();
  const id = `order-${crypto.randomUUID()}`;
  const order: Order = {
    id,
    number: `#D-${id.slice(-8).toUpperCase()}`,
    customerId: customer.id,
    lines,
    ...totals,
    state: 'placed',
    paymentState: paymentFails ? 'failed' : 'paid',
    fulfillmentState: 'unfulfilled',
    shippingAddress: address,
    shippingMethod,
    paymentMethod,
    placedAt,
    updatedAt: placedAt,
  };

  await env.DB.prepare('INSERT INTO orders (id, number, customer_id, placed_at, data_json) VALUES (?, ?, ?, ?, ?)')
    .bind(order.id, order.number, order.customerId, order.placedAt, JSON.stringify(order))
    .run();

  if (!paymentFails) {
    const emptied: Cart = { id: cart.id, customerId: cart.customerId, lines: [], updatedAt: placedAt };
    await env.DB.prepare('UPDATE carts SET customer_id = ?, data_json = ? WHERE id = ?')
      .bind(emptied.customerId, JSON.stringify(emptied), emptied.id)
      .run();
  }

  return ok(request, env, order, 201);
}

export async function handleCheckoutLifecycle(request: Request, env: CheckoutLifecycleEnv): Promise<Response | null> {
  const path = new URL(request.url).pathname.replace(/\/$/, '') || '/';
  if (request.method !== 'POST' || path !== '/api/v1/checkout') return null;
  const body = await request.json().catch(() => null) as CheckoutInput | null;
  if (!body) return fail(request, env, 400, 'INVALID_CHECKOUT', 'Checkout request body is required.');
  return submitCheckout(request, env, body);
}
