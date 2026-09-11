import type { ApiFailure, ApiSuccess } from '@beeecom/contracts';
import type { Promotion, PromotionKind } from '@beeecom/domain';

interface D1Result<T = unknown> { results: T[]; success: boolean }
interface D1PreparedStatement {
  bind(...values: Array<string | number | null>): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
}
interface D1Database { prepare(query: string): D1PreparedStatement }
export interface PromotionLifecycleEnv { DB: D1Database; DEFAULT_SCENARIO?: string; CORS_ORIGINS?: string }

function allowedOrigin(request: Request, env: PromotionLifecycleEnv): string | null {
  const origin = request.headers.get('origin');
  if (!origin) return null;
  const configured = (env.CORS_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  return configured.includes('*') || configured.includes(origin) ? origin : null;
}

function headers(request: Request, env: PromotionLifecycleEnv): Headers {
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

async function scenario(env: PromotionLifecycleEnv): Promise<string> {
  const row = await env.DB.prepare('SELECT scenario FROM demo_state WHERE id = 1').first<{ scenario: string }>();
  return row?.scenario ?? env.DEFAULT_SCENARIO ?? 'healthy';
}

async function ok<T>(request: Request, env: PromotionLifecycleEnv, data: T, status = 200): Promise<Response> {
  const payload: ApiSuccess<T> = { ok: true, data, meta: { requestId: crypto.randomUUID(), scenario: await scenario(env) } };
  return new Response(JSON.stringify(payload), { status, headers: headers(request, env) });
}

async function fail(request: Request, env: PromotionLifecycleEnv, status: number, code: string, message: string): Promise<Response> {
  const payload: ApiFailure = { ok: false, error: { code, message }, meta: { requestId: crypto.randomUUID(), scenario: await scenario(env) } };
  return new Response(JSON.stringify(payload), { status, headers: headers(request, env) });
}

function objectBody(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function normalizedCode(value: string): string {
  return value.trim().toUpperCase();
}

function validValue(kind: PromotionKind, value: number): boolean {
  if (!Number.isInteger(value) || value <= 0) return false;
  return kind === 'fixed' || value <= 100;
}

function validWindow(startsAt: string, endsAt: string): boolean {
  return !Number.isNaN(Date.parse(startsAt))
    && !Number.isNaN(Date.parse(endsAt))
    && Date.parse(startsAt) < Date.parse(endsAt);
}

async function rowById(env: PromotionLifecycleEnv, id: string): Promise<Promotion | null> {
  const row = await env.DB.prepare('SELECT data_json FROM promotions WHERE id = ?').bind(id).first<{ data_json: string }>();
  return row ? JSON.parse(row.data_json) as Promotion : null;
}

async function createPromotion(request: Request, env: PromotionLifecycleEnv): Promise<Response> {
  const input = objectBody(await request.json().catch(() => null));
  if (!input) return fail(request, env, 400, 'INVALID_PROMOTION_CREATE', 'Promotion body is required.');

  if (typeof input.code !== 'string') return fail(request, env, 400, 'INVALID_PROMOTION_CODE', 'Promotion code must be a string.');
  const code = normalizedCode(input.code);
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
    return fail(request, env, 400, 'INVALID_PROMOTION_CODE', 'Promotion code must be 3–32 characters using A–Z, 0–9, underscore or hyphen.');
  }

  if (typeof input.title !== 'string') return fail(request, env, 400, 'INVALID_PROMOTION_TITLE', 'Promotion title must be a string.');
  const title = input.title.trim();
  if (!title || title.length > 120) return fail(request, env, 400, 'INVALID_PROMOTION_TITLE', 'Promotion title is required and must be at most 120 characters.');

  if (typeof input.description !== 'string') return fail(request, env, 400, 'INVALID_PROMOTION_DESCRIPTION', 'Promotion description must be a string.');
  const description = input.description.trim();
  if (!description || description.length > 500) return fail(request, env, 400, 'INVALID_PROMOTION_DESCRIPTION', 'Promotion description is required and must be at most 500 characters.');

  const kind = input.kind;
  if (kind !== 'percentage' && kind !== 'fixed') return fail(request, env, 400, 'INVALID_PROMOTION_KIND', 'Promotion kind must be percentage or fixed.');

  const value = input.value;
  if (typeof value !== 'number' || !validValue(kind, value)) {
    return fail(request, env, 400, 'INVALID_PROMOTION_VALUE', 'Percentage must be 1–100; fixed discount must be a positive whole number of cents.');
  }

  if (input.active !== undefined && typeof input.active !== 'boolean') {
    return fail(request, env, 400, 'INVALID_PROMOTION_ACTIVE', 'Promotion active must be a boolean.');
  }
  const active = typeof input.active === 'boolean' ? input.active : false;

  if (typeof input.startsAt !== 'string' || typeof input.endsAt !== 'string' || !validWindow(input.startsAt, input.endsAt)) {
    return fail(request, env, 400, 'INVALID_PROMOTION_WINDOW', 'Promotion start and end must be valid timestamps with start before end.');
  }
  const startsAt = input.startsAt;
  const endsAt = input.endsAt;

  const duplicate = await env.DB.prepare('SELECT id FROM promotions WHERE code = ? LIMIT 1').bind(code).first<{ id: string }>();
  if (duplicate) return fail(request, env, 409, 'PROMOTION_CODE_IN_USE', 'A promotion with this code already exists.');

  const promotion: Promotion = {
    id: `promo-${crypto.randomUUID()}`,
    code,
    title,
    description,
    kind,
    value,
    active,
    startsAt: new Date(startsAt).toISOString(),
    endsAt: new Date(endsAt).toISOString(),
  };

  try {
    await env.DB.prepare('INSERT INTO promotions (id, code, active, data_json) VALUES (?, ?, ?, ?)')
      .bind(promotion.id, promotion.code, promotion.active ? 1 : 0, JSON.stringify(promotion))
      .run();
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    if (/UNIQUE constraint failed.*promotions\.code/i.test(message)) {
      return fail(request, env, 409, 'PROMOTION_CODE_IN_USE', 'A promotion with this code already exists.');
    }
    throw cause;
  }
  return ok(request, env, promotion, 201);
}

async function updatePromotion(request: Request, env: PromotionLifecycleEnv, id: string): Promise<Response> {
  const input = objectBody(await request.json().catch(() => null));
  if (!input) return fail(request, env, 400, 'INVALID_PROMOTION_UPDATE', 'Promotion update body is required.');
  const promotion = await rowById(env, id);
  if (!promotion) return fail(request, env, 404, 'PROMOTION_NOT_FOUND', 'Promotion was not found.');

  if (input.title !== undefined && typeof input.title !== 'string') {
    return fail(request, env, 400, 'INVALID_PROMOTION_TITLE', 'Promotion title must be a string.');
  }
  const title = typeof input.title === 'string' ? input.title.trim() : promotion.title;
  if (!title || title.length > 120) return fail(request, env, 400, 'INVALID_PROMOTION_TITLE', 'Promotion title is required and must be at most 120 characters.');

  if (input.description !== undefined && typeof input.description !== 'string') {
    return fail(request, env, 400, 'INVALID_PROMOTION_DESCRIPTION', 'Promotion description must be a string.');
  }
  const description = typeof input.description === 'string' ? input.description.trim() : promotion.description;
  if (!description || description.length > 500) return fail(request, env, 400, 'INVALID_PROMOTION_DESCRIPTION', 'Promotion description is required and must be at most 500 characters.');

  const kindInput = input.kind;
  if (kindInput !== undefined && kindInput !== 'percentage' && kindInput !== 'fixed') {
    return fail(request, env, 400, 'INVALID_PROMOTION_KIND', 'Promotion kind must be percentage or fixed.');
  }
  const kind: PromotionKind = kindInput === 'percentage' || kindInput === 'fixed' ? kindInput : promotion.kind;

  const valueInput = input.value;
  if (valueInput !== undefined && typeof valueInput !== 'number') {
    return fail(request, env, 400, 'INVALID_PROMOTION_VALUE', 'Promotion value must be a number.');
  }
  const value = typeof valueInput === 'number' ? valueInput : promotion.value;
  if (!validValue(kind, value)) return fail(request, env, 400, 'INVALID_PROMOTION_VALUE', 'Percentage must be 1–100; fixed discount must be a positive whole number of cents.');

  if (input.active !== undefined && typeof input.active !== 'boolean') {
    return fail(request, env, 400, 'INVALID_PROMOTION_ACTIVE', 'Promotion active must be a boolean.');
  }
  const active = typeof input.active === 'boolean' ? input.active : promotion.active;

  if (input.startsAt !== undefined && typeof input.startsAt !== 'string') {
    return fail(request, env, 400, 'INVALID_PROMOTION_WINDOW', 'Promotion start must be a valid timestamp.');
  }
  if (input.endsAt !== undefined && typeof input.endsAt !== 'string') {
    return fail(request, env, 400, 'INVALID_PROMOTION_WINDOW', 'Promotion end must be a valid timestamp.');
  }
  const startsAt = typeof input.startsAt === 'string' ? input.startsAt : promotion.startsAt;
  const endsAt = typeof input.endsAt === 'string' ? input.endsAt : promotion.endsAt;
  if (!validWindow(startsAt, endsAt)) return fail(request, env, 400, 'INVALID_PROMOTION_WINDOW', 'Promotion start must be before end.');

  const updated: Promotion = {
    ...promotion,
    title,
    description,
    kind,
    value,
    active,
    startsAt: new Date(startsAt).toISOString(),
    endsAt: new Date(endsAt).toISOString(),
  };
  await env.DB.prepare('UPDATE promotions SET active = ?, data_json = ? WHERE id = ?')
    .bind(updated.active ? 1 : 0, JSON.stringify(updated), updated.id)
    .run();
  return ok(request, env, updated);
}

export async function handlePromotionLifecycle(request: Request, env: PromotionLifecycleEnv): Promise<Response | null> {
  const path = new URL(request.url).pathname.replace(/\/$/, '') || '/';
  if (path === '/api/v1/admin/promotions' && request.method === 'POST') return createPromotion(request, env);
  const match = path.match(/^\/api\/v1\/admin\/promotions\/([^/]+)$/);
  if (match && request.method === 'PATCH') return updatePromotion(request, env, decodeURIComponent(match[1]!));
  return null;
}
