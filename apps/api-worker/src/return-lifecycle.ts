import type { ApiFailure, ApiSuccess, CreateReturnInput, ReturnQuery } from '@beeecom/contracts';
import type { Customer, Order, ReturnRequest } from '@beeecom/domain';

interface D1Result<T = unknown> { results: T[]; success: boolean }
interface D1PreparedStatement {
  bind(...values: Array<string | number | null>): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = unknown>(): Promise<D1Result<T>>;
}
interface D1Database { prepare(query: string): D1PreparedStatement }
export interface ReturnLifecycleEnv { DB: D1Database; DEFAULT_SCENARIO?: string; CORS_ORIGINS?: string }
interface RequestContext { requestId: string; scenario: string }

function allowedOrigin(request: Request, env: ReturnLifecycleEnv): string | null {
  const origin = request.headers.get('origin');
  if (!origin) return null;
  const configured = (env.CORS_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  return configured.includes('*') || configured.includes(origin) ? origin : null;
}
function headers(request: Request, env: ReturnLifecycleEnv): Headers {
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
async function context(env: ReturnLifecycleEnv): Promise<RequestContext> {
  const row = await env.DB.prepare('SELECT scenario FROM demo_state WHERE id = 1').first<{ scenario: string }>();
  return { requestId: crypto.randomUUID(), scenario: row?.scenario ?? env.DEFAULT_SCENARIO ?? 'healthy' };
}
async function ok<T>(request: Request, env: ReturnLifecycleEnv, data: T, status = 200): Promise<Response> {
  const payload: ApiSuccess<T> = { ok: true, data, meta: await context(env) };
  return new Response(JSON.stringify(payload), { status, headers: headers(request, env) });
}
async function fail(request: Request, env: ReturnLifecycleEnv, status: number, code: string, message: string): Promise<Response> {
  const payload: ApiFailure = { ok: false, error: { code, message }, meta: await context(env) };
  return new Response(JSON.stringify(payload), { status, headers: headers(request, env) });
}
function parse<T>(value: string): T { return JSON.parse(value) as T }
async function rowById<T>(env: ReturnLifecycleEnv, table: string, id: string): Promise<T | null> {
  const row = await env.DB.prepare(`SELECT data_json FROM ${table} WHERE id = ?`).bind(id).first<{ data_json: string }>();
  return row ? parse<T>(row.data_json) : null;
}

async function listReturns(request: Request, env: ReturnLifecycleEnv, query: ReturnQuery): Promise<Response> {
  if (!query.customerId) {
    return fail(request, env, 400, 'RETURN_CUSTOMER_REQUIRED', 'customerId is required to read customer returns.');
  }
  const rows = await env.DB.prepare('SELECT data_json FROM returns WHERE customer_id = ? ORDER BY updated_at DESC')
    .bind(query.customerId)
    .all<{ data_json: string }>();
  let items = rows.results.map((row) => parse<ReturnRequest>(row.data_json));
  if (query.orderId) items = items.filter((item) => item.orderId === query.orderId);
  return ok(request, env, items);
}

async function createReturn(request: Request, env: ReturnLifecycleEnv, input: CreateReturnInput): Promise<Response> {
  const reason = input.reason?.trim();
  if (!input.orderId || !input.customerId || !reason) {
    return fail(request, env, 400, 'INVALID_RETURN', 'Order, customer and return reason are required.');
  }
  if (reason.length < 5 || reason.length > 1000) {
    return fail(request, env, 400, 'INVALID_RETURN_REASON', 'Return reason must be between 5 and 1000 characters.');
  }

  const [customer, order, duplicate] = await Promise.all([
    rowById<Customer>(env, 'customers', input.customerId),
    rowById<Order>(env, 'orders', input.orderId),
    env.DB.prepare('SELECT id FROM returns WHERE order_id = ? AND customer_id = ? LIMIT 1')
      .bind(input.orderId, input.customerId)
      .first<{ id: string }>(),
  ]);
  if (!customer) return fail(request, env, 404, 'CUSTOMER_NOT_FOUND', 'Customer was not found.');
  if (!order) return fail(request, env, 404, 'ORDER_NOT_FOUND', 'Order was not found.');
  if (order.customerId !== customer.id) return fail(request, env, 403, 'RETURN_ORDER_OWNERSHIP_REQUIRED', 'This order does not belong to the customer.');
  if (duplicate) return fail(request, env, 409, 'RETURN_ALREADY_EXISTS', 'A return request already exists for this order.');
  if (order.paymentState !== 'paid' || order.fulfillmentState !== 'delivered') {
    return fail(request, env, 409, 'RETURN_NOT_ELIGIBLE', 'Returns can be requested after a paid order has been delivered.');
  }

  const now = new Date().toISOString();
  const item: ReturnRequest = {
    id: `return-${crypto.randomUUID()}`,
    orderId: order.id,
    customerId: customer.id,
    reason,
    state: 'requested',
    requestedAt: now,
    updatedAt: now,
  };
  await env.DB.prepare('INSERT INTO returns (id, order_id, customer_id, updated_at, data_json) VALUES (?, ?, ?, ?, ?)')
    .bind(item.id, item.orderId, item.customerId, item.updatedAt, JSON.stringify(item))
    .run();
  return ok(request, env, item, 201);
}

export async function handleReturnLifecycle(request: Request, env: ReturnLifecycleEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, '') || '/';
  if (path !== '/api/v1/returns') return null;

  if (request.method === 'GET') {
    return listReturns(request, env, {
      customerId: url.searchParams.get('customerId') ?? undefined,
      orderId: url.searchParams.get('orderId') ?? undefined,
    });
  }
  if (request.method === 'POST') {
    const body = await request.json().catch(() => null) as CreateReturnInput | null;
    return body ? createReturn(request, env, body) : fail(request, env, 400, 'INVALID_RETURN', 'Return request body is required.');
  }
  return null;
}
