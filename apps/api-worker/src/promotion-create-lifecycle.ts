import type { AdminPromotionCreateInput, ApiFailure, ApiSuccess } from '@beeecom/contracts';
import type { Promotion } from '@beeecom/domain';

interface D1Result<T = unknown> { results: T[]; success: boolean }
interface D1PreparedStatement {
  bind(...values: Array<string | number | null>): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
}
interface D1Database { prepare(query: string): D1PreparedStatement }
export interface PromotionCreateEnv { DB: D1Database; DEFAULT_SCENARIO?: string; CORS_ORIGINS?: string }

function allowedOrigin(request: Request, env: PromotionCreateEnv): string | null {
  const origin = request.headers.get('origin');
  if (!origin) return null;
  const configured = (env.CORS_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  return configured.includes('*') || configured.includes(origin) ? origin : null;
}

function headers(request: Request, env: PromotionCreateEnv): Headers {
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

async function scenario(env: PromotionCreateEnv): Promise<string> {
  const row = await env.DB.prepare('SELECT scenario FROM demo_state WHERE id = 1').first<{ scenario: string }>();
  return row?.scenario ?? env.DEFAULT_SCENARIO ?? 'healthy';
}

async function ok<T>(request: Request, env: PromotionCreateEnv, data: T, status = 200): Promise<Response> {
  const payload: ApiSuccess<T> = { ok: true, data, meta: { requestId: crypto.randomUUID(), scenario: await scenario(env) } };
  return new Response(JSON.stringify(payload), { status, headers: headers(request, env) });
}

async function fail(request: Request, env: PromotionCreateEnv, status: number, code: string, message: string): Promise<Response> {
  const payload: ApiFailure = { ok: false, error: { code, message }, meta: { requestId: crypto.randomUUID(), scenario: await scenario(env) } };
  return new Response(JSON.stringify(payload), { status, headers: headers(request, env) });
}

function normalizedCode(value: string): string {
  return value.trim().toUpperCase();
}

function validValue(input: AdminPromotionCreateInput): boolean {
  if (!Number.isInteger(input.value) || input.value <= 0) return false;
  return input.kind === 'fixed' || (input.kind === 'percentage' && input.value <= 100);
}

async function createPromotion(request: Request, env: PromotionCreateEnv): Promise<Response> {
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
  if (!validValue(input)) return fail(request, env, 400, 'INVALID_PROMOTION_VALUE', 'Percentage must be 1–100; fixed discount must be a positive whole number of cents.');
  if (Number.isNaN(Date.parse(input.startsAt)) || Number.isNaN(Date.parse(input.endsAt)) || Date.parse(input.startsAt) >= Date.parse(input.endsAt)) {
    return fail(request, env, 400, 'INVALID_PROMOTION_WINDOW', 'Promotion start must be before end.');
  }

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

export async function handlePromotionCreateLifecycle(request: Request, env: PromotionCreateEnv): Promise<Response | null> {
  const path = new URL(request.url).pathname.replace(/\/$/, '') || '/';
  if (path !== '/api/v1/admin/promotions' || request.method !== 'POST') return null;
  return createPromotion(request, env);
}
