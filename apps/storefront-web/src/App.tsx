import { createBeeEcomClient } from '@beeecom/api-client';
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
  BeeUIProvider,
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
  const [coupon, setCoupon] = React.useState('WELCOME10');
  const [chatDraft, setChatDraft] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [catalog, currentCart, currentCustomer, promoList, chatHistory] = await Promise.all([
        api.catalog.listProducts({ sort: 'featured', pageSize: 12 }),
        api.carts.get(CART_ID),
        api.customers.get(CUSTOMER_ID),
        api.promotions.list(),
        api.chat.listMessages(THREAD_ID),
      ]);
      setProducts(catalog.items);
      setCart(currentCart);
      setCustomer(currentCustomer);
      setPromotions(promoList);
      setMessages(chatHistory);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load the storefront.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

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

  async function checkout() {
    const address = customer?.addresses.find((item) => item.isDefault) ?? customer?.addresses[0];
    if (!cart || !address || cart.lines.length === 0) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const order = await api.checkout({ cartId: cart.id, addressId: address.id });
      setLastOrder(order);
      setCart(await api.carts.get(CART_ID));
      setNotice(order.paymentState === 'paid' ? `Order ${order.number} placed.` : `Order ${order.number} created with failed payment.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Checkout failed.');
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
      await api.chat.sendMessage(THREAD_ID, {
        threadId: THREAD_ID,
        senderId: CUSTOMER_ID,
        senderRole: 'customer',
        body,
        clientMessageId: `web-customer-${Date.now()}`,
      });
      setMessages(await api.chat.listMessages(THREAD_ID));
      setChatDraft('');
      setNotice('Support message persisted. Reload the page to verify history survives.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Support message failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <BeeUIProvider>
      <Screen>
        <Box className="mx-auto w-full max-w-screen-xl gap-8 p-4 md:p-8">
          <Box className="gap-3 py-8 md:py-12">
            <Box className="flex-row flex-wrap items-center gap-3">
              <Text variant="title">BeeECOM</Text>
              <Badge>BeeUI 0.86.2-rc.1</Badge>
            </Box>
            <Text variant="body">
              Golden commerce slice: browse → PDP → cart → coupon → checkout → shared Admin order → persistent support chat.
            </Text>
            <Box className="flex-row flex-wrap gap-3">
              <Button onPress={() => void refresh()}>Refresh server state</Button>
              <Button variant="outline" onPress={() => setSelected(null)}>Close PDP</Button>
            </Box>
          </Box>

          {notice ? (
            <Card className="p-4">
              <Text variant="body">{notice}</Text>
            </Card>
          ) : null}

          {loading ? (
            <Card className="gap-2 p-6">
              <Text variant="title">Loading storefront…</Text>
              <Text variant="body">Fetching catalog, cart, customer, promotions and chat from the shared Worker API.</Text>
            </Card>
          ) : null}

          {error ? (
            <Card className="gap-3 p-6">
              <Text variant="title">Request failed</Text>
              <Text variant="body">{error}</Text>
              <Button onPress={() => void refresh()}>Reload state</Button>
            </Card>
          ) : null}

          {!loading && products.length === 0 ? (
            <Card className="gap-2 p-6">
              <Text variant="title">No products</Text>
              <Text variant="body">This state is reproducible with the named `empty-catalog` demo scenario.</Text>
            </Card>
          ) : null}

          {!loading && products.length > 0 ? (
            <Box className="gap-4">
              <Box className="gap-1">
                <Text variant="title">Catalog</Text>
                <Text variant="body">Every product and variant comes from D1-backed deterministic fixtures.</Text>
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
                <Text variant="body">Cart ID {CART_ID}; mutations persist in D1.</Text>
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

                  <Button disabled={busy || !customer} onPress={() => void checkout()}>Simulate checkout</Button>
                </Box>
              ) : (
                <Text variant="body">Cart is empty. Add a product above.</Text>
              )}
            </Card>

            <Card className="gap-4 p-5 md:p-6">
              <Box className="gap-1">
                <Text variant="title">Latest order</Text>
                <Text variant="body">The same order is immediately queryable by Admin.</Text>
              </Box>
              {lastOrder ? (
                <Box className="gap-2">
                  <Text variant="title">{lastOrder.number}</Text>
                  <Text variant="body">Payment: {lastOrder.paymentState}</Text>
                  <Text variant="body">Fulfillment: {lastOrder.fulfillmentState}</Text>
                  <Text variant="body">Lines: {lastOrder.lines.length}</Text>
                  <Text variant="body">Total: {formatMoney(lastOrder.total)}</Text>
                </Box>
              ) : (
                <Text variant="body">Complete checkout to create a new order.</Text>
              )}
            </Card>
          </Box>

          <Card className="gap-4 p-5 md:p-6">
            <Box className="gap-1">
              <Text variant="title">Support chat</Text>
              <Text variant="body">HTTP history is canonical and durable; realtime fan-out is the next WBS-09 increment.</Text>
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
    </BeeUIProvider>
  );
}
