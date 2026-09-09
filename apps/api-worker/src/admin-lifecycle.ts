import type {
  AdminInventoryAdjustInput,
  AdminOrderTransitionInput,
  AdminProductUpdateInput,
  AdminPromotionUpdateInput,
  AdminReturnTransitionInput,
  AdminReviewModerationInput,
  ApiFailure,
  ApiSuccess,
} from '@beeecom/contracts';
import {
  inventoryState,
  type Customer,
  type Order,
  type Product,
  type Promotion,
  type ReturnRequest,
  type Review,
} from '@beeecom/domain';

interface D1Result<T = unknown> { results: T[]; success: boolean }
interface D1PreparedStatement {
  bind(...values: Array<string | number | null>): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = unknown>(): Promise<D1Result<T>>;
}
interface D1Database { prepare(query: string): D1PreparedStatement }
export interface AdminLifecycleEnv { DB: D1Database; DEFAULT_SCENARIO?: string; CORS_ORIGINS?: string }
interface RequestContext { requestId: string; scenario: string }

function allowedOrigin(request: Request, env: AdminLifecycleEnv): string | null {
  const origin = request.headers.get('origin');
  if (!origin) return null;
  const configured = (env.CORS_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  return configured.includes('*') || configured.includes(origin) ? origin : null;
}
function headers(request: Request, env: AdminLifecycleEnv): Headers {
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
async function context(env: AdminLifecycleEnv): Promise<RequestContext> {
  const row = await env.DB.prepare('SELECT scenario FROM demo_state WHERE id = 1').first<{ scenario: string }>();
  return { requestId: crypto.randomUUID(), scenario: row?.scenario ?? env.DEFAULT_SCENARIO ?? 'healthy' };
}
async function ok<T>(request: Request, env: AdminLifecycleEnv, data: T, status = 200): Promise<Response> {
  const payload: ApiSuccess<T> = { ok: true, data, meta: await context(env) };
  return new Response(JSON.stringify(payload), { status, headers: headers(request, env) });
}
async function fail(request: Request, env: AdminLifecycleEnv, status: number, code: string, message: string): Promise<Response> {
  const payload: ApiFailure = { ok: false, error: { code, message }, meta: await context(env) };
  return new Response(JSON.stringify(payload), { status, headers: headers(request, env) });
}
function parse<T>(value: string): T { return JSON.parse(value) as T }
async function rowById<T>(env: AdminLifecycleEnv, table: string, id: string): Promise<T | null> {
  const row = await env.DB.prepare(`SELECT data_json FROM ${table} WHERE id = ?`).bind(id).first<{ data_json: string }>();
  return row ? parse<T>(row.data_json) : null;
}

async function updateProduct(request: Request, env: AdminLifecycleEnv, id: string, input: AdminProductUpdateInput): Promise<Response> {
  const product = await rowById<Product>(env, 'products', id);
  if (!product) return fail(request, env, 404, 'PRODUCT_NOT_FOUND', 'Product was not found.');
  const title = input.title?.trim();
  const description = input.description?.trim();
  if (input.title !== undefined && !title) return fail(request, env, 400, 'INVALID_PRODUCT_TITLE', 'Product title cannot be empty.');
  if (input.description !== undefined && !description) return fail(request, env, 400, 'INVALID_PRODUCT_DESCRIPTION', 'Product description cannot be empty.');
  const updated: Product = {
    ...product,
    ...(title ? { title } : {}),
    ...(input.subtitle !== undefined ? { subtitle: input.subtitle.trim() || undefined } : {}),
    ...(description ? { description } : {}),
    ...(input.featured !== undefined ? { featured: input.featured } : {}),
    ...(input.tags !== undefined ? { tags: [...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean))] } : {}),
    updatedAt: new Date().toISOString(),
  };
  await env.DB.prepare('UPDATE products SET title = ?, featured = ?, data_json = ? WHERE id = ?')
    .bind(updated.title, updated.featured ? 1 : 0, JSON.stringify(updated), id).run();
  return ok(request, env, updated);
}

async function adjustInventory(request: Request, env: AdminLifecycleEnv, id: string, input: AdminInventoryAdjustInput): Promise<Response> {
  if (!input.variantId || !Number.isInteger(input.adjustment) || input.adjustment === 0 || !input.reason.trim()) {
    return fail(request, env, 400, 'INVALID_INVENTORY_ADJUSTMENT', 'variantId, non-zero integer adjustment and reason are required.');
  }
  const product = await rowById<Product>(env, 'products', id);
  if (!product) return fail(request, env, 404, 'PRODUCT_NOT_FOUND', 'Product was not found.');
  const variant = product.variants.find((item) => item.id === input.variantId);
  if (!variant) return fail(request, env, 404, 'VARIANT_NOT_FOUND', 'Variant was not found on this product.');
  const nextQuantity = variant.inventoryQuantity + input.adjustment;
  if (nextQuantity < 0) return fail(request, env, 409, 'NEGATIVE_INVENTORY', 'Inventory adjustment would make stock negative.');
  const updated: Product = {
    ...product,
    variants: product.variants.map((item) => item.id === variant.id
      ? { ...item, inventoryQuantity: nextQuantity, inventoryState: inventoryState(nextQuantity) }
      : item),
    updatedAt: new Date().toISOString(),
  };
  await env.DB.prepare('UPDATE products SET data_json = ? WHERE id = ?').bind(JSON.stringify(updated), id).run();
  return ok(request, env, updated);
}

