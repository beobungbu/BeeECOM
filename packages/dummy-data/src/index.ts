import { demoScenarioNames, type DemoScenarioName } from '@beeecom/contracts';
import {
  inventoryState,
  money,
  type Cart,
  type Category,
  type ChatMessage,
  type ChatThread,
  type Customer,
  type DemoPersona,
  type Order,
  type Product,
  type Promotion,
  type ReturnRequest,
  type Review,
} from '@beeecom/domain';

const FIXED_NOW = '2026-09-01T09:00:00.000Z';
const FIXED_LATER = '2026-12-31T23:59:59.000Z';
const IMAGE = (label: string) => `https://placehold.co/900x900/png?text=${encodeURIComponent(label)}`;

export interface DemoDataset {
  scenario: DemoScenarioName;
  seededAt: string;
  categories: Category[];
  products: Product[];
  customers: Customer[];
  carts: Cart[];
  promotions: Promotion[];
  orders: Order[];
  reviews: Review[];
  returns: ReturnRequest[];
  chatThreads: ChatThread[];
  chatMessages: ChatMessage[];
  personas: DemoPersona[];
}

function variant(
  id: string,
  sku: string,
  title: string,
  amount: number,
  quantity: number,
  optionValues: Record<string, string>,
) {
  return {
    id,
    sku,
    title,
    price: money(amount),
    optionValues,
    inventoryQuantity: quantity,
    inventoryState: inventoryState(quantity),
  };
}

