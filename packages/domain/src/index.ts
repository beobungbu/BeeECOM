export type Id = string;
export type IsoDateTime = string;
export type CurrencyCode = 'USD' | 'VND';

export interface Money {
  amount: number;
  currency: CurrencyCode;
}

export interface ImageAsset {
  id: Id;
  url: string;
  alt: string;
}

export interface Category {
  id: Id;
  slug: string;
  name: string;
  description?: string;
  image?: ImageAsset;
}

export interface ProductOptionValue {
  id: Id;
  label: string;
}

export interface ProductOption {
  id: Id;
  name: string;
  values: ProductOptionValue[];
}

export type InventoryState = 'in-stock' | 'low-stock' | 'out-of-stock';

export interface ProductVariant {
  id: Id;
  sku: string;
  title: string;
  price: Money;
  compareAtPrice?: Money;
  optionValues: Record<string, string>;
  inventoryQuantity: number;
  inventoryState: InventoryState;
  image?: ImageAsset;
}

export interface Product {
  id: Id;
  slug: string;
  title: string;
  subtitle?: string;
  description: string;
  categoryIds: Id[];
  tags: string[];
  images: ImageAsset[];
  options: ProductOption[];
  variants: ProductVariant[];
  rating: number;
  reviewCount: number;
  featured: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface Address {
  id: Id;
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
  isDefault: boolean;
}

export type CustomerTier = 'standard' | 'vip';

export interface Customer {
  id: Id;
  email: string;
  displayName: string;
  avatarUrl?: string;
  tier: CustomerTier;
  addresses: Address[];
  lifetimeValue: Money;
  createdAt: IsoDateTime;
}

export interface CartLine {
  id: Id;
  productId: Id;
  variantId: Id;
  quantity: number;
  unitPrice: Money;
}

export interface Cart {
  id: Id;
  customerId: Id;
  lines: CartLine[];
  couponCode?: string;
  updatedAt: IsoDateTime;
}

export type PromotionKind = 'percentage' | 'fixed';

export interface Promotion {
  id: Id;
  code: string;
  title: string;
  description: string;
  kind: PromotionKind;
  value: number;
  active: boolean;
  startsAt: IsoDateTime;
  endsAt: IsoDateTime;
}

export type PaymentState = 'pending' | 'paid' | 'failed' | 'refunded';
export type FulfillmentState = 'unfulfilled' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export type OrderState = 'draft' | 'placed' | 'cancelled' | 'completed';

export interface OrderLine {
  id: Id;
  productId: Id;
  variantId: Id;
  title: string;
  variantTitle: string;
  quantity: number;
  unitPrice: Money;
}

export interface Order {
  id: Id;
  number: string;
  customerId: Id;
  lines: OrderLine[];
  subtotal: Money;
  discount: Money;
  shipping: Money;
  tax: Money;
  total: Money;
  state: OrderState;
  paymentState: PaymentState;
  fulfillmentState: FulfillmentState;
  shippingAddress: Address;
  placedAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface Review {
  id: Id;
  productId: Id;
  customerId: Id;
  rating: 1 | 2 | 3 | 4 | 5;
  title: string;
  body: string;
  status: 'pending' | 'published' | 'rejected';
  createdAt: IsoDateTime;
}

export type ReturnState = 'requested' | 'approved' | 'rejected' | 'refunded';

export interface ReturnRequest {
  id: Id;
  orderId: Id;
  customerId: Id;
  reason: string;
  state: ReturnState;
  requestedAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export type ChatParticipantRole = 'customer' | 'support-agent';

export interface ChatThread {
  id: Id;
  customerId: Id;
  subject: string;
  status: 'open' | 'closed';
  assignedAgentId?: Id;
  unreadByCustomer: number;
  unreadByAgent: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface ChatMessage {
  id: Id;
  threadId: Id;
  senderId: Id;
  senderRole: ChatParticipantRole;
  body: string;
  sentAt: IsoDateTime;
  clientMessageId?: string;
}

export type DemoPersonaRole = 'customer' | 'support-agent' | 'merchandiser' | 'operations-admin' | 'super-admin';

export interface DemoPersona {
  id: Id;
  label: string;
  role: DemoPersonaRole;
  customerId?: Id;
  agentId?: Id;
}

export interface CartTotals {
  subtotal: Money;
  discount: Money;
  shipping: Money;
  tax: Money;
  total: Money;
}

export function money(amount: number, currency: CurrencyCode = 'USD'): Money {
  if (!Number.isInteger(amount)) {
    throw new Error('Money amount must be an integer in minor units.');
  }
  return { amount, currency };
}

export function inventoryState(quantity: number): InventoryState {
  if (quantity <= 0) return 'out-of-stock';
  if (quantity <= 5) return 'low-stock';
  return 'in-stock';
}

export function calculateCartTotals(
  cart: Cart,
  promotion?: Promotion,
  shippingAmount = 900,
  taxRate = 0.08,
): CartTotals {
  const currency = cart.lines[0]?.unitPrice.currency ?? 'USD';
  const subtotalAmount = cart.lines.reduce((sum, line) => sum + line.unitPrice.amount * line.quantity, 0);

  let discountAmount = 0;
  if (promotion?.active) {
    discountAmount = promotion.kind === 'percentage'
      ? Math.floor(subtotalAmount * (promotion.value / 100))
      : Math.min(subtotalAmount, promotion.value);
  }

  const taxableAmount = Math.max(0, subtotalAmount - discountAmount);
  const taxAmount = Math.floor(taxableAmount * taxRate);
  const totalAmount = taxableAmount + shippingAmount + taxAmount;

  return {
    subtotal: money(subtotalAmount, currency),
    discount: money(discountAmount, currency),
    shipping: money(shippingAmount, currency),
    tax: money(taxAmount, currency),
    total: money(totalAmount, currency),
  };
}
