import {
  demoScenarioNames,
  isDemoScenarioName,
  type ApiFailure,
  type ApiSuccess,
  type CatalogQuery,
  type CheckoutInput,
  type DemoResetInput,
  type DemoResetResult,
  type Page,
  type SendChatMessageInput,
} from '@beeecom/contracts';
import {
  calculateCartTotals,
  type Cart,
  type ChatMessage,
  type ChatThread,
  type Customer,
  type Order,
  type OrderLine,
  type Product,
  type Promotion,
} from '@beeecom/domain';
import { createDemoDataset, datasetCounts, type DemoDataset } from '@beeecom/dummy-data';

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
  batch(statements: D1PreparedStatement[]): Promise<Array<D1Result>>;
}

interface Env {
  DB: D1Database;
  DEFAULT_SCENARIO?: string;
  CORS_ORIGINS?: string;
  DEMO_RESET_TOKEN?: string;
}

interface RequestContext {
  requestId: string;
  scenario: string;
}

const DELETE_ORDER = [
  'chat_messages',
  'chat_threads',
  'returns',
  'reviews',
  'orders',
  'promotions',
  'carts',
  'customers',
  'products',
  'categories',
  'personas',
  'demo_state',
] as const;

function allowedOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get('origin');
  if (!origin) return null;
  const configured = (env.CORS_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  if (configured.includes('*') || configured.includes(origin)) return origin;
  return null;
}

function responseHeaders(request: Request, env: Env): Headers {
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

function json<T>(request: Request, env: Env, value: T, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: responseHeaders(request, env) });
}

function ok<T>(request: Request, env: Env, context: RequestContext, data: T, status = 200): Response {
  const payload: ApiSuccess<T> = { ok: true, data, meta: context };
  return json(request, env, payload, status);
}

function fail(
  request: Request,
  env: Env,
  context: RequestContext,
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): Response {
  const error = details === undefined ? { code, message } : { code, message, details };
  const payload: ApiFailure = { ok: false, error, meta: context };
  return json(request, env, payload, status);
}

async function currentScenario(env: Env): Promise<string> {
  const row = await env.DB.prepare('SELECT scenario FROM demo_state WHERE id = 1').first<{ scenario: string }>();
  return row?.scenario ?? env.DEFAULT_SCENARIO ?? 'healthy';
}

async function makeContext(env: Env): Promise<RequestContext> {
  return { requestId: crypto.randomUUID(), scenario: await currentScenario(env) };
}

async function executeInChunks(db: D1Database, statements: D1PreparedStatement[], size = 40): Promise<void> {
  for (let index = 0; index < statements.length; index += size) {
    await db.batch(statements.slice(index, index + size));
  }
}

