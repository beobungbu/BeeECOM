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

export interface ApiMeta { requestId: string; scenario: string }
export interface ApiSuccess<T> { ok: true; data: T; meta: ApiMeta }
export interface ApiFailure { ok: false; error: { code: string; message: string; details?: Record<string, unknown> }; meta: ApiMeta }
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
export interface Page<T> { items: T[]; page: number; pageSize: number; total: number; hasNextPage: boolean }

export interface CatalogQuery {
  q?: string | undefined;
  category?: string | undefined;
  tags?: string[] | undefined;
  sort?: 'featured' | 'price-asc' | 'price-desc' | 'rating' | 'newest' | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}
export interface CartAddLineInput { variantId: string; quantity: number }
export interface CartApplyCouponInput { code: string }
export interface WishlistAddItemInput { productId: string }
export interface CheckoutInput { cartId: string; addressId: string; paymentScenario?: 'success' | 'failure' | undefined }
export interface OrderQuery { customerId?: string | undefined; page?: number | undefined; pageSize?: number | undefined }
export interface ReviewQuery { productId?: string | undefined; customerId?: string | undefined }
export interface ChatThreadQuery { customerId?: string | undefined; status?: 'open' | 'closed' | undefined; page?: number | undefined; pageSize?: number | undefined }
export interface CreateChatThreadInput { customerId: string; subject: string; assignedAgentId?: string | undefined }
export interface MarkChatReadInput { readerRole: 'customer' | 'support-agent' }
export interface CreateReviewInput { productId: string; customerId: string; rating: 1 | 2 | 3 | 4 | 5; title: string; body: string }
export interface CreateReturnInput { orderId: string; customerId: string; reason: string }
export interface SendChatMessageInput { threadId: string; senderId: string; senderRole: 'customer' | 'support-agent'; body: string; clientMessageId: string }

export interface AdminProductUpdateInput {
  title?: string | undefined;
  subtitle?: string | undefined;
  description?: string | undefined;
  featured?: boolean | undefined;
  tags?: string[] | undefined;
}
export interface AdminInventoryAdjustInput { variantId: string; adjustment: number; reason: string }
export interface AdminPromotionUpdateInput {
  title?: string | undefined;
  description?: string | undefined;
  active?: boolean | undefined;
  startsAt?: string | undefined;
  endsAt?: string | undefined;
}
export type AdminOrderAction = 'process' | 'ship' | 'deliver' | 'cancel' | 'refund';
export interface AdminOrderTransitionInput { action: AdminOrderAction }
export type AdminReturnAction = 'approve' | 'reject' | 'refund';
export interface AdminReturnTransitionInput { action: AdminReturnAction }
export interface AdminReviewModerationInput { status: 'published' | 'rejected' }

export interface ChatMessagePersistedEvent { type: 'message.persisted'; threadId: string; message: ChatMessage }
export type ChatRealtimeEvent = ChatMessagePersistedEvent;
export function isChatRealtimeEvent(value: unknown): value is ChatRealtimeEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Record<string, unknown>;
  if (event.type !== 'message.persisted' || typeof event.threadId !== 'string') return false;
  const message = event.message;
  if (!message || typeof message !== 'object') return false;
  const record = message as Record<string, unknown>;
  return typeof record.id === 'string'
    && record.threadId === event.threadId
    && typeof record.senderId === 'string'
    && (record.senderRole === 'customer' || record.senderRole === 'support-agent')
    && typeof record.body === 'string'
    && typeof record.sentAt === 'string';
}

export interface DemoResetInput { scenario: DemoScenarioName }
export interface DemoResetResult { scenario: DemoScenarioName; seededAt: string; counts: Record<string, number> }
export const demoScenarioNames = [
  'healthy','sale-campaign','low-stock','payment-failed','delayed-shipment','return-approved','vip-customer',
  'empty-catalog','large-catalog','active-chat','unread-chat','chat-reconnect',
] as const;
export type DemoScenarioName = (typeof demoScenarioNames)[number];
export function isDemoScenarioName(value: string): value is DemoScenarioName {
  return (demoScenarioNames as readonly string[]).includes(value);
}

export interface ApiContractMap {
  'GET /api/v1/catalog/categories': { response: Category[] };
  'GET /api/v1/catalog/products': { query: CatalogQuery; response: Page<Product> };
  'GET /api/v1/catalog/products/:id': { response: Product };
  'GET /api/v1/cart/:id': { response: Cart };
  'POST /api/v1/cart/:id/lines': { body: CartAddLineInput; response: Cart };
  'PATCH /api/v1/cart/:id/coupon': { body: CartApplyCouponInput; response: Cart };
  'GET /api/v1/wishlist/:customerId': { response: Wishlist };
  'POST /api/v1/wishlist/:customerId/items': { body: WishlistAddItemInput; response: Wishlist };
  'DELETE /api/v1/wishlist/:customerId/items/:productId': { response: Wishlist };
  'POST /api/v1/checkout': { body: CheckoutInput; response: Order };
  'GET /api/v1/orders': { query: OrderQuery; response: Page<Order> };
  'GET /api/v1/orders/:id': { response: Order };
  'GET /api/v1/customers/:id': { response: Customer };
  'GET /api/v1/reviews': { query: ReviewQuery; response: Review[] };
  'POST /api/v1/reviews': { body: CreateReviewInput; response: Review };
  'GET /api/v1/promotions': { response: Promotion[] };
  'POST /api/v1/returns': { body: CreateReturnInput; response: ReturnRequest };
  'GET /api/v1/chat/threads': { query: ChatThreadQuery; response: Page<ChatThread> };
  'POST /api/v1/chat/threads': { body: CreateChatThreadInput; response: ChatThread };
  'GET /api/v1/chat/threads/:id': { response: ChatThread };
  'PATCH /api/v1/chat/threads/:id/read': { body: MarkChatReadInput; response: ChatThread };
  'GET /api/v1/chat/threads/:id/messages': { response: ChatMessage[] };
  'POST /api/v1/chat/threads/:id/messages': { body: SendChatMessageInput; response: ChatMessage };

  'PATCH /api/v1/admin/products/:id': { body: AdminProductUpdateInput; response: Product };
  'POST /api/v1/admin/products/:id/inventory-adjustments': { body: AdminInventoryAdjustInput; response: Product };
  'PATCH /api/v1/admin/promotions/:id': { body: AdminPromotionUpdateInput; response: Promotion };
  'PATCH /api/v1/admin/orders/:id': { body: AdminOrderTransitionInput; response: Order };
  'GET /api/v1/admin/customers': { response: Customer[] };
  'GET /api/v1/admin/returns': { response: ReturnRequest[] };
  'PATCH /api/v1/admin/returns/:id': { body: AdminReturnTransitionInput; response: ReturnRequest };
  'GET /api/v1/admin/reviews': { response: Review[] };
  'PATCH /api/v1/admin/reviews/:id': { body: AdminReviewModerationInput; response: Review };

  'GET /api/v1/demo/personas': { response: DemoPersona[] };
  'GET /api/v1/demo/scenarios': { response: readonly DemoScenarioName[] };
  'POST /api/v1/demo/reset': { body: DemoResetInput; response: DemoResetResult };
}