function baseDataset(): DemoDataset {
  const categories: Category[] = [
    { id: 'cat-apparel', slug: 'apparel', name: 'Apparel', description: 'Everyday essentials with deterministic demo inventory.' },
    { id: 'cat-footwear', slug: 'footwear', name: 'Footwear', description: 'Shoes used to exercise size and stock variants.' },
    { id: 'cat-accessories', slug: 'accessories', name: 'Accessories', description: 'Small goods for cart and promotion combinations.' },
  ];

  const products: Product[] = [
    {
      id: 'prod-cloud-tee',
      slug: 'cloud-tee',
      title: 'Cloud Tee',
      subtitle: 'Soft heavyweight cotton',
      description: 'A neutral product fixture with size and color variants for BeeUI storefront validation.',
      categoryIds: ['cat-apparel'],
      tags: ['featured', 'new'],
      images: [{ id: 'img-cloud-tee', url: IMAGE('Cloud Tee'), alt: 'Cloud Tee' }],
      options: [
        { id: 'opt-color', name: 'Color', values: [{ id: 'black', label: 'Black' }, { id: 'sand', label: 'Sand' }] },
        { id: 'opt-size', name: 'Size', values: [{ id: 's', label: 'S' }, { id: 'm', label: 'M' }, { id: 'l', label: 'L' }] },
      ],
      variants: [
        variant('var-cloud-black-s', 'CLOUD-BLK-S', 'Black / S', 3200, 18, { Color: 'Black', Size: 'S' }),
        variant('var-cloud-black-m', 'CLOUD-BLK-M', 'Black / M', 3200, 4, { Color: 'Black', Size: 'M' }),
        variant('var-cloud-sand-l', 'CLOUD-SND-L', 'Sand / L', 3200, 0, { Color: 'Sand', Size: 'L' }),
      ],
      rating: 4.7,
      reviewCount: 128,
      featured: true,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    },
    {
      id: 'prod-trail-runner',
      slug: 'trail-runner',
      title: 'Trail Runner',
      subtitle: 'Daily technical sneaker',
      description: 'Footwear fixture with several sizes and a compare-at price.',
      categoryIds: ['cat-footwear'],
      tags: ['featured', 'sale'],
      images: [{ id: 'img-trail-runner', url: IMAGE('Trail Runner'), alt: 'Trail Runner sneaker' }],
      options: [{ id: 'opt-shoe-size', name: 'Size', values: [{ id: '40', label: '40' }, { id: '41', label: '41' }, { id: '42', label: '42' }] }],
      variants: [
        { ...variant('var-trail-40', 'TRAIL-40', '40', 8900, 12, { Size: '40' }), compareAtPrice: money(10900) },
        { ...variant('var-trail-41', 'TRAIL-41', '41', 8900, 7, { Size: '41' }), compareAtPrice: money(10900) },
        { ...variant('var-trail-42', 'TRAIL-42', '42', 8900, 2, { Size: '42' }), compareAtPrice: money(10900) },
      ],
      rating: 4.5,
      reviewCount: 74,
      featured: true,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    },
    {
      id: 'prod-field-pack',
      slug: 'field-pack',
      title: 'Field Pack',
      subtitle: 'Compact 18L day pack',
      description: 'Accessory fixture used in wishlist, recently viewed, and mixed carts.',
      categoryIds: ['cat-accessories'],
      tags: ['bestseller'],
      images: [{ id: 'img-field-pack', url: IMAGE('Field Pack'), alt: 'Field Pack backpack' }],
      options: [],
      variants: [variant('var-field-pack', 'FIELD-18L', 'Default', 6400, 22, {})],
      rating: 4.8,
      reviewCount: 211,
      featured: false,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    },
    {
      id: 'prod-studio-cap',
      slug: 'studio-cap',
      title: 'Studio Cap',
      subtitle: 'Low-profile cotton cap',
      description: 'Simple one-variant product for baseline card and cart states.',
      categoryIds: ['cat-accessories'],
      tags: ['new'],
      images: [{ id: 'img-studio-cap', url: IMAGE('Studio Cap'), alt: 'Studio Cap' }],
      options: [],
      variants: [variant('var-studio-cap', 'CAP-001', 'Default', 2400, 30, {})],
      rating: 4.2,
      reviewCount: 33,
      featured: false,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    },
  ];

  const defaultAddress = {
    id: 'addr-ava-home',
    label: 'Home',
    fullName: 'Ava Nguyen',
    phone: '+1 415 555 0112',
    line1: '101 Market Street',
    city: 'San Francisco',
    region: 'CA',
    postalCode: '94105',
    countryCode: 'US',
    isDefault: true,
  };

  const customers: Customer[] = [
    {
      id: 'cust-ava',
      email: 'ava@example.test',
      displayName: 'Ava Nguyen',
      tier: 'standard',
      addresses: [defaultAddress],
      lifetimeValue: money(28400),
      createdAt: '2026-01-15T10:00:00.000Z',
    },
    {
      id: 'cust-minh',
      email: 'minh@example.test',
      displayName: 'Minh Tran',
      tier: 'vip',
      addresses: [{ ...defaultAddress, id: 'addr-minh-home', fullName: 'Minh Tran' }],
      lifetimeValue: money(148900),
      createdAt: '2025-06-10T10:00:00.000Z',
    },
  ];

  const carts: Cart[] = [
    {
      id: 'cart-ava',
      customerId: 'cust-ava',
      lines: [{ id: 'cartline-ava-1', productId: 'prod-cloud-tee', variantId: 'var-cloud-black-s', quantity: 1, unitPrice: money(3200) }],
      updatedAt: FIXED_NOW,
    },
  ];

  const promotions: Promotion[] = [
    {
      id: 'promo-welcome10',
      code: 'WELCOME10',
      title: 'Welcome 10%',
      description: 'Demo promotion used to exercise coupon states.',
      kind: 'percentage',
      value: 10,
      active: true,
      startsAt: '2026-01-01T00:00:00.000Z',
      endsAt: FIXED_LATER,
    },
    {
      id: 'promo-15off',
      code: 'TAKE15',
      title: '$15 off',
      description: 'Fixed discount fixture.',
      kind: 'fixed',
      value: 1500,
      active: false,
      startsAt: '2026-01-01T00:00:00.000Z',
      endsAt: FIXED_LATER,
    },
  ];

  const orders: Order[] = [
    {
      id: 'order-1001',
      number: '#1001',
      customerId: 'cust-ava',
      lines: [{ id: 'orderline-1001-1', productId: 'prod-field-pack', variantId: 'var-field-pack', title: 'Field Pack', variantTitle: 'Default', quantity: 1, unitPrice: money(6400) }],
      subtotal: money(6400),
      discount: money(0),
      shipping: money(900),
      tax: money(512),
      total: money(7812),
      state: 'placed',
      paymentState: 'paid',
      fulfillmentState: 'shipped',
      shippingAddress: defaultAddress,
      placedAt: '2026-08-30T12:00:00.000Z',
      updatedAt: FIXED_NOW,
    },
  ];

  const reviews: Review[] = [
    {
      id: 'review-cloud-1',
      productId: 'prod-cloud-tee',
      customerId: 'cust-ava',
      rating: 5,
      title: 'Great everyday tee',
      body: 'Soft fabric and the fit matched the size guide.',
      status: 'published',
      createdAt: '2026-08-20T10:00:00.000Z',
    },
  ];

  const chatThreads: ChatThread[] = [
    {
      id: 'thread-ava-1',
      customerId: 'cust-ava',
      subject: 'Where is order #1001?',
      status: 'open',
      assignedAgentId: 'agent-sam',
      unreadByCustomer: 0,
      unreadByAgent: 1,
      createdAt: '2026-09-01T08:50:00.000Z',
      updatedAt: FIXED_NOW,
    },
  ];

  const chatMessages: ChatMessage[] = [
    {
      id: 'msg-ava-1',
      threadId: 'thread-ava-1',
      senderId: 'cust-ava',
      senderRole: 'customer',
      body: 'Hi, can you check the latest status of order #1001?',
      sentAt: '2026-09-01T08:55:00.000Z',
      clientMessageId: 'seed-client-1',
    },
  ];

  const personas: DemoPersona[] = [
    { id: 'persona-customer', label: 'Ava — customer', role: 'customer', customerId: 'cust-ava' },
    { id: 'persona-vip', label: 'Minh — VIP customer', role: 'customer', customerId: 'cust-minh' },
    { id: 'persona-support', label: 'Sam — support agent', role: 'support-agent', agentId: 'agent-sam' },
    { id: 'persona-merch', label: 'Morgan — merchandiser', role: 'merchandiser', agentId: 'agent-morgan' },
    { id: 'persona-ops', label: 'Riley — operations', role: 'operations-admin', agentId: 'agent-riley' },
  ];

  return {
    scenario: 'healthy',
    seededAt: FIXED_NOW,
    categories,
    products,
    customers,
    carts,
    promotions,
    orders,
    reviews,
    returns: [],
    chatThreads,
    chatMessages,
    personas,
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function makeLargeCatalog(base: DemoDataset): Product[] {
  const template = base.products[0]!;
  return Array.from({ length: 80 }, (_, index) => {
    const n = index + 1;
    return {
      ...clone(template),
      id: `prod-stress-${String(n).padStart(3, '0')}`,
      slug: `stress-product-${n}`,
      title: `Stress Product ${n}`,
      subtitle: `Deterministic catalog row ${n}`,
      featured: n <= 8,
      rating: 3.5 + (n % 15) / 10,
      reviewCount: n * 3,
      images: [{ id: `img-stress-${n}`, url: IMAGE(`Stress ${n}`), alt: `Stress Product ${n}` }],
      variants: [variant(`var-stress-${n}`, `STRESS-${String(n).padStart(3, '0')}`, 'Default', 1500 + n * 25, (n * 7) % 31, {})],
    };
  });
}

export function createDemoDataset(scenario: DemoScenarioName = 'healthy'): DemoDataset {
  if (!demoScenarioNames.includes(scenario)) {
    throw new Error(`Unknown demo scenario: ${scenario}`);
  }

  const data = baseDataset();
  data.scenario = scenario;

  switch (scenario) {
    case 'healthy':
      break;
    case 'sale-campaign':
      data.promotions[1] = { ...data.promotions[1]!, active: true };
      data.products = data.products.map((product) => ({ ...product, tags: [...new Set([...product.tags, 'sale'])] }));
      break;
    case 'low-stock':
      data.products = data.products.map((product) => ({
        ...product,
        variants: product.variants.map((item, index) => ({
          ...item,
          inventoryQuantity: index === 0 ? 2 : item.inventoryQuantity,
          inventoryState: index === 0 ? 'low-stock' : item.inventoryState,
        })),
      }));
      break;
    case 'payment-failed':
      data.orders[0] = { ...data.orders[0]!, paymentState: 'failed', fulfillmentState: 'unfulfilled' };
      break;
    case 'delayed-shipment':
      data.orders[0] = { ...data.orders[0]!, fulfillmentState: 'processing' };
      break;
    case 'return-approved':
      data.returns = [{
        id: 'return-1001',
        orderId: 'order-1001',
        customerId: 'cust-ava',
        reason: 'Size was not right',
        state: 'approved',
        requestedAt: '2026-08-31T09:00:00.000Z',
        updatedAt: FIXED_NOW,
      }];
      break;
    case 'vip-customer':
      data.carts[0] = { ...data.carts[0]!, customerId: 'cust-minh' };
      break;
    case 'empty-catalog':
      data.products = [];
      break;
    case 'large-catalog':
      data.products = makeLargeCatalog(data);
      break;
    case 'active-chat':
      data.chatMessages.push({
        id: 'msg-agent-1',
        threadId: 'thread-ava-1',
        senderId: 'agent-sam',
        senderRole: 'support-agent',
        body: 'I found it. The parcel is already with the carrier.',
        sentAt: '2026-09-01T08:58:00.000Z',
        clientMessageId: 'seed-agent-1',
      });
      break;
    case 'unread-chat':
      data.chatThreads[0] = { ...data.chatThreads[0]!, unreadByCustomer: 2, unreadByAgent: 0 };
      break;
    case 'chat-reconnect':
      data.chatMessages.push({
        id: 'msg-reconnect-1',
        threadId: 'thread-ava-1',
        senderId: 'agent-sam',
        senderRole: 'support-agent',
        body: 'This message exists before the client reconnects.',
        sentAt: '2026-09-01T08:59:00.000Z',
        clientMessageId: 'seed-reconnect-1',
      });
      break;
  }

  return data;
}

export function datasetCounts(dataset: DemoDataset): Record<string, number> {
  return {
    categories: dataset.categories.length,
    products: dataset.products.length,
    customers: dataset.customers.length,
    carts: dataset.carts.length,
    promotions: dataset.promotions.length,
    orders: dataset.orders.length,
    reviews: dataset.reviews.length,
    returns: dataset.returns.length,
    chatThreads: dataset.chatThreads.length,
    chatMessages: dataset.chatMessages.length,
    personas: dataset.personas.length,
  };
}

export { FIXED_NOW as demoSeedTimestamp };
