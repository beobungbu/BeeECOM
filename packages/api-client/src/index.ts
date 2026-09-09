import type {
  ApiResponse,
  CatalogQuery,
  CheckoutInput,
  DemoResetInput,
  DemoResetResult,
  Page,
  SendChatMessageInput,
} from '@beeecom/contracts';
import type { Cart, ChatMessage, ChatThread, Customer, DemoPersona, Order, Product, Promotion } from '@beeecom/domain';

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

function encodeQuery(input: CatalogQuery): string {
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
        return request<Page<Product>>(`/api/v1/catalog/products${encodeQuery(query)}`);
      },
      getProduct(id: string) {
        return request<Product>(`/api/v1/catalog/products/${encodeURIComponent(id)}`);
      },
    },
    carts: {
      get(id: string) {
        return request<Cart>(`/api/v1/cart/${encodeURIComponent(id)}`);
      },
    },
    checkout(input: CheckoutInput) {
      return request<Order>('/api/v1/checkout', { method: 'POST', body: JSON.stringify(input) });
    },
    orders: {
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
