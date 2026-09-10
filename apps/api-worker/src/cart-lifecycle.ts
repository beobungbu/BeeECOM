import type { ApiFailure, ApiSuccess, CartUpdateLineInput } from '@beeecom/contracts';
import type { Cart, Product } from '@beeecom/domain';

interface D1Result<T = unknown> { results: T[]; success: boolean }
interface D1PreparedStatement {
  bind(...values: Array<string | number | null>): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = unknown>(): Promise<D1Result<T>>;
}
interface D1Database { prepare(query: string): D1PreparedStatement }
export interface CartLifecycleEnv { DB: D1Database; DEFAULT_SCENARIO?: string; CORS_ORIGINS?: string }
interface RequestContext { requestId: string; scenario: string }

function allowedOrigin(request: Request, env: CartLifecycleEnv): string | null {
  const origin = request.headers.get('origin');
  if (!origin) return null;
  const configured = (env.CORS_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  return configured.includes('*') || configured.includes(origin) ? origin : null;
}
function headers(request: Request, env: CartLifecycleEnv): Headers {
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
async function context(env: CartLifecycleEnv): Promise<RequestContext> {
  const row = await env.DB.prepare('SELECT scenario FROM demo_state WHERE id = 1').first<{ scenario: string }>();
  return { requestId: crypto.randomUUID(), scenario: row?.scenario ?? env.DEFAULT_SCENARIO ?? 'healthy' };
}
async function ok<T>(request: Request, env: CartLifecycleEnv, data: T, status = 200): Promise<Response> {
  const payload: ApiSuccess<T> = { ok: true, data, meta: await context(env) };
  return new Response(JSON.stringify(payload), { status, headers: headers(request, env) });
}
async function fail(request: Request, env: CartLifecycleEnv, status: number, code: string, message: string): Promise<Response> {
  const payload: ApiFailure = { ok: false, error: { code, message }, meta: await context(env) };
  return new Response(JSON.stringify(payload), { status, headers: headers(request, env) });
}
function parse<T>(value: string): T { return JSON.parse(value) as T }
async function rowById<T>(env: CartLifecycleEnv, table: string, id: string): Promise<T | null> {
  const row = await env.DB.prepare(`SELECT data_json FROM ${table} WHERE id = ?`).bind(id).first<{ data_json: string }>();
  return row ? parse<T>(row.data_json) : null;
}
async function persistCart(env: CartLifecycleEnv, cart: Cart): Promise<void> {
  await env.DB.prepare('UPDATE carts SET customer_id = ?, data_json = ? WHERE id = ?')
    .bind(cart.customerId, JSON.stringify(cart), cart.id)
    .run();
}

async function updateLine(
  request: Request,
  env: CartLifecycleEnv,
  cartId: string,
  lineId: string,
  input: CartUpdateLineInput,
): Promise<Response> {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    return fail(request, env, 400, 'INVALID_QUANTITY', 'Cart line quantity must be a positive integer.');
  }

  const cart = await rowById<Cart>(env, 'carts', cartId);
  if (!cart) return fail(request, env, 404, 'CART_NOT_FOUND', 'Cart was not found.');
  const line = cart.lines.find((item) => item.id === lineId);
  if (!line) return fail(request, env, 404, 'CART_LINE_NOT_FOUND', 'Cart line was not found.');

  const product = await rowById<Product>(env, 'products', line.productId);
  const variant = product?.variants.find((item) => item.id === line.variantId);
  if (!product || !variant) return fail(request, env, 404, 'VARIANT_NOT_FOUND', 'Cart line variant was not found.');
  if (input.quantity > variant.inventoryQuantity) {
    return fail(request, env, 409, 'INSUFFICIENT_STOCK', 'Requested quantity exceeds available inventory.');
  }

  const updated: Cart = {
    ...cart,
    lines: cart.lines.map((item) => item.id === lineId ? { ...item, quantity: input.quantity } : item),
    updatedAt: new Date().toISOString(),
  };
  await persistCart(env, updated);
  return ok(request, env, updated);
}

async function removeLine(request: Request, env: CartLifecycleEnv, cartId: string, lineId: string): Promise<Response> {
  const cart = await rowById<Cart>(env, 'carts', cartId);
  if (!cart) return fail(request, env, 404, 'CART_NOT_FOUND', 'Cart was not found.');
  if (!cart.lines.some((item) => item.id === lineId)) {
    return fail(request, env, 404, 'CART_LINE_NOT_FOUND', 'Cart line was not found.');
  }

  const updated: Cart = {
    ...cart,
    lines: cart.lines.filter((item) => item.id !== lineId),
    updatedAt: new Date().toISOString(),
  };
  await persistCart(env, updated);
  return ok(request, env, updated);
}

export async function handleCartLifecycle(request: Request, env: CartLifecycleEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, '') || '/';
  const match = path.match(/^\/api\/v1\/cart\/([^/]+)\/lines\/([^/]+)$/);
  if (!match) return null;

  const cartId = decodeURIComponent(match[1]!);
  const lineId = decodeURIComponent(match[2]!);
  if (request.method === 'PATCH') {
    const body = await request.json().catch(() => null) as CartUpdateLineInput | null;
    if (!body || body.quantity === undefined) {
      return fail(request, env, 400, 'INVALID_CART_LINE', 'quantity is required.');
    }
    return updateLine(request, env, cartId, lineId, body);
  }
  if (request.method === 'DELETE') return removeLine(request, env, cartId, lineId);
  return null;
}
