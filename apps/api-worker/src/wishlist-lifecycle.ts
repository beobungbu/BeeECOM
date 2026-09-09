import type { ApiFailure, ApiSuccess, WishlistAddItemInput } from '@beeecom/contracts';
import type { Wishlist } from '@beeecom/domain';

interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
}

interface D1PreparedStatement {
  bind(...values: Array<string | number | null>): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export interface WishlistLifecycleEnv {
  DB: D1Database;
  DEFAULT_SCENARIO?: string;
  CORS_ORIGINS?: string;
}

interface RequestContext {
  requestId: string;
  scenario: string;
}

function allowedOrigin(request: Request, env: WishlistLifecycleEnv): string | null {
  const origin = request.headers.get('origin');
  if (!origin) return null;
  const configured = (env.CORS_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  if (configured.includes('*') || configured.includes(origin)) return origin;
  return null;
}

function responseHeaders(request: Request, env: WishlistLifecycleEnv): Headers {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  const origin = allowedOrigin(request, env);
  if (origin) {
    headers.set('access-control-allow-origin', origin);
    headers.set('vary', 'origin');
    headers.set('access-control-allow-headers', 'authorization, content-type, x-demo-reset-token');
    headers.set('access-control-allow-methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  }
  return headers;
}

async function context(env: WishlistLifecycleEnv): Promise<RequestContext> {
  const row = await env.DB.prepare('SELECT scenario FROM demo_state WHERE id = 1').first<{ scenario: string }>();
  return {
    requestId: crypto.randomUUID(),
    scenario: row?.scenario ?? env.DEFAULT_SCENARIO ?? 'healthy',
  };
}

async function ok<T>(request: Request, env: WishlistLifecycleEnv, data: T, status = 200): Promise<Response> {
  const payload: ApiSuccess<T> = { ok: true, data, meta: await context(env) };
  return new Response(JSON.stringify(payload), { status, headers: responseHeaders(request, env) });
}

async function fail(
  request: Request,
  env: WishlistLifecycleEnv,
  status: number,
  code: string,
  message: string,
): Promise<Response> {
  const payload: ApiFailure = { ok: false, error: { code, message }, meta: await context(env) };
  return new Response(JSON.stringify(payload), { status, headers: responseHeaders(request, env) });
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

async function ensureCustomer(env: WishlistLifecycleEnv, customerId: string): Promise<boolean> {
  return Boolean(await env.DB.prepare('SELECT id FROM customers WHERE id = ?').bind(customerId).first<{ id: string }>());
}

async function ensureWishlist(env: WishlistLifecycleEnv, customerId: string): Promise<Wishlist | null> {
  if (!(await ensureCustomer(env, customerId))) return null;
  const existing = await env.DB.prepare('SELECT data_json FROM wishlists WHERE customer_id = ?')
    .bind(customerId)
    .first<{ data_json: string }>();
  if (existing) return parseJson<Wishlist>(existing.data_json);

  const [seedState, featured] = await Promise.all([
    env.DB.prepare('SELECT seeded_at FROM demo_state WHERE id = 1').first<{ seeded_at: string }>(),
    env.DB.prepare('SELECT id FROM products WHERE id = ?').bind('prod-field-pack').first<{ id: string }>(),
  ]);
  const wishlist: Wishlist = {
    customerId,
    productIds: featured ? [featured.id] : [],
    updatedAt: seedState?.seeded_at ?? new Date().toISOString(),
  };
  await env.DB.prepare('INSERT INTO wishlists (customer_id, updated_at, data_json) VALUES (?, ?, ?)')
    .bind(wishlist.customerId, wishlist.updatedAt, JSON.stringify(wishlist))
    .run();
  return wishlist;
}

async function persistWishlist(env: WishlistLifecycleEnv, wishlist: Wishlist): Promise<void> {
  await env.DB.prepare('UPDATE wishlists SET updated_at = ?, data_json = ? WHERE customer_id = ?')
    .bind(wishlist.updatedAt, JSON.stringify(wishlist), wishlist.customerId)
    .run();
}

export async function handleWishlistLifecycle(
  request: Request,
  env: WishlistLifecycleEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, '') || '/';

  const wishlistMatch = path.match(/^\/api\/v1\/wishlist\/([^/]+)$/);
  if (request.method === 'GET' && wishlistMatch) {
    const customerId = decodeURIComponent(wishlistMatch[1]!);
    const wishlist = await ensureWishlist(env, customerId);
    return wishlist
      ? ok(request, env, wishlist)
      : fail(request, env, 404, 'CUSTOMER_NOT_FOUND', 'Customer was not found.');
  }

  const addMatch = path.match(/^\/api\/v1\/wishlist\/([^/]+)\/items$/);
  if (request.method === 'POST' && addMatch) {
    const customerId = decodeURIComponent(addMatch[1]!);
    const body = await request.json().catch(() => null) as WishlistAddItemInput | null;
    if (!body?.productId) return fail(request, env, 400, 'INVALID_WISHLIST_ITEM', 'productId is required.');

    const [wishlist, product] = await Promise.all([
      ensureWishlist(env, customerId),
      env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(body.productId).first<{ id: string }>(),
    ]);
    if (!wishlist) return fail(request, env, 404, 'CUSTOMER_NOT_FOUND', 'Customer was not found.');
    if (!product) return fail(request, env, 404, 'PRODUCT_NOT_FOUND', 'Product was not found.');

    const updated: Wishlist = {
      ...wishlist,
      productIds: wishlist.productIds.includes(body.productId)
        ? wishlist.productIds
        : [...wishlist.productIds, body.productId],
      updatedAt: new Date().toISOString(),
    };
    await persistWishlist(env, updated);
    return ok(request, env, updated, 201);
  }

  const removeMatch = path.match(/^\/api\/v1\/wishlist\/([^/]+)\/items\/([^/]+)$/);
  if (request.method === 'DELETE' && removeMatch) {
    const customerId = decodeURIComponent(removeMatch[1]!);
    const productId = decodeURIComponent(removeMatch[2]!);
    const wishlist = await ensureWishlist(env, customerId);
    if (!wishlist) return fail(request, env, 404, 'CUSTOMER_NOT_FOUND', 'Customer was not found.');

    const updated: Wishlist = {
      ...wishlist,
      productIds: wishlist.productIds.filter((id) => id !== productId),
      updatedAt: new Date().toISOString(),
    };
    await persistWishlist(env, updated);
    return ok(request, env, updated);
  }

  return null;
}