async function updatePromotion(request: Request, env: AdminLifecycleEnv, id: string, input: AdminPromotionUpdateInput): Promise<Response> {
  const promotion = await rowById<Promotion>(env, 'promotions', id);
  if (!promotion) return fail(request, env, 404, 'PROMOTION_NOT_FOUND', 'Promotion was not found.');
  const startsAt = input.startsAt ?? promotion.startsAt;
  const endsAt = input.endsAt ?? promotion.endsAt;
  if (Number.isNaN(Date.parse(startsAt)) || Number.isNaN(Date.parse(endsAt)) || Date.parse(startsAt) >= Date.parse(endsAt)) {
    return fail(request, env, 400, 'INVALID_PROMOTION_WINDOW', 'Promotion start must be before end.');
  }
  const updated: Promotion = {
    ...promotion,
    ...(input.title !== undefined ? { title: input.title.trim() || promotion.title } : {}),
    ...(input.description !== undefined ? { description: input.description.trim() || promotion.description } : {}),
    ...(input.active !== undefined ? { active: input.active } : {}),
    startsAt,
    endsAt,
  };
  await env.DB.prepare('UPDATE promotions SET active = ?, data_json = ? WHERE id = ?')
    .bind(updated.active ? 1 : 0, JSON.stringify(updated), id).run();
  return ok(request, env, updated);
}

function transitionOrder(order: Order, input: AdminOrderTransitionInput): Order | string {
  const now = new Date().toISOString();
  switch (input.action) {
    case 'process':
      if (order.state !== 'placed' || order.fulfillmentState !== 'unfulfilled') return 'ORDER_CANNOT_PROCESS';
      return { ...order, fulfillmentState: 'processing', updatedAt: now };
    case 'ship':
      if (order.fulfillmentState !== 'processing') return 'ORDER_CANNOT_SHIP';
      return { ...order, fulfillmentState: 'shipped', updatedAt: now };
    case 'deliver':
      if (order.fulfillmentState !== 'shipped') return 'ORDER_CANNOT_DELIVER';
      return { ...order, fulfillmentState: 'delivered', state: 'completed', updatedAt: now };
    case 'cancel':
      if (order.state !== 'placed' || !['unfulfilled', 'processing'].includes(order.fulfillmentState)) return 'ORDER_CANNOT_CANCEL';
      return { ...order, state: 'cancelled', fulfillmentState: 'cancelled', updatedAt: now };
    case 'refund':
      if (order.paymentState !== 'paid') return 'ORDER_CANNOT_REFUND';
      return { ...order, paymentState: 'refunded', updatedAt: now };
  }
}
async function updateOrder(request: Request, env: AdminLifecycleEnv, id: string, input: AdminOrderTransitionInput): Promise<Response> {
  const order = await rowById<Order>(env, 'orders', id);
  if (!order) return fail(request, env, 404, 'ORDER_NOT_FOUND', 'Order was not found.');
  const transitioned = transitionOrder(order, input);
  if (typeof transitioned === 'string') return fail(request, env, 409, transitioned, 'Order transition is not allowed from the current state.');
  await env.DB.prepare('UPDATE orders SET data_json = ? WHERE id = ?').bind(JSON.stringify(transitioned), id).run();
  return ok(request, env, transitioned);
}

async function listJson<T>(env: AdminLifecycleEnv, table: string, orderBy: string): Promise<T[]> {
  const rows = await env.DB.prepare(`SELECT data_json FROM ${table} ORDER BY ${orderBy}`).all<{ data_json: string }>();
  return rows.results.map((row) => parse<T>(row.data_json));
}

async function updateReturn(request: Request, env: AdminLifecycleEnv, id: string, input: AdminReturnTransitionInput): Promise<Response> {
  const item = await rowById<ReturnRequest>(env, 'returns', id);
  if (!item) return fail(request, env, 404, 'RETURN_NOT_FOUND', 'Return request was not found.');
  let nextState: ReturnRequest['state'];
  if (input.action === 'approve' && item.state === 'requested') nextState = 'approved';
  else if (input.action === 'reject' && item.state === 'requested') nextState = 'rejected';
  else if (input.action === 'refund' && item.state === 'approved') nextState = 'refunded';
  else return fail(request, env, 409, 'RETURN_TRANSITION_NOT_ALLOWED', 'Return transition is not allowed from the current state.');
  const updated: ReturnRequest = { ...item, state: nextState, updatedAt: new Date().toISOString() };
  await env.DB.prepare('UPDATE returns SET updated_at = ?, data_json = ? WHERE id = ?')
    .bind(updated.updatedAt, JSON.stringify(updated), id).run();
  if (nextState === 'refunded') {
    const order = await rowById<Order>(env, 'orders', item.orderId);
    if (order?.paymentState === 'paid') {
      const refunded: Order = { ...order, paymentState: 'refunded', updatedAt: updated.updatedAt };
      await env.DB.prepare('UPDATE orders SET data_json = ? WHERE id = ?').bind(JSON.stringify(refunded), order.id).run();
    }
  }
  return ok(request, env, updated);
}

