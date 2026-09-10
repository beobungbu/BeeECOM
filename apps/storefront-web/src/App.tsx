import { createBeeEcomClient, type ChatRealtimeStatus } from '@beeecom/api-client';
import { formatMoney, ProductGrid } from '@beeecom/app-ui';
import {
  calculateCartTotals,
  type Cart,
  type ChatMessage,
  type Customer,
  type Order,
  type Product,
  type Promotion,
} from '@beeecom/domain';
import {
  Badge,
  Box,
  Button,
  Card,
  Input,
  Screen,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Text,
} from '@beemvp/beeui-ui';
import * as React from 'react';

const api = createBeeEcomClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8787',
});

const CART_ID = 'cart-ava';
const CUSTOMER_ID = 'cust-ava';
const THREAD_ID = 'thread-ava-1';

function appendMessage(messages: ChatMessage[], message: ChatMessage): ChatMessage[] {
  return messages.some((item) => item.id === message.id) ? messages : [...messages, message];
}

function navigate(path: string) {
  window.location.assign(path);
}

export function App() {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [selected, setSelected] = React.useState<Product | null>(null);
  const [variantId, setVariantId] = React.useState<string | undefined>();
  const [quantity, setQuantity] = React.useState(1);
  const [cart, setCart] = React.useState<Cart | null>(null);
  const [customer, setCustomer] = React.useState<Customer | null>(null);
  const [promotions, setPromotions] = React.useState<Promotion[]>([]);
  const [lastOrder, setLastOrder] = React.useState<Order | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [chatStatus, setChatStatus] = React.useState<ChatRealtimeStatus>('connecting');
  const [coupon, setCoupon] = React.useState('WELCOME10');
  const [chatDraft, setChatDraft] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const refreshChatHistory = React.useCallback(async () => {
    const [history] = await Promise.all([
      api.chat.listMessages(THREAD_ID),
      api.chat.markRead(THREAD_ID, { readerRole: 'customer' }),
    ]);
    setMessages(history);
  }, []);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [catalog, currentCart, currentCustomer, promoList, orderPage, chatHistory] = await Promise.all([
        api.catalog.listProducts({ sort: 'featured', pageSize: 12 }),
        api.carts.get(CART_ID),
        api.customers.get(CUSTOMER_ID),
        api.promotions.list(),
        api.orders.list({ customerId: CUSTOMER_ID, pageSize: 1 }),
        api.chat.listMessages(THREAD_ID),
      ]);
      await api.chat.markRead(THREAD_ID, { readerRole: 'customer' });
      setProducts(catalog.items);
      setCart(currentCart);
      setCustomer(currentCustomer);
      setPromotions(promoList);
      setLastOrder(orderPage.items[0] ?? null);
      setMessages(chatHistory);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load the shop.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    const subscription = api.chat.subscribe(THREAD_ID, {
      onEvent(event) {
        setMessages((current) => appendMessage(current, event.message));
        if (event.message.senderRole === 'support-agent') {
          void api.chat.markRead(THREAD_ID, { readerRole: 'customer' })
            .catch((cause) => console.warn('Unable to persist storefront customer read state', cause));
        }
      },
      onStatus: setChatStatus,
      onResync: refreshChatHistory,
      onError(cause) {
        console.warn('Customer support realtime transport error', cause);
      },
    });
    return () => subscription.close();
  }, [refreshChatHistory]);

  const chooseProduct = React.useCallback((product: Product) => {
    setSelected(product);
    setVariantId(product.variants.find((variant) => variant.inventoryQuantity > 0)?.id ?? product.variants[0]?.id);
    setQuantity(1);
    setNotice(null);
  }, []);

  const selectedVariant = selected?.variants.find((variant) => variant.id === variantId);
  const appliedPromotion = cart?.couponCode
    ? promotions.find((promotion) => promotion.active && promotion.code === cart.couponCode)
    : undefined;
  const totals = cart && cart.lines.length > 0 ? calculateCartTotals(cart, appliedPromotion) : null;
  const chatStatusLabel = chatStatus === 'connected' ? 'Online' : chatStatus === 'closed' ? 'Offline' : 'Connecting…';

  async function addToCart() {
    if (!selectedVariant || selectedVariant.inventoryQuantity <= 0) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await api.carts.addLine(CART_ID, { variantId: selectedVariant.id, quantity });
      setCart(updated);
      setNotice(`${selected?.title ?? 'Product'} added to cart.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to add this variant.');
    } finally {
      setBusy(false);
    }
  }

  async function applyCoupon() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await api.carts.applyCoupon(CART_ID, { code: coupon });
      setCart(updated);
      setNotice(updated.couponCode ? `Coupon ${updated.couponCode} applied.` : 'Coupon removed.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Coupon could not be applied.');
    } finally {
      setBusy(false);
    }
  }

  async function sendSupportMessage() {
    const body = chatDraft.trim();
    if (!body) return;
    setBusy(true);
    setError(null);
    try {
      const message = await api.chat.sendMessage(THREAD_ID, {
        threadId: THREAD_ID,
        senderId: CUSTOMER_ID,
        senderRole: 'customer',
        body,
        clientMessageId: `web-customer-${Date.now()}`,
      });
      setMessages((current) => appendMessage(current, message));
      setChatDraft('');
      setNotice('Message sent to support.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Support message failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Box className="mx-auto w-full max-w-screen-xl gap-8 p-4 md:p-8">
        <Box className="gap-4 py-8 md:py-12">
          <Box className="max-w-3xl gap-2">
            <Text variant="title">BeeECOM</Text>
            <Text variant="body">
              Everyday essentials for work, travel and the moments in between.
            </Text>
          </Box>
          <Box className="flex-row flex-wrap gap-3">
            <Button onPress={() => navigate('/conformance/collections')}>Shop collections</Button>
            <Button variant="outline" onPress={() => navigate('/conformance/account')}>My account</Button>
            {selected ? (
              <Button variant="ghost" onPress={() => setSelected(null)}>Close product details</Button>
            ) : null}
          </Box>
        </Box>

        {notice ? (
          <Card className="p-4">
            <Text variant="body">{notice}</Text>
          </Card>
        ) : null}

        {loading ? (
          <Card className="gap-2 p-6">
            <Text variant="title">Loading shop…</Text>
            <Text variant="body">Getting your products, cart and account ready.</Text>
          </Card>
        ) : null}

        {error ? (
          <Card className="gap-3 p-6">
            <Text variant="title">Something went wrong</Text>
            <Text variant="body">{error}</Text>
            <Button onPress={() => void refresh()}>Try again</Button>
          </Card>
        ) : null}

        {!loading && products.length === 0 ? (
          <Card className="gap-2 p-6">
            <Text variant="title">No products</Text>
            <Text variant="body">New arrivals will appear here as soon as they are available.</Text>
          </Card>
        ) : null}

        {!loading && products.length > 0 ? (
          <Box className="gap-4">
            <Box className="gap-1">
              <Text variant="title">Catalog</Text>
              <Text variant="body">Explore featured products, colors and sizes selected for the current collection.</Text>
            </Box>
            <ProductGrid products={products} onProductPress={chooseProduct} />
          </Box>
        ) : null}

        {selected ? (
          <Card className="gap-4 p-5 md:p-6">
            <Box className="gap-1">
              <Text variant="title">{selected.title}</Text>
              <Text variant="body">{selected.description}</Text>
              <Text variant="body">★ {selected.rating.toFixed(1)} · {selected.reviewCount} reviews</Text>
            </Box>

            <Box className="gap-2">
              <Text variant="body">Variant</Text>
              {variantId ? (
                <Select value={variantId} onValueChange={setVariantId}>
                  <SelectTrigger accessibilityLabel="Product variant">
                    <SelectValue placeholder="Choose a variant" />
                  </SelectTrigger>
                  <SelectContent>
                    {selected.variants.map((variant) => (
                      <SelectItem key={variant.id} value={variant.id}>
                        {variant.title} · {formatMoney(variant.price)} · {variant.inventoryQuantity} left
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Text variant="body">No selectable variants.</Text>
              )}
            </Box>

            {selectedVariant ? (
              <Box className="gap-2">
                <Text variant="body">
                  {formatMoney(selectedVariant.price)} · {selectedVariant.inventoryState} · SKU {selectedVariant.sku}
                </Text>
                <Box className="flex-row flex-wrap items-center gap-3">
                  <Button variant="outline" onPress={() => setQuantity((value) => Math.max(1, value - 1))}>−</Button>
                  <Text variant="body">Qty {quantity}</Text>
                  <Button
                    variant="outline"
                    onPress={() => setQuantity((value) => Math.min(selectedVariant.inventoryQuantity, value + 1))}
                  >
                    +
                  </Button>
                  <Button disabled={busy || selectedVariant.inventoryQuantity <= 0} onPress={() => void addToCart()}>
                    {selectedVariant.inventoryQuantity <= 0 ? 'Out of stock' : 'Add to cart'}
                  </Button>
                </Box>
              </Box>
            ) : null}
          </Card>
        ) : null}

        <Box className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="gap-4 p-5 md:p-6">
            <Box className="gap-1">
              <Text variant="title">Cart</Text>
              <Text variant="body">{cart?.lines.length ?? 0} item{cart?.lines.length === 1 ? '' : 's'} ready for checkout.</Text>
            </Box>
            {cart?.lines.length ? (
              <Box className="gap-3">
                {cart.lines.map((line) => {
                  const product = products.find((item) => item.id === line.productId);
                  const variant = product?.variants.find((item) => item.id === line.variantId);
                  return (
                    <Box key={line.id} className="gap-1 border-b border-border pb-3">
                      <Text variant="body">{product?.title ?? line.productId} · {variant?.title ?? line.variantId}</Text>
                      <Text variant="body">{line.quantity} × {formatMoney(line.unitPrice)}</Text>
                    </Box>
                  );
                })}

                <Box className="gap-2">
                  <Text variant="body">Coupon</Text>
                  <Box className="flex-row flex-wrap gap-2">
                    <Box className="min-w-48 flex-1">
                      <Input accessibilityLabel="Coupon code" value={coupon} onChangeText={setCoupon} placeholder="WELCOME10" />
                    </Box>
                    <Button variant="outline" disabled={busy} onPress={() => void applyCoupon()}>Apply coupon</Button>
                  </Box>
                  {cart.couponCode ? <Text variant="body">Applied: {cart.couponCode}</Text> : null}
                </Box>

                {totals ? (
                  <Box className="gap-1">
                    <Text variant="body">Subtotal {formatMoney(totals.subtotal)}</Text>
                    <Text variant="body">Discount −{formatMoney(totals.discount)}</Text>
                    <Text variant="body">Shipping {formatMoney(totals.shipping)}</Text>
                    <Text variant="body">Tax {formatMoney(totals.tax)}</Text>
                    <Text variant="title">Total {formatMoney(totals.total)}</Text>
                  </Box>
                ) : null}

                <Box className="flex-row flex-wrap gap-2">
                  <Button
                    accessibilityLabel="Continue to checkout"
                    disabled={busy || !customer}
                    onPress={() => navigate('/conformance/checkout')}
                    testID="storefront-checkout"
                  >
                    Checkout
                  </Button>
                  <Button variant="outline" onPress={() => navigate('/conformance/cart')}>Manage cart</Button>
                </Box>
              </Box>
            ) : (
              <Text variant="body">Your cart is empty. Choose a product to get started.</Text>
            )}
          </Card>

          <Card className="gap-4 p-5 md:p-6" testID="storefront-latest-order">
            <Box className="gap-1">
              <Text variant="title">Latest order</Text>
              <Text variant="body">Track the most recent order placed from your cart.</Text>
            </Box>
            {lastOrder ? (
              <Box className="gap-2">
                <Text variant="title">{lastOrder.number}</Text>
                <Text variant="body">Payment: {lastOrder.paymentState}</Text>
                <Text variant="body">Fulfillment: {lastOrder.fulfillmentState}</Text>
                <Text variant="body">Items: {lastOrder.lines.length}</Text>
                <Text variant="body">Total: {formatMoney(lastOrder.total)}</Text>
                <Box className="items-start">
                  <Button
                    variant="outline"
                    onPress={() => navigate(`/conformance/orders/${encodeURIComponent(lastOrder.id)}`)}
                  >
                    View order
                  </Button>
                </Box>
              </Box>
            ) : (
              <Text variant="body">Your next order will appear here.</Text>
            )}
          </Card>
        </Box>

        <Card className="gap-4 p-5 md:p-6">
          <Box className="gap-1">
            <Box className="flex-row flex-wrap items-center gap-2">
              <Text variant="title">Support chat</Text>
              <Badge>{chatStatusLabel}</Badge>
            </Box>
            <Text variant="body">Need help with an order? Send us a message and our support team will reply here.</Text>
          </Box>
          <Box className="gap-2">
            {messages.map((message) => (
              <Box key={message.id} className="rounded-md border border-border p-3">
                <Text variant="body">{message.senderRole === 'customer' ? 'You' : 'Support'}: {message.body}</Text>
                <Text variant="body">{message.sentAt}</Text>
              </Box>
            ))}
          </Box>
          <Box className="flex-row flex-wrap gap-2">
            <Box className="min-w-64 flex-1">
              <Input
                accessibilityLabel="Support message"
                value={chatDraft}
                onChangeText={setChatDraft}
                placeholder="Ask support about your order"
              />
            </Box>
            <Button disabled={busy || !chatDraft.trim()} onPress={() => void sendSupportMessage()}>Send</Button>
          </Box>
        </Card>
      </Box>
    </Screen>
  );
}
