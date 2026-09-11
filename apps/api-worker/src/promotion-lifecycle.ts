import type {
  AdminPromotionCreateInput,
  AdminPromotionUpdateInput,
  ApiFailure,
  ApiSuccess,
} from '@beeecom/contracts';
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
  const input = await request.json().catch(() => null) as AdminPromotionCreateInput | null;
  if (!input) return fail(request, env, 400, 'INVALID_PROMOTION_CREATE', 'Promotion body is required.');

  const code = normalizedCode(input.code ?? '');
  const title = input.title?.trim();
  const description = input.description?.trim();
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
    return fail(request, env, 400, 'INVALID_PROMOTION_CODE', 'Promotion code must be 3–32 characters using A–Z, 0–9, underscore or hyphen.');
  }
  if (!title || title.length > 120) return fail(request, env, 400, 'INVALID_PROMOTION_TITLE', 'Promotion title is required and must be at most 120 characters.');
  if (!description || description.length > 500) return fail(request, env, 400, 'INVALID_PROMOTION_DESCRIPTION', 'Promotion description is required and must be at most 500 characters.');
  if (input.kind !== 'percentage' && input.kind !== 'fixed') return fail(request, env, 400, 'INVALID_PROMOTION_KIND', 'Promotion kind must be percentage or fixed.');
  if (!validValue(input.kind, input.value)) return fail(request, env, 400, 'INVALID_PROMOTION_VALUE', 'Percentage must be 1–100; fixed discount must be a positive whole number of cents.');
  if (!validWindow(input.startsAt, input.endsAt)) return fail(request, env, 400, 'INVALID_PROMOTION_WINDOW', 'Promotion start must be before end.');

  const duplicate = await env.DB.prepare('SELECT id FROM promotions WHERE code = ? LIMIT 1').bind(code).first<{ id: string }>();
  if (duplicate) return fail(request, env, 409, 'PROMOTION_CODE_IN_USE', 'A promotion with this code already exists.');

  const promotion: Promotion = {
    id: `promo-${crypto.randomUUID()}`,
    code,
    title,
    description,
    kind: input.kind,
    value: input.value,
    active: input.active ?? false,
    startsAt: new Date(input.startsAt).toISOString(),
    endsAt: new Date(input.endsAt).toISOString(),
  };

  await env.DB.prepare('INSERT INTO promotions (id, code, active, data_json) VALUES (?, ?, ?, ?)')
    .bind(promotion.id, promotion.code, promotion.active ? 1 : 0, JSON.stringify(promotion))
    .run();
  return ok(request, env, promotion, 201);
}

async function updatePromotion(request: Request, env: PromotionLifecycleEnv, id: string): Promise<Response> {
  const input = await request.json().catch(() => null) as AdminPromotionUpdateInput | null;
  if (!input) return fail(request, env, 400, 'INVALID_PROMOTION_UPDATE', 'Promotion update body is required.');
  const promotion = await rowById(env, id);
  if (!promotion) return fail(request, env, 404, 'PROMOTION_NOT_FOUND', 'Promotion was not found.');

  const title = input.title !== undefined ? input.title.trim() : promotion.title;
  const description = input.description !== undefined ? input.description.trim() : promotion.description;
  const kind = input.kind ?? promotion.kind;
  const value = input.value ?? promotion.value;
  const startsAt = input.startsAt ?? promotion.startsAt;
  const endsAt = input.endsAt ?? promotion.endsAt;

  if (!title || title.length > 120) return fail(request, env, 400, 'INVALID_PROMOTION_TITLE', 'Promotion title is required and must be at most 120 characters.');
  if (!description || description.length > 500) return fail(request, env, 400, 'INVALID_PROMOTION_DESCRIPTION', 'Promotion description is required and must be at most 500 characters.');
  if (kind !== 'percentage' && kind !== 'fixed') return fail(request, env, 400, 'INVALID_PROMOTION_KIND', 'Promotion kind must be percentage or fixed.');
  if (!validValue(kind, value)) return fail(request, env, 400, 'INVALID_PROMOTION_VALUE', 'Percentage must be 1–100; fixed discount must be a positive whole number of cents.');
  if (!validWindow(startsAt, endsAt)) return fail(request, env, 400, 'INVALID_PROMOTION_WINDOW', 'Promotion start must be before end.');

  const updated: Promotion = {
    ...promotion,
    title,
    description,
    kind,
    value,
    active: input.active ?? promotion.active,
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
