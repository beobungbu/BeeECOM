import type {
  ApiResponse,
  CartAddLineInput,
  CartApplyCouponInput,
  CatalogQuery,
  ChatThreadQuery,
  CheckoutInput,
  DemoResetInput,
  DemoResetResult,
  OrderQuery,
  Page,
  SendChatMessageInput,
} from '@beeecom/contracts';
import type {
  Cart,
  ChatMessage,
  ChatThread,
  Customer,
  DemoPersona,
  Order,
  Product,
  Promotion,
} from '@beeecom/domain';

export class BeeEcomApiError extends Error {
  readonly code: string;
  readonly requestId: string;

  constructor(code: string, message: string, requestId: string) {
    super(message);
    this.name = 'BeeEcomApiError';
    this.code = code;
    this.requestId = requestId;
  }
}

export interface BeeEcomClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  getAccessToken?: () => string | undefined | Promise<string | undefined>;
}

function encodeCatalogQuery(input: CatalogQuery): string {
  const params = new URLSearchParams();
  if (input.q) params.set('q', input.q);
  if (input.category) params.set('category', input.category);
  for (const tag of input.tags ?? []) params.append('tag', tag);
  if (input.sort) params.set('sort', input.sort);
  if (input.page) params.set('page', String(input.page));
  if (input.pageSize) params.set('pageSize', String(input.pageSize));
  const query = params.toString();
  return query ? `?${query}` : '';
}

function encodeOrderQuery(input: OrderQuery): string {
  const params = new URLSearchParams();
  if (input.customerId) params.set('customerId', input.customerId);
  if (input.page) params.set('page', String(input.page));
  if (input.pageSize) params.set('pageSize', String(input.pageSize));
  const query = params.toString();
  return query ? `?${query}` : '';
}

function encodeChatThreadQuery(input: ChatThreadQuery): string {
  const params = new URLSearchParams();
  if (input.customerId) params.set('customerId', input.customerId);
  if (input.status) params.set('status', input.status);
  if (input.page) params.set('page', String(input.page));
  if (input.pageSize) params.set('pageSize', String(input.pageSize));
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function toWebSocketUrl(baseUrl: string, path: string): string {
  const url = new URL(path, `${baseUrl.replace(/\/$/, '')}/`);
  if (url.protocol === 'http:') url.protocol = 'ws:';
  else if (url.protocol === 'https:') url.protocol = 'wss:';
  else throw new Error(`Unsupported API URL protocol: ${url.protocol}`);
  return url.toString();
}

export function createBeeEcomClient(options: BeeEcomClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/$/, '');

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await options.getAccessToken?.();
    const headers = new Headers(init?.headers);
    headers.set('accept', 'application/json');
    if (init?.body) headers.set('content-type', 'application/json');
    if (token) headers.set('authorization', `Bearer ${token}`);

    const response = await fetchImpl(`${baseUrl}${path}`, { ...init, headers });
    const payload = (await response.json()) as ApiResponse<T>;
    if (!payload.ok) {
      throw new BeeEcomApiError(payload.error.code, payload.error.message, payload.meta.requestId);
    }
    return payload.data;
  }

  return {
    catalog: {
      listProducts(query: CatalogQuery = {}) {
        return request<Page<Product>>(`/api/v1/catalog/products${encodeCatalogQuery(query)}`);
      },
      getProduct(id: string) {
        return request<Product>(`/api/v1/catalog/products/${encodeURIComponent(id)}`);
      },
    },
    carts: {
      get(id: string) {
        return request<Cart>(`/api/v1/cart/${encodeURIComponent(id)}`);
      },
      addLine(id: string, input: CartAddLineInput) {
        return request<Cart>(`/api/v1/cart/${encodeURIComponent(id)}/lines`, {
          method: 'POST',
          body: JSON.stringify(input),
        });
      },
      applyCoupon(id: string, input: CartApplyCouponInput) {
        return request<Cart>(`/api/v1/cart/${encodeURIComponent(id)}/coupon`, {
          method: 'PATCH',
          body: JSON.stringify(input),
        });
      },
    },
    checkout(input: CheckoutInput) {
      return request<Order>('/api/v1/checkout', { method: 'POST', body: JSON.stringify(input) });
    },
    orders: {
      list(query: OrderQuery = {}) {
        return request<Page<Order>>(`/api/v1/orders${encodeOrderQuery(query)}`);
      },
      get(id: string) {
        return request<Order>(`/api/v1/orders/${encodeURIComponent(id)}`);
      },
    },
    customers: {
      get(id: string) {
        return request<Customer>(`/api/v1/customers/${encodeURIComponent(id)}`);
      },
    },
    promotions: {
      list() {
        return request<Promotion[]>('/api/v1/promotions');
      },
    },
    chat: {
      listThreads(query: ChatThreadQuery = {}) {
        return request<Page<ChatThread>>(`/api/v1/chat/threads${encodeChatThreadQuery(query)}`);
      },
      getThread(id: string) {
        return request<ChatThread>(`/api/v1/chat/threads/${encodeURIComponent(id)}`);
      },
      listMessages(id: string) {
        return request<ChatMessage[]>(`/api/v1/chat/threads/${encodeURIComponent(id)}/messages`);
      },
      sendMessage(id: string, input: SendChatMessageInput) {
        return request<ChatMessage>(`/api/v1/chat/threads/${encodeURIComponent(id)}/messages`, {
          method: 'POST',
          body: JSON.stringify(input),
        });
      },
      webSocketUrl(id: string) {
        return toWebSocketUrl(baseUrl, `/ws/chat/${encodeURIComponent(id)}`);
      },
    },
    demo: {
      personas() {
        return request<DemoPersona[]>('/api/v1/demo/personas');
      },
      scenarios() {
        return request<readonly string[]>('/api/v1/demo/scenarios');
      },
      reset(input: DemoResetInput) {
        return request<DemoResetResult>('/api/v1/demo/reset', { method: 'POST', body: JSON.stringify(input) });
      },
    },
  };
}

export type BeeEcomClient = ReturnType<typeof createBeeEcomClient>;
