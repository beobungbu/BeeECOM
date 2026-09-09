import type {
  Cart,
  ChatMessage,
  ChatThread,
  Customer,
  DemoPersona,
  Order,
  Product,
  Promotion,
  ReturnRequest,
} from '@beeecom/domain';

export interface ApiMeta {
  requestId: string;
  scenario: string;
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
  meta: ApiMeta;
}

export interface ApiFailure {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta: ApiMeta;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}

export interface CatalogQuery {
  q?: string | undefined;
  category?: string | undefined;
  tags?: string[] | undefined;
  sort?: 'featured' | 'price-asc' | 'price-desc' | 'rating' | 'newest' | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

export interface CartAddLineInput {
  variantId: string;
  quantity: number;
}

export interface CartApplyCouponInput {
  code: string;
}

export interface CheckoutInput {
  cartId: string;
  addressId: string;
  paymentScenario?: 'success' | 'failure' | undefined;
}

export interface OrderQuery {
  customerId?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

export interface ChatThreadQuery {
  customerId?: string | undefined;
  status?: 'open' | 'closed' | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

export interface CreateReviewInput {
  productId: string;
  customerId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  title: string;
  body: string;
}

export interface CreateReturnInput {
  orderId: string;
  customerId: string;
  reason: string;
}

export interface SendChatMessageInput {
  threadId: string;
  senderId: string;
  senderRole: 'customer' | 'support-agent';
  body: string;
  clientMessageId: string;
}

export interface DemoResetInput {
  scenario: DemoScenarioName;
}

export interface DemoResetResult {
  scenario: DemoScenarioName;
  seededAt: string;
  counts: Record<string, number>;
}

export const demoScenarioNames = [
  'healthy',
  'sale-campaign',
  'low-stock',
  'payment-failed',
  'delayed-shipment',
  'return-approved',
  'vip-customer',
  'empty-catalog',
  'large-catalog',
  'active-chat',
  'unread-chat',
  'chat-reconnect',
] as const;

export type DemoScenarioName = (typeof demoScenarioNames)[number];

export function isDemoScenarioName(value: string): value is DemoScenarioName {
  return (demoScenarioNames as readonly string[]).includes(value);
}

export interface ApiContractMap {
  'GET /api/v1/catalog/products': { query: CatalogQuery; response: Page<Product> };
  'GET /api/v1/catalog/products/:id': { response: Product };
  'GET /api/v1/cart/:id': { response: Cart };
  'POST /api/v1/cart/:id/lines': { body: CartAddLineInput; response: Cart };
  'PATCH /api/v1/cart/:id/coupon': { body: CartApplyCouponInput; response: Cart };
  'POST /api/v1/checkout': { body: CheckoutInput; response: Order };
  'GET /api/v1/orders': { query: OrderQuery; response: Page<Order> };
  'GET /api/v1/orders/:id': { response: Order };
  'GET /api/v1/customers/:id': { response: Customer };
  'GET /api/v1/promotions': { response: Promotion[] };
  'POST /api/v1/returns': { body: CreateReturnInput; response: ReturnRequest };
  'GET /api/v1/chat/threads': { query: ChatThreadQuery; response: Page<ChatThread> };
  'GET /api/v1/chat/threads/:id': { response: ChatThread };
  'GET /api/v1/chat/threads/:id/messages': { response: ChatMessage[] };
  'POST /api/v1/chat/threads/:id/messages': { body: SendChatMessageInput; response: ChatMessage };
  'GET /api/v1/demo/personas': { response: DemoPersona[] };
  'GET /api/v1/demo/scenarios': { response: readonly DemoScenarioName[] };
  'POST /api/v1/demo/reset': { body: DemoResetInput; response: DemoResetResult };
}
