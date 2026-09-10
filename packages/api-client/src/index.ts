import { isChatRealtimeEvent } from '@beeecom/contracts';
import type {
  AdminInventoryAdjustInput,
  AdminOrderTransitionInput,
  AdminProductUpdateInput,
  AdminPromotionUpdateInput,
  AdminReturnTransitionInput,
  AdminReviewModerationInput,
  ApiResponse,
  CartAddLineInput,
  CartApplyCouponInput,
  CatalogQuery,
  ChatRealtimeEvent,
  ChatThreadQuery,
  CheckoutInput,
  CreateChatThreadInput,
  CustomerUpdateInput,
  DemoResetInput,
  DemoResetResult,
  MarkChatReadInput,
  OrderQuery,
  Page,
  SendChatMessageInput,
  WishlistAddItemInput,
} from '@beeecom/contracts';
import type {
  Cart,
  Category,
  ChatMessage,
  ChatThread,
  Customer,
  DemoPersona,
  Order,
  Product,
  Promotion,
  ReturnRequest,
  Review,
  Wishlist,
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

export type ChatRealtimeStatus = 'connecting' | 'connected' | 'reconnecting' | 'closed';
export interface ChatRealtimeCallbacks {
  onEvent(event: ChatRealtimeEvent): void;
  onStatus?(status: ChatRealtimeStatus): void;
  onResync?(): void | Promise<void>;
  onError?(error: unknown): void;
}
export interface ChatRealtimeSubscription { close(): void }
export interface BeeEcomClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  webSocketFactory?: (url: string) => WebSocket;
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
  const webSocketFactory = options.webSocketFactory ?? ((url: string) => new WebSocket(url));

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await options.getAccessToken?.();
    const headers = new Headers(init?.headers);
    headers.set('accept', 'application/json');
    if (init?.body) headers.set('content-type', 'application/json');
    if (token) headers.set('authorization', `Bearer ${token}`);
    const response = await fetchImpl(`${baseUrl}${path}`, { ...init, headers });
    const payload = (await response.json()) as ApiResponse<T>;
    if (!payload.ok) throw new BeeEcomApiError(payload.error.code, payload.error.message, payload.meta.requestId);
    return payload.data;
  }

  function subscribeToChat(id: string, callbacks: ChatRealtimeCallbacks): ChatRealtimeSubscription {
    const url = toWebSocketUrl(baseUrl, `/ws/chat/${encodeURIComponent(id)}`);
    const reconnectDelays = [500, 1_000, 2_000, 5_000] as const;
    let socket: WebSocket | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let connectedBefore = false;
    let reconnectAttempt = 0;
    const connect = () => {
      if (stopped) return;
      callbacks.onStatus?.(connectedBefore ? 'reconnecting' : 'connecting');
      socket = webSocketFactory(url);
      socket.onopen = () => {
        const isReconnect = connectedBefore;
        connectedBefore = true;
        reconnectAttempt = 0;
        callbacks.onStatus?.('connected');
        if (isReconnect) Promise.resolve(callbacks.onResync?.()).catch((error) => callbacks.onError?.(error));
      };
      socket.onmessage = (event) => {
        if (typeof event.data !== 'string') return;
        try {
          const parsed = JSON.parse(event.data) as unknown;
          if (isChatRealtimeEvent(parsed) && parsed.threadId === id) callbacks.onEvent(parsed);
        } catch (error) { callbacks.onError?.(error); }
      };
      socket.onerror = (event) => callbacks.onError?.(event);
      socket.onclose = () => {
        if (stopped) { callbacks.onStatus?.('closed'); return; }
        callbacks.onStatus?.('reconnecting');
        const delay = reconnectDelays[Math.min(reconnectAttempt, reconnectDelays.length - 1)]!;
        reconnectAttempt += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
    };
    connect();
    return { close() {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket && socket.readyState < 2) socket.close(1000, 'Subscription closed');
      callbacks.onStatus?.('closed');
    } };
  }

  return {
    catalog: {
      listCategories: () => request<Category[]>('/api/v1/catalog/categories'),
      listProducts: (query: CatalogQuery = {}) => request<Page<Product>>(`/api/v1/catalog/products${encodeCatalogQuery(query)}`),
      getProduct: (id: string) => request<Product>(`/api/v1/catalog/products/${encodeURIComponent(id)}`),
    },
    carts: {
      get: (id: string) => request<Cart>(`/api/v1/cart/${encodeURIComponent(id)}`),
      addLine: (id: string, input: CartAddLineInput) => request<Cart>(`/api/v1/cart/${encodeURIComponent(id)}/lines`, { method: 'POST', body: JSON.stringify(input) }),
      applyCoupon: (id: string, input: CartApplyCouponInput) => request<Cart>(`/api/v1/cart/${encodeURIComponent(id)}/coupon`, { method: 'PATCH', body: JSON.stringify(input) }),
    },
    wishlist: {
      get: (customerId: string) => request<Wishlist>(`/api/v1/wishlist/${encodeURIComponent(customerId)}`),
      add: (customerId: string, input: WishlistAddItemInput) => request<Wishlist>(`/api/v1/wishlist/${encodeURIComponent(customerId)}/items`, { method: 'POST', body: JSON.stringify(input) }),
      remove: (customerId: string, productId: string) => request<Wishlist>(`/api/v1/wishlist/${encodeURIComponent(customerId)}/items/${encodeURIComponent(productId)}`, { method: 'DELETE' }),
    },
    checkout: (input: CheckoutInput) => request<Order>('/api/v1/checkout', { method: 'POST', body: JSON.stringify(input) }),
    orders: {
      list: (query: OrderQuery = {}) => request<Page<Order>>(`/api/v1/orders${encodeOrderQuery(query)}`),
      get: (id: string) => request<Order>(`/api/v1/orders/${encodeURIComponent(id)}`),
    },
    customers: {
      get: (id: string) => request<Customer>(`/api/v1/customers/${encodeURIComponent(id)}`),
      update: (id: string, input: CustomerUpdateInput) => request<Customer>(`/api/v1/customers/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }),
    },
    promotions: { list: () => request<Promotion[]>('/api/v1/promotions') },
    chat: {
      listThreads: (query: ChatThreadQuery = {}) => request<Page<ChatThread>>(`/api/v1/chat/threads${encodeChatThreadQuery(query)}`),
      createThread: (input: CreateChatThreadInput) => request<ChatThread>('/api/v1/chat/threads', { method: 'POST', body: JSON.stringify(input) }),
      getThread: (id: string) => request<ChatThread>(`/api/v1/chat/threads/${encodeURIComponent(id)}`),
      markRead: (id: string, input: MarkChatReadInput) => request<ChatThread>(`/api/v1/chat/threads/${encodeURIComponent(id)}/read`, { method: 'PATCH', body: JSON.stringify(input) }),
      listMessages: (id: string) => request<ChatMessage[]>(`/api/v1/chat/threads/${encodeURIComponent(id)}/messages`),
      sendMessage: (id: string, input: SendChatMessageInput) => request<ChatMessage>(`/api/v1/chat/threads/${encodeURIComponent(id)}/messages`, { method: 'POST', body: JSON.stringify(input) }),
      webSocketUrl: (id: string) => toWebSocketUrl(baseUrl, `/ws/chat/${encodeURIComponent(id)}`),
      subscribe: (id: string, callbacks: ChatRealtimeCallbacks) => subscribeToChat(id, callbacks),
    },
    admin: {
      products: {
        update: (id: string, input: AdminProductUpdateInput) => request<Product>(`/api/v1/admin/products/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }),
        adjustInventory: (id: string, input: AdminInventoryAdjustInput) => request<Product>(`/api/v1/admin/products/${encodeURIComponent(id)}/inventory-adjustments`, { method: 'POST', body: JSON.stringify(input) }),
      },
      promotions: {
        update: (id: string, input: AdminPromotionUpdateInput) => request<Promotion>(`/api/v1/admin/promotions/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }),
      },
      orders: {
        transition: (id: string, input: AdminOrderTransitionInput) => request<Order>(`/api/v1/admin/orders/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }),
      },
      customers: { list: () => request<Customer[]>('/api/v1/admin/customers') },
      returns: {
        list: () => request<ReturnRequest[]>('/api/v1/admin/returns'),
        transition: (id: string, input: AdminReturnTransitionInput) => request<ReturnRequest>(`/api/v1/admin/returns/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }),
      },
      reviews: {
        list: () => request<Review[]>('/api/v1/admin/reviews'),
        moderate: (id: string, input: AdminReviewModerationInput) => request<Review>(`/api/v1/admin/reviews/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }),
      },
    },
    demo: {
      personas: () => request<DemoPersona[]>('/api/v1/demo/personas'),
      scenarios: () => request<readonly string[]>('/api/v1/demo/scenarios'),
      reset: (input: DemoResetInput) => request<DemoResetResult>('/api/v1/demo/reset', { method: 'POST', body: JSON.stringify(input) }),
    },
  };
}

export type BeeEcomClient = ReturnType<typeof createBeeEcomClient>;