async function moderateReview(request: Request, env: AdminLifecycleEnv, id: string, input: AdminReviewModerationInput): Promise<Response> {
  const review = await rowById<Review>(env, 'reviews', id);
  if (!review) return fail(request, env, 404, 'REVIEW_NOT_FOUND', 'Review was not found.');
  if (input.status !== 'published' && input.status !== 'rejected') return fail(request, env, 400, 'INVALID_REVIEW_STATUS', 'Review status must be published or rejected.');
  const updated: Review = { ...review, status: input.status };
  await env.DB.prepare('UPDATE reviews SET data_json = ? WHERE id = ?').bind(JSON.stringify(updated), id).run();
  return ok(request, env, updated);
}

export async function handleAdminLifecycle(request: Request, env: AdminLifecycleEnv): Promise<Response | null> {
  const path = new URL(request.url).pathname.replace(/\/$/, '') || '/';

  const product = path.match(/^\/api\/v1\/admin\/products\/([^/]+)$/);
  if (request.method === 'PATCH' && product) {
    const body = await request.json().catch(() => null) as AdminProductUpdateInput | null;
    return body ? updateProduct(request, env, decodeURIComponent(product[1]!), body) : fail(request, env, 400, 'INVALID_PRODUCT_UPDATE', 'Product update body is required.');
  }
  const inventory = path.match(/^\/api\/v1\/admin\/products\/([^/]+)\/inventory-adjustments$/);
  if (request.method === 'POST' && inventory) {
    const body = await request.json().catch(() => null) as AdminInventoryAdjustInput | null;
    return body ? adjustInventory(request, env, decodeURIComponent(inventory[1]!), body) : fail(request, env, 400, 'INVALID_INVENTORY_ADJUSTMENT', 'Adjustment body is required.');
  }
  const promotion = path.match(/^\/api\/v1\/admin\/promotions\/([^/]+)$/);
  if (request.method === 'PATCH' && promotion) {
    const body = await request.json().catch(() => null) as AdminPromotionUpdateInput | null;
    return body ? updatePromotion(request, env, decodeURIComponent(promotion[1]!), body) : fail(request, env, 400, 'INVALID_PROMOTION_UPDATE', 'Promotion update body is required.');
  }
  const order = path.match(/^\/api\/v1\/admin\/orders\/([^/]+)$/);
  if (request.method === 'PATCH' && order) {
    const body = await request.json().catch(() => null) as AdminOrderTransitionInput | null;
    if (!body || !['process','ship','deliver','cancel','refund'].includes(body.action)) return fail(request, env, 400, 'INVALID_ORDER_ACTION', 'A supported order action is required.');
    return updateOrder(request, env, decodeURIComponent(order[1]!), body);
  }
  if (request.method === 'GET' && path === '/api/v1/admin/customers') return ok(request, env, await listJson<Customer>(env, 'customers', 'email ASC'));
  if (request.method === 'GET' && path === '/api/v1/admin/returns') return ok(request, env, await listJson<ReturnRequest>(env, 'returns', 'updated_at DESC'));
  const returnMatch = path.match(/^\/api\/v1\/admin\/returns\/([^/]+)$/);
  if (request.method === 'PATCH' && returnMatch) {
    const body = await request.json().catch(() => null) as AdminReturnTransitionInput | null;
    if (!body || !['approve','reject','refund'].includes(body.action)) return fail(request, env, 400, 'INVALID_RETURN_ACTION', 'A supported return action is required.');
    return updateReturn(request, env, decodeURIComponent(returnMatch[1]!), body);
  }
  if (request.method === 'GET' && path === '/api/v1/admin/reviews') return ok(request, env, await listJson<Review>(env, 'reviews', 'created_at DESC'));
  const reviewMatch = path.match(/^\/api\/v1\/admin\/reviews\/([^/]+)$/);
  if (request.method === 'PATCH' && reviewMatch) {
    const body = await request.json().catch(() => null) as AdminReviewModerationInput | null;
    return body ? moderateReview(request, env, decodeURIComponent(reviewMatch[1]!), body) : fail(request, env, 400, 'INVALID_REVIEW_UPDATE', 'Review moderation body is required.');
  }
  return null;
}
