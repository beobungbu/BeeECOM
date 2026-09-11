import type { ApiFailure, ApiSuccess, CreateReviewInput, ReviewQuery } from '@beeecom/contracts';
import type { Customer, Order, Product, Review } from '@beeecom/domain';

interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
}

interface D1PreparedStatement {
  bind(...values: Array<string | number | null>): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = unknown>(): Promise<D1Result<T>>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export interface ReviewLifecycleEnv {
  DB: D1Database;
  DEFAULT_SCENARIO?: string;
  CORS_ORIGINS?: string;
}

interface RequestContext {
  requestId: string;
  scenario: string;
}

function allowedOrigin(request: Request, env: ReviewLifecycleEnv): string | null {
  const origin = request.headers.get('origin');
  if (!origin) return null;
  const configured = (env.CORS_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  if (configured.includes('*') || configured.includes(origin)) return origin;
  return null;
}

function responseHeaders(request: Request, env: ReviewLifecycleEnv): Headers {
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

async function context(env: ReviewLifecycleEnv): Promise<RequestContext> {
  const row = await env.DB.prepare('SELECT scenario FROM demo_state WHERE id = 1').first<{ scenario: string }>();
  return {
    requestId: crypto.randomUUID(),
    scenario: row?.scenario ?? env.DEFAULT_SCENARIO ?? 'healthy',
  };
}

async function ok<T>(request: Request, env: ReviewLifecycleEnv, data: T, status = 200): Promise<Response> {
  const payload: ApiSuccess<T> = { ok: true, data, meta: await context(env) };
  return new Response(JSON.stringify(payload), { status, headers: responseHeaders(request, env) });
}

async function fail(
  request: Request,
  env: ReviewLifecycleEnv,
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

function validRating(value: unknown): value is CreateReviewInput['rating'] {
  return Number.isInteger(value) && typeof value === 'number' && value >= 1 && value <= 5;
}

async function listReviews(request: Request, env: ReviewLifecycleEnv, url: URL): Promise<Response> {
  const query: ReviewQuery = {
    productId: url.searchParams.get('productId') ?? undefined,
    customerId: url.searchParams.get('customerId') ?? undefined,
  };
  const rows = await env.DB.prepare('SELECT data_json FROM reviews ORDER BY created_at DESC').all<{ data_json: string }>();
  let reviews = rows.results.map((row) => parseJson<Review>(row.data_json));
  if (query.productId) reviews = reviews.filter((review) => review.productId === query.productId);
  if (query.customerId) reviews = reviews.filter((review) => review.customerId === query.customerId);
  else reviews = reviews.filter((review) => review.status === 'published');
  return ok(request, env, reviews);
}

async function createReview(request: Request, env: ReviewLifecycleEnv): Promise<Response> {
  const body = await request.json().catch(() => null) as CreateReviewInput | null;
  if (!body?.productId || !body.customerId || !validRating(body.rating) || !body.title?.trim() || !body.body?.trim()) {
    return fail(request, env, 400, 'INVALID_REVIEW', 'Product, customer, rating, title and review body are required.');
  }

  const title = body.title.trim();
  const reviewBody = body.body.trim();
  if (title.length < 3 || title.length > 120) {
    return fail(request, env, 400, 'INVALID_REVIEW_TITLE', 'Review title must be between 3 and 120 characters.');
  }
  if (reviewBody.length < 10 || reviewBody.length > 2000) {
    return fail(request, env, 400, 'INVALID_REVIEW_BODY', 'Review body must be between 10 and 2000 characters.');
  }

  const [customerRow, productRow, duplicate] = await Promise.all([
    env.DB.prepare('SELECT data_json FROM customers WHERE id = ?').bind(body.customerId).first<{ data_json: string }>(),
    env.DB.prepare('SELECT data_json FROM products WHERE id = ?').bind(body.productId).first<{ data_json: string }>(),
    env.DB.prepare('SELECT id FROM reviews WHERE customer_id = ? AND product_id = ? LIMIT 1')
      .bind(body.customerId, body.productId)
      .first<{ id: string }>(),
  ]);

  if (!customerRow) return fail(request, env, 404, 'CUSTOMER_NOT_FOUND', 'Customer was not found.');
  if (!productRow) return fail(request, env, 404, 'PRODUCT_NOT_FOUND', 'Product was not found.');
  if (duplicate) return fail(request, env, 409, 'REVIEW_ALREADY_EXISTS', 'You have already reviewed this product.');

  const customer = parseJson<Customer>(customerRow.data_json);
  const product = parseJson<Product>(productRow.data_json);
  const orderRows = await env.DB.prepare('SELECT data_json FROM orders WHERE customer_id = ? ORDER BY placed_at DESC')
    .bind(customer.id)
    .all<{ data_json: string }>();
  const customerOrders = orderRows.results.map((row) => parseJson<Order>(row.data_json));
  const purchased = customerOrders.some(
    (order) => order.paymentState === 'paid' && order.lines.some((line) => line.productId === product.id),
  );
  if (!purchased) {
    return fail(request, env, 403, 'REVIEW_PURCHASE_REQUIRED', 'Only purchased products can be reviewed.');
  }

  const delivered = customerOrders.some(
    (order) => order.paymentState === 'paid'
      && order.fulfillmentState === 'delivered'
      && order.lines.some((line) => line.productId === product.id),
  );
  if (!delivered) {
    return fail(request, env, 403, 'REVIEW_DELIVERY_REQUIRED', 'Reviews are available after the purchased product has been delivered.');
  }

  const review: Review = {
    id: `review-${crypto.randomUUID()}`,
    productId: product.id,
    customerId: customer.id,
    rating: body.rating,
    title,
    body: reviewBody,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  await env.DB.prepare('INSERT INTO reviews (id, product_id, customer_id, created_at, data_json) VALUES (?, ?, ?, ?, ?)')
    .bind(review.id, review.productId, review.customerId, review.createdAt, JSON.stringify(review))
    .run();

  return ok(request, env, review, 201);
}

export async function handleReviewLifecycle(
  request: Request,
  env: ReviewLifecycleEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, '') || '/';
  if (path !== '/api/v1/reviews') return null;
  if (request.method === 'GET') return listReviews(request, env, url);
  if (request.method === 'POST') return createReview(request, env);
  return null;
}
