import type { ApiSuccess } from '@beeecom/contracts';
import type { Category } from '@beeecom/domain';

interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
}

interface D1PreparedStatement {
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export interface CatalogExtraEnv {
  DB: D1Database;
  DEFAULT_SCENARIO?: string;
  CORS_ORIGINS?: string;
}

function allowedOrigin(request: Request, env: CatalogExtraEnv): string | null {
  const origin = request.headers.get('origin');
  if (!origin) return null;
  const configured = (env.CORS_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  if (configured.includes('*') || configured.includes(origin)) return origin;
  return null;
}

function responseHeaders(request: Request, env: CatalogExtraEnv): Headers {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  const origin = allowedOrigin(request, env);
  if (origin) {
    headers.set('access-control-allow-origin', origin);
    headers.set('vary', 'origin');
  }
  return headers;
}

export async function handleCatalogExtra(request: Request, env: CatalogExtraEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, '') || '/';
  if (request.method !== 'GET' || path !== '/api/v1/catalog/categories') return null;

  const [rows, state] = await Promise.all([
    env.DB.prepare('SELECT data_json FROM categories ORDER BY slug ASC').all<{ data_json: string }>(),
    env.DB.prepare('SELECT scenario FROM demo_state WHERE id = 1').first<{ scenario: string }>(),
  ]);
  const categories = rows.results.map((row) => JSON.parse(row.data_json) as Category);
  const payload: ApiSuccess<Category[]> = {
    ok: true,
    data: categories,
    meta: {
      requestId: crypto.randomUUID(),
      scenario: state?.scenario ?? env.DEFAULT_SCENARIO ?? 'healthy',
    },
  };
  return new Response(JSON.stringify(payload), { status: 200, headers: responseHeaders(request, env) });
}