function insertStatements(env: Env, dataset: DemoDataset): D1PreparedStatement[] {
  const statements: D1PreparedStatement[] = [];
  const encoded = <T>(value: T) => JSON.stringify(value);

  for (const item of dataset.categories) {
    statements.push(env.DB.prepare('INSERT INTO categories (id, slug, data_json) VALUES (?, ?, ?)').bind(item.id, item.slug, encoded(item)));
  }
  for (const item of dataset.products) {
    statements.push(
      env.DB.prepare('INSERT INTO products (id, slug, title, featured, rating, created_at, data_json) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(item.id, item.slug, item.title, item.featured ? 1 : 0, item.rating, item.createdAt, encoded(item)),
    );
  }
  for (const item of dataset.customers) {
    statements.push(env.DB.prepare('INSERT INTO customers (id, email, data_json) VALUES (?, ?, ?)').bind(item.id, item.email, encoded(item)));
  }
  for (const item of dataset.carts) {
    statements.push(env.DB.prepare('INSERT INTO carts (id, customer_id, data_json) VALUES (?, ?, ?)').bind(item.id, item.customerId, encoded(item)));
  }
  for (const item of dataset.promotions) {
    statements.push(env.DB.prepare('INSERT INTO promotions (id, code, active, data_json) VALUES (?, ?, ?, ?)').bind(item.id, item.code, item.active ? 1 : 0, encoded(item)));
  }
  for (const item of dataset.orders) {
    statements.push(env.DB.prepare('INSERT INTO orders (id, number, customer_id, placed_at, data_json) VALUES (?, ?, ?, ?, ?)').bind(item.id, item.number, item.customerId, item.placedAt, encoded(item)));
  }
  for (const item of dataset.reviews) {
    statements.push(env.DB.prepare('INSERT INTO reviews (id, product_id, customer_id, created_at, data_json) VALUES (?, ?, ?, ?, ?)').bind(item.id, item.productId, item.customerId, item.createdAt, encoded(item)));
  }
  for (const item of dataset.returns) {
    statements.push(env.DB.prepare('INSERT INTO returns (id, order_id, customer_id, updated_at, data_json) VALUES (?, ?, ?, ?, ?)').bind(item.id, item.orderId, item.customerId, item.updatedAt, encoded(item)));
  }
  for (const item of dataset.chatThreads) {
    statements.push(env.DB.prepare('INSERT INTO chat_threads (id, customer_id, updated_at, data_json) VALUES (?, ?, ?, ?)').bind(item.id, item.customerId, item.updatedAt, encoded(item)));
  }
  for (const item of dataset.chatMessages) {
    statements.push(
      env.DB.prepare('INSERT INTO chat_messages (id, thread_id, client_message_id, sent_at, data_json) VALUES (?, ?, ?, ?, ?)')
        .bind(item.id, item.threadId, item.clientMessageId ?? null, item.sentAt, encoded(item)),
    );
  }
  for (const item of dataset.personas) {
    statements.push(env.DB.prepare('INSERT INTO personas (id, role, data_json) VALUES (?, ?, ?)').bind(item.id, item.role, encoded(item)));
  }

  statements.push(env.DB.prepare('INSERT INTO demo_state (id, scenario, seeded_at) VALUES (1, ?, ?)').bind(dataset.scenario, dataset.seededAt));
  return statements;
}

async function seedDatabase(env: Env, scenario: DemoResetInput['scenario']): Promise<DemoResetResult> {
  const dataset = createDemoDataset(scenario);
  await executeInChunks(env.DB, DELETE_ORDER.map((table) => env.DB.prepare(`DELETE FROM ${table}`)));
  await executeInChunks(env.DB, insertStatements(env, dataset));
  return { scenario, seededAt: dataset.seededAt, counts: datasetCounts(dataset) };
}

async function ensureSeeded(env: Env): Promise<void> {
  const existing = await env.DB.prepare('SELECT scenario FROM demo_state WHERE id = 1').first<{ scenario: string }>();
  if (existing) return;
  const configured = env.DEFAULT_SCENARIO ?? 'healthy';
  await seedDatabase(env, isDemoScenarioName(configured) ? configured : 'healthy');
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

async function getJsonRow<T>(env: Env, table: string, id: string): Promise<T | null> {
  const row = await env.DB.prepare(`SELECT data_json FROM ${table} WHERE id = ?`).bind(id).first<{ data_json: string }>();
  return row ? parseJson<T>(row.data_json) : null;
}

async function listProducts(env: Env, url: URL): Promise<Page<Product>> {
  const rows = await env.DB.prepare('SELECT data_json FROM products').all<{ data_json: string }>();
  let items = rows.results.map((row) => parseJson<Product>(row.data_json));
  const query: CatalogQuery = {
    q: url.searchParams.get('q') ?? undefined,
    category: url.searchParams.get('category') ?? undefined,
    tags: url.searchParams.getAll('tag'),
    sort: (url.searchParams.get('sort') as CatalogQuery['sort']) ?? undefined,
    page: Number(url.searchParams.get('page') ?? '1'),
    pageSize: Number(url.searchParams.get('pageSize') ?? '12'),
  };

  if (query.q) {
    const needle = query.q.toLowerCase();
    items = items.filter((product) => `${product.title} ${product.subtitle ?? ''} ${product.description} ${product.tags.join(' ')}`.toLowerCase().includes(needle));
  }

  if (query.category) {
    const category = await env.DB.prepare('SELECT id FROM categories WHERE slug = ? OR id = ?').bind(query.category, query.category).first<{ id: string }>();
    items = category ? items.filter((product) => product.categoryIds.includes(category.id)) : [];
  }

  for (const tag of query.tags ?? []) {
    items = items.filter((product) => product.tags.includes(tag));
  }

  switch (query.sort) {
    case 'price-asc':
      items.sort((a, b) => (a.variants[0]?.price.amount ?? 0) - (b.variants[0]?.price.amount ?? 0));
      break;
    case 'price-desc':
      items.sort((a, b) => (b.variants[0]?.price.amount ?? 0) - (a.variants[0]?.price.amount ?? 0));
      break;
    case 'rating':
      items.sort((a, b) => b.rating - a.rating);
      break;
    case 'newest':
      items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      break;
    case 'featured':
    default:
      items.sort((a, b) => Number(b.featured) - Number(a.featured) || a.title.localeCompare(b.title));
      break;
  }

  const page = Number.isFinite(query.page) ? Math.max(1, Math.floor(query.page ?? 1)) : 1;
  const pageSize = Number.isFinite(query.pageSize) ? Math.min(48, Math.max(1, Math.floor(query.pageSize ?? 12))) : 12;
  const total = items.length;
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page, pageSize, total, hasNextPage: start + pageSize < total };
}

async function productByIdOrSlug(env: Env, value: string): Promise<Product | null> {
  const row = await env.DB.prepare('SELECT data_json FROM products WHERE id = ? OR slug = ?').bind(value, value).first<{ data_json: string }>();
  return row ? parseJson<Product>(row.data_json) : null;
}

async function promotions(env: Env): Promise<Promotion[]> {
  const rows = await env.DB.prepare('SELECT data_json FROM promotions ORDER BY active DESC, code ASC').all<{ data_json: string }>();
  return rows.results.map((row) => parseJson<Promotion>(row.data_json));
}

async function checkout(env: Env, input: CheckoutInput, scenario: string): Promise<Order> {
  const cart = await getJsonRow<Cart>(env, 'carts', input.cartId);
  if (!cart) throw new Error('CART_NOT_FOUND');
  if (cart.lines.length === 0) throw new Error('CART_EMPTY');

  const customer = await getJsonRow<Customer>(env, 'customers', cart.customerId);
  if (!customer) throw new Error('CUSTOMER_NOT_FOUND');
  const address = customer.addresses.find((item) => item.id === input.addressId);
  if (!address) throw new Error('ADDRESS_NOT_FOUND');

  const productRows = await env.DB.prepare('SELECT data_json FROM products').all<{ data_json: string }>();
  const productMap = new Map(productRows.results.map((row) => {
    const product = parseJson<Product>(row.data_json);
    return [product.id, product] as const;
  }));

  const lines: OrderLine[] = cart.lines.map((line) => {
    const product = productMap.get(line.productId);
    const productVariant = product?.variants.find((item) => item.id === line.variantId);
    if (!product || !productVariant) throw new Error('VARIANT_NOT_FOUND');
    return {
      id: `orderline-${crypto.randomUUID()}`,
      productId: product.id,
      variantId: productVariant.id,
      title: product.title,
      variantTitle: productVariant.title,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    };
  });

  const activePromotions = await promotions(env);
  const promotion = cart.couponCode ? activePromotions.find((item) => item.active && item.code === cart.couponCode) : undefined;
  const totals = calculateCartTotals(cart, promotion);
  const placedAt = new Date().toISOString();
  const id = `order-${crypto.randomUUID()}`;
  const paymentFails = input.paymentScenario === 'failure' || scenario === 'payment-failed';
  const order: Order = {
    id,
    number: `#D-${id.slice(-8).toUpperCase()}`,
    customerId: customer.id,
    lines,
    ...totals,
    state: 'placed',
    paymentState: paymentFails ? 'failed' : 'paid',
    fulfillmentState: 'unfulfilled',
    shippingAddress: address,
    placedAt,
    updatedAt: placedAt,
  };

  await env.DB.prepare('INSERT INTO orders (id, number, customer_id, placed_at, data_json) VALUES (?, ?, ?, ?, ?)')
    .bind(order.id, order.number, order.customerId, order.placedAt, JSON.stringify(order))
    .run();
  return order;
}

async function listMessages(env: Env, threadId: string): Promise<ChatMessage[]> {
  const rows = await env.DB.prepare('SELECT data_json FROM chat_messages WHERE thread_id = ? ORDER BY sent_at ASC, id ASC')
    .bind(threadId)
    .all<{ data_json: string }>();
  return rows.results.map((row) => parseJson<ChatMessage>(row.data_json));
}

async function sendMessage(env: Env, threadId: string, input: SendChatMessageInput): Promise<ChatMessage> {
  if (threadId !== input.threadId) throw new Error('THREAD_MISMATCH');
  if (!input.body.trim()) throw new Error('MESSAGE_EMPTY');

  const thread = await getJsonRow<ChatThread>(env, 'chat_threads', threadId);
  if (!thread) throw new Error('THREAD_NOT_FOUND');

  const existing = await env.DB.prepare('SELECT data_json FROM chat_messages WHERE thread_id = ? AND client_message_id = ?')
    .bind(threadId, input.clientMessageId)
    .first<{ data_json: string }>();
  if (existing) return parseJson<ChatMessage>(existing.data_json);

  const message: ChatMessage = {
    id: `msg-${crypto.randomUUID()}`,
    threadId,
    senderId: input.senderId,
    senderRole: input.senderRole,
    body: input.body.trim(),
    sentAt: new Date().toISOString(),
    clientMessageId: input.clientMessageId,
  };

  await env.DB.prepare('INSERT OR IGNORE INTO chat_messages (id, thread_id, client_message_id, sent_at, data_json) VALUES (?, ?, ?, ?, ?)')
    .bind(message.id, threadId, input.clientMessageId, message.sentAt, JSON.stringify(message))
    .run();

  const persisted = await env.DB.prepare('SELECT data_json FROM chat_messages WHERE thread_id = ? AND client_message_id = ?')
    .bind(threadId, input.clientMessageId)
    .first<{ data_json: string }>();
  if (!persisted) throw new Error('MESSAGE_PERSIST_FAILED');

  const updatedThread: ChatThread = {
    ...thread,
    updatedAt: message.sentAt,
    unreadByAgent: input.senderRole === 'customer' ? thread.unreadByAgent + 1 : thread.unreadByAgent,
    unreadByCustomer: input.senderRole === 'support-agent' ? thread.unreadByCustomer + 1 : thread.unreadByCustomer,
  };
  await env.DB.prepare('UPDATE chat_threads SET updated_at = ?, data_json = ? WHERE id = ?')
    .bind(updatedThread.updatedAt, JSON.stringify(updatedThread), threadId)
    .run();

  return parseJson<ChatMessage>(persisted.data_json);
}

async function handle(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: responseHeaders(request, env) });

  await ensureSeeded(env);
  const context = await makeContext(env);
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, '') || '/';

  if (request.method === 'GET' && path === '/health') {
    return ok(request, env, context, { status: 'ok', service: 'beeecom-api', scenario: context.scenario });
  }

  if (request.method === 'GET' && path === '/api/v1/demo/scenarios') {
    return ok(request, env, context, demoScenarioNames);
  }

  if (request.method === 'GET' && path === '/api/v1/demo/personas') {
    const rows = await env.DB.prepare('SELECT data_json FROM personas ORDER BY id').all<{ data_json: string }>();
    return ok(request, env, context, rows.results.map((row) => JSON.parse(row.data_json)));
  }

  if (request.method === 'POST' && path === '/api/v1/demo/reset') {
    if (env.DEMO_RESET_TOKEN && request.headers.get('x-demo-reset-token') !== env.DEMO_RESET_TOKEN) {
      return fail(request, env, context, 403, 'RESET_FORBIDDEN', 'Demo reset token is required.');
    }
    const body = await request.json().catch(() => null) as Partial<DemoResetInput> | null;
    if (!body?.scenario || !isDemoScenarioName(body.scenario)) {
      return fail(request, env, context, 400, 'INVALID_SCENARIO', 'A valid named demo scenario is required.', { allowed: demoScenarioNames });
    }
    const result = await seedDatabase(env, body.scenario);
    return ok(request, env, { ...context, scenario: body.scenario }, result);
  }

  if (request.method === 'GET' && path === '/api/v1/catalog/products') {
    return ok(request, env, context, await listProducts(env, url));
  }

  const productMatch = path.match(/^\/api\/v1\/catalog\/products\/([^/]+)$/);
  if (request.method === 'GET' && productMatch) {
    const product = await productByIdOrSlug(env, decodeURIComponent(productMatch[1]!));
    return product ? ok(request, env, context, product) : fail(request, env, context, 404, 'PRODUCT_NOT_FOUND', 'Product was not found.');
  }

  const cartMatch = path.match(/^\/api\/v1\/cart\/([^/]+)$/);
  if (request.method === 'GET' && cartMatch) {
    const cart = await getJsonRow<Cart>(env, 'carts', decodeURIComponent(cartMatch[1]!));
    return cart ? ok(request, env, context, cart) : fail(request, env, context, 404, 'CART_NOT_FOUND', 'Cart was not found.');
  }

  if (request.method === 'POST' && path === '/api/v1/checkout') {
    const body = await request.json().catch(() => null) as CheckoutInput | null;
    if (!body?.cartId || !body.addressId) return fail(request, env, context, 400, 'INVALID_CHECKOUT', 'cartId and addressId are required.');
    try {
      return ok(request, env, context, await checkout(env, body, context.scenario), 201);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'CHECKOUT_FAILED';
      return fail(request, env, context, code.endsWith('_NOT_FOUND') ? 404 : 409, code, 'Checkout could not be completed.');
    }
  }

  const orderMatch = path.match(/^\/api\/v1\/orders\/([^/]+)$/);
  if (request.method === 'GET' && orderMatch) {
    const order = await getJsonRow<Order>(env, 'orders', decodeURIComponent(orderMatch[1]!));
    return order ? ok(request, env, context, order) : fail(request, env, context, 404, 'ORDER_NOT_FOUND', 'Order was not found.');
  }

  const customerMatch = path.match(/^\/api\/v1\/customers\/([^/]+)$/);
  if (request.method === 'GET' && customerMatch) {
    const customer = await getJsonRow<Customer>(env, 'customers', decodeURIComponent(customerMatch[1]!));
    return customer ? ok(request, env, context, customer) : fail(request, env, context, 404, 'CUSTOMER_NOT_FOUND', 'Customer was not found.');
  }

  if (request.method === 'GET' && path === '/api/v1/promotions') {
    return ok(request, env, context, await promotions(env));
  }

  const threadMatch = path.match(/^\/api\/v1\/chat\/threads\/([^/]+)$/);
  if (request.method === 'GET' && threadMatch) {
    const thread = await getJsonRow<ChatThread>(env, 'chat_threads', decodeURIComponent(threadMatch[1]!));
    return thread ? ok(request, env, context, thread) : fail(request, env, context, 404, 'THREAD_NOT_FOUND', 'Chat thread was not found.');
  }

  const messagesMatch = path.match(/^\/api\/v1\/chat\/threads\/([^/]+)\/messages$/);
  if (messagesMatch && request.method === 'GET') {
    const threadId = decodeURIComponent(messagesMatch[1]!);
    const thread = await getJsonRow<ChatThread>(env, 'chat_threads', threadId);
    return thread ? ok(request, env, context, await listMessages(env, threadId)) : fail(request, env, context, 404, 'THREAD_NOT_FOUND', 'Chat thread was not found.');
  }

  if (messagesMatch && request.method === 'POST') {
    const threadId = decodeURIComponent(messagesMatch[1]!);
    const body = await request.json().catch(() => null) as SendChatMessageInput | null;
    if (!body?.threadId || !body.senderId || !body.senderRole || !body.clientMessageId) {
      return fail(request, env, context, 400, 'INVALID_MESSAGE', 'threadId, senderId, senderRole, body and clientMessageId are required.');
    }
    try {
      return ok(request, env, context, await sendMessage(env, threadId, body), 201);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'MESSAGE_FAILED';
      return fail(request, env, context, code === 'THREAD_NOT_FOUND' ? 404 : 400, code, 'Message could not be persisted.');
    }
  }

  if (path.startsWith('/ws/chat/')) {
    return fail(request, env, context, 426, 'REALTIME_NOT_ENABLED', 'Realtime chat is implemented in WBS-09; HTTP history is already persistent.');
  }

  return fail(request, env, context, 404, 'NOT_FOUND', 'Route was not found.');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handle(request, env);
    } catch (error) {
      const context = await makeContext(env).catch(() => ({ requestId: crypto.randomUUID(), scenario: 'unknown' }));
      console.error('Unhandled BeeECOM API error', { requestId: context.requestId, error });
      return fail(request, env, context, 500, 'INTERNAL_ERROR', 'Unexpected API error.');
    }
  },
};
