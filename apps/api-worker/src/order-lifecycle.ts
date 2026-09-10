import type { ApiFailure, ApiSuccess, CustomerCancelOrderInput } from '@beeecom/contracts';
import type { Customer, Order } from '@beeecom/domain';

interface D1PreparedStatement {
  bind(...values: Array<string | number | null>): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run<T = unknown>(): Promise<T>;
}
interface D1Database { prepare(query: string): D1PreparedStatement }
export interface OrderLifecycleEnv { DB: D1Database; DEFAULT_SCENARIO?: string; CORS_ORIGINS?: string }
interface RequestContext { requestId: string; scenario: string }

function allowedOrigin(request: Request, env: OrderLifecycleEnv): string | null {
  const origin = request.headers.get('origin');
  if (!origin) return null;
  const configured = (env.CORS_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  return configured.includes('*') || configured.includes(origin) ? origin : null;
}

function headers(request: Request, env: OrderLifecycleEnv): Headers {
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

async function context(env: OrderLifecycleEnv): Promise<RequestContext> {
  const row = await env.DB.prepare('SELECT scenario FROM demo_state WHERE id = 1').first<{ scenario: string }>();
  return { requestId: crypto.randomUUID(), scenario: row?.scenario ?? env.DEFAULT_SCENARIO ?? 'healthy' };
}

async function ok<T>(request: Request, env: OrderLifecycleEnv, data: T): Promise<Response> {
  const payload: ApiSuccess<T> = { ok: true, data, meta: await context(env) };
  return new Response(JSON.stringify(payload), { status: 200, headers: headers(request, env) });
}

async function fail(request: Request, env: OrderLifecycleEnv, status: number, code: string, message: string): Promise<Response> {
  const payload: ApiFailure = { ok: false, error: { code, message }, meta: await context(env) };
  return new Response(JSON.stringify(payload), { status, headers: headers(request, env) });
}

function parse<T>(value: string): T { return JSON.parse(value) as T }

async function rowById<T>(env: OrderLifecycleEnv, table: string, id: string): Promise<T | null> {
  const row = await env.DB.prepare(`SELECT data_json FROM ${table} WHERE id = ?`).bind(id).first<{ data_json: string }>();
  return row ? parse<T>(row.data_json) : null;
}

async function cancelCustomerOrder(
  request: Request,
  env: OrderLifecycleEnv,
  orderId: string,
  input: CustomerCancelOrderInput,
): Promise<Response> {
  const reason = input.reason?.trim();
  if (!input.customerId || !reason) {
    return fail(request, env, 400, 'INVALID_ORDER_CANCELLATION', 'Customer and cancellation reason are required.');
  }
  if (reason.length < 5 || reason.length > 500) {
    return fail(request, env, 400, 'INVALID_CANCELLATION_REASON', 'Cancellation reason must be between 5 and 500 characters.');
  }

  const [customer, order] = await Promise.all([
    rowById<Customer>(env, 'customers', input.customerId),
    rowById<Order>(env, 'orders', orderId),
  ]);
  if (!customer) return fail(request, env, 404, 'CUSTOMER_NOT_FOUND', 'Customer was not found.');
  if (!order) return fail(request, env, 404, 'ORDER_NOT_FOUND', 'Order was not found.');
  if (order.customerId !== customer.id) {
    return fail(request, env, 403, 'ORDER_OWNERSHIP_REQUIRED', 'This order does not belong to the customer.');
  }
  if (order.state !== 'placed' || order.paymentState !== 'paid' || order.fulfillmentState !== 'unfulfilled') {
    return fail(request, env, 409, 'ORDER_CANNOT_CANCEL', 'Only paid, unfulfilled orders can be cancelled by the customer.');
  }

  const updated: Order = {
    ...order,
    state: 'cancelled',
    paymentState: 'refunded',
    fulfillmentState: 'cancelled',
    updatedAt: new Date().toISOString(),
  };
  await env.DB.prepare('UPDATE orders SET data_json = ? WHERE id = ?')
    .bind(JSON.stringify(updated), order.id)
    .run();
  return ok(request, env, updated);
}

export async function handleOrderLifecycle(request: Request, env: OrderLifecycleEnv): Promise<Response | null> {
  const path = new URL(request.url).pathname.replace(/\/$/, '') || '/';
  const cancelMatch = path.match(/^\/api\/v1\/orders\/([^/]+)\/cancel$/);
  if (request.method !== 'POST' || !cancelMatch) return null;

  const body = await request.json().catch(() => null) as CustomerCancelOrderInput | null;
  if (!body) return fail(request, env, 400, 'INVALID_ORDER_CANCELLATION', 'Cancellation request body is required.');
  return cancelCustomerOrder(request, env, decodeURIComponent(cancelMatch[1]!), body);
}
