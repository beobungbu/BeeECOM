import type {
  ApiFailure,
  ApiSuccess,
  CreateChatThreadInput,
  MarkChatReadInput,
} from '@beeecom/contracts';
import type { ChatThread, Customer } from '@beeecom/domain';

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

export interface ChatLifecycleEnv {
  DB: D1Database;
  DEFAULT_SCENARIO?: string;
  CORS_ORIGINS?: string;
}

interface RequestContext {
  requestId: string;
  scenario: string;
}

function allowedOrigin(request: Request, env: ChatLifecycleEnv): string | null {
  const origin = request.headers.get('origin');
  if (!origin) return null;
  const configured = (env.CORS_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  if (configured.includes('*') || configured.includes(origin)) return origin;
  return null;
}

function responseHeaders(request: Request, env: ChatLifecycleEnv): Headers {
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

async function context(env: ChatLifecycleEnv): Promise<RequestContext> {
  const row = await env.DB.prepare('SELECT scenario FROM demo_state WHERE id = 1').first<{ scenario: string }>();
  return {
    requestId: crypto.randomUUID(),
    scenario: row?.scenario ?? env.DEFAULT_SCENARIO ?? 'healthy',
  };
}

function json<T>(request: Request, env: ChatLifecycleEnv, value: T, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: responseHeaders(request, env) });
}

async function ok<T>(request: Request, env: ChatLifecycleEnv, data: T, status = 200): Promise<Response> {
  const payload: ApiSuccess<T> = { ok: true, data, meta: await context(env) };
  return json(request, env, payload, status);
}

async function fail(
  request: Request,
  env: ChatLifecycleEnv,
  status: number,
  code: string,
  message: string,
): Promise<Response> {
  const payload: ApiFailure = { ok: false, error: { code, message }, meta: await context(env) };
  return json(request, env, payload, status);
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

async function createThread(
  request: Request,
  env: ChatLifecycleEnv,
  input: CreateChatThreadInput,
): Promise<Response> {
  const subject = input.subject.trim();
  if (!input.customerId || !subject) {
    return fail(request, env, 400, 'INVALID_THREAD', 'customerId and subject are required.');
  }

  const customer = await env.DB.prepare('SELECT data_json FROM customers WHERE id = ?')
    .bind(input.customerId)
    .first<{ data_json: string }>();
  if (!customer) return fail(request, env, 404, 'CUSTOMER_NOT_FOUND', 'Customer was not found.');
  parseJson<Customer>(customer.data_json);

  const now = new Date().toISOString();
  const thread: ChatThread = {
    id: `thread-${crypto.randomUUID()}`,
    customerId: input.customerId,
    subject,
    status: 'open',
    ...(input.assignedAgentId ? { assignedAgentId: input.assignedAgentId } : {}),
    unreadByCustomer: 0,
    unreadByAgent: 0,
    createdAt: now,
    updatedAt: now,
  };

  await env.DB.prepare('INSERT INTO chat_threads (id, customer_id, updated_at, data_json) VALUES (?, ?, ?, ?)')
    .bind(thread.id, thread.customerId, thread.updatedAt, JSON.stringify(thread))
    .run();
  return ok(request, env, thread, 201);
}

async function markRead(
  request: Request,
  env: ChatLifecycleEnv,
  threadId: string,
  input: MarkChatReadInput,
): Promise<Response> {
  if (input.readerRole !== 'customer' && input.readerRole !== 'support-agent') {
    return fail(request, env, 400, 'INVALID_READER_ROLE', 'readerRole must be customer or support-agent.');
  }

  const row = await env.DB.prepare('SELECT data_json FROM chat_threads WHERE id = ?')
    .bind(threadId)
    .first<{ data_json: string }>();
  if (!row) return fail(request, env, 404, 'THREAD_NOT_FOUND', 'Chat thread was not found.');

  const thread = parseJson<ChatThread>(row.data_json);
  const updated: ChatThread = input.readerRole === 'customer'
    ? { ...thread, unreadByCustomer: 0 }
    : { ...thread, unreadByAgent: 0 };

  await env.DB.prepare('UPDATE chat_threads SET data_json = ? WHERE id = ?')
    .bind(JSON.stringify(updated), threadId)
    .run();
  return ok(request, env, updated);
}

export async function handleChatLifecycle(
  request: Request,
  env: ChatLifecycleEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, '') || '/';

  if (request.method === 'POST' && path === '/api/v1/chat/threads') {
    const body = await request.json().catch(() => null) as CreateChatThreadInput | null;
    if (!body) return fail(request, env, 400, 'INVALID_THREAD', 'A thread body is required.');
    return createThread(request, env, body);
  }

  const readMatch = path.match(/^\/api\/v1\/chat\/threads\/([^/]+)\/read$/);
  if (request.method === 'PATCH' && readMatch) {
    const body = await request.json().catch(() => null) as MarkChatReadInput | null;
    if (!body) return fail(request, env, 400, 'INVALID_READ_STATE', 'readerRole is required.');
    return markRead(request, env, decodeURIComponent(readMatch[1]!), body);
  }

  return null;
}
