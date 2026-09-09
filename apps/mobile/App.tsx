import './global.css';

import { createBeeEcomClient, type ChatRealtimeStatus } from '@beeecom/api-client';
import { formatMoney, ProductCard } from '@beeecom/app-ui';
import {
  calculateCartTotals,
  type Cart,
  type Category,
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
  SafeArea,
  Screen,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Text,
} from '@beemvp/beeui-ui';
import * as React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, useWindowDimensions } from 'react-native';

const localApiBaseUrl = Platform.select({
  android: 'http://10.0.2.2:8787',
  default: 'http://127.0.0.1:8787',
});

const api = createBeeEcomClient({
  baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? localApiBaseUrl ?? 'http://127.0.0.1:8787',
});

const CART_ID = 'cart-ava';
const CUSTOMER_ID = 'cust-ava';
const THREAD_ID = 'thread-ava-1';

type MobileSection = 'shop' | 'cart' | 'orders' | 'account' | 'support';

function appendMessage(messages: ChatMessage[], message: ChatMessage): ChatMessage[] {
  return messages.some((item) => item.id === message.id) ? messages : [...messages, message];
}

function NavButton(props: { active: boolean; label: string; onPress: () => void }) {
  return props.active ? (
    <Button onPress={props.onPress}>{props.label}</Button>
  ) : (
    <Button variant="outline" onPress={props.onPress}>{props.label}</Button>
  );
}

export default function App() {
  const [section, setSection] = React.useState<MobileSection>('shop');
  const [products, setProducts] = React.useState<Product[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [categoryId, setCategoryId] = React.useState('all');
  const [selected, setSelected] = React.useState<Product | null>(null);
  const [variantId, setVariantId] = React.useState<string | undefined>();
  const [quantity, setQuantity] = React.useState(1);
  const [cart, setCart] = React.useState<Cart | null>(null);
  const [customer, setCustomer] = React.useState<Customer | null>(null);
  const [promotions, setPromotions] = React.useState<Promotion[]>([]);
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [chatStatus, setChatStatus] = React.useState<ChatRealtimeStatus>('connecting');
  const [search, setSearch] = React.useState('');
  const [coupon, setCoupon] = React.useState('WELCOME10');
  const [chatDraft, setChatDraft] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const loadChatHistory = React.useCallback(async () => {
    const [history] = await Promise.all([
      api.chat.listMessages(THREAD_ID),
      api.chat.markRead(THREAD_ID, { readerRole: 'customer' }),
    ]);
    setMessages(history);
  }, []);

  const refreshOrders = React.useCallback(async () => {
    const page = await api.orders.list({ customerId: CUSTOMER_ID, pageSize: 50 });
    setOrders(page.items);
  }, []);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [page, categoryList, currentCart, currentCustomer, promoList, orderPage, history] = await Promise.all([
        api.catalog.listProducts({ sort: 'featured', pageSize: 24 }),
        api.catalog.listCategories(),
        api.carts.get(CART_ID),
        api.customers.get(CUSTOMER_ID),
        api.promotions.list(),
        api.orders.list({ customerId: CUSTOMER_ID, pageSize: 50 }),
        api.chat.listMessages(THREAD_ID),
        api.chat.markRead(THREAD_ID, { readerRole: 'customer' }),
      ]);
      setProducts(page.items);
      setCategories(categoryList);
      setCart(currentCart);
      setCustomer(currentCustomer);
      setPromotions(promoList);
      setOrders(orderPage.items);
      setMessages(history);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load the mobile storefront.');
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
        if (event.message.senderRole === 'support-agent' && section === 'support') {
          void api.chat.markRead(THREAD_ID, { readerRole: 'customer' })
            .catch((cause) => console.warn('Unable to persist native customer read state', cause));
        }
      },
      onStatus: setChatStatus,
      onResync: loadChatHistory,
      onError(cause) {
        console.warn('Native support realtime transport error', cause);
      },
    });
    return () => subscription.close();
  }, [loadChatHistory, section]);

  React.useEffect(() => {
    if (section === 'support') {
      void api.chat.markRead(THREAD_ID, { readerRole: 'customer' })
        .catch((cause) => console.warn('Unable to mark native support thread read', cause));
    }
  }, [section]);

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

  async function searchCatalog() {
    setBusy(true);
    setError(null);
    try {
      const page = await api.catalog.listProducts({
        q: search.trim() || undefined,
        category: categoryId === 'all' ? undefined : categoryId,
        sort: 'featured',
        pageSize: 24,
      });
      setProducts(page.items);
      setSelected(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to search the catalog.');
    } finally {
      setBusy(false);
    }
  }

  async function addToCart() {
    if (!selectedVariant || selectedVariant.inventoryQuantity <= 0) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await api.carts.addLine(CART_ID, { variantId: selectedVariant.id, quantity });
      setCart(updated);
      setSection('cart');
      setNotice(`${selected?.title ?? 'Product'} added to persistent cart.`);
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
      const [nextCart] = await Promise.all([
        api.carts.get(CART_ID),
        refreshOrders(),
      ]);
      setCart(nextCart);
      setSection('orders');
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
      const message = await api.chat.sendMessage(THREAD_ID, {
        threadId: THREAD_ID,
        senderId: CUSTOMER_ID,
        senderRole: 'customer',
        body,
        clientMessageId: `native-${Platform.OS}-${Date.now()}`,
      });
      setMessages((current) => appendMessage(current, message));
      setChatDraft('');
      setNotice('Support message persisted and published to the shared agent inbox.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to send support message.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <BeeUIProvider>
      <Screen>
        <SafeArea className="flex-1" edges={['top', 'left', 'right']}>
          <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                alignSelf: 'center',
                gap: 16,
                maxWidth: isTablet ? 820 : undefined,
                padding: 16,
                width: '100%',
              }}
            >
              <Box className="gap-2 py-4">
                <Box className="flex-row flex-wrap items-center gap-2">
                  <Text variant="title">BeeECOM Mobile</Text>
                  <Badge>{Platform.OS}</Badge>
                  <Badge>{isTablet ? 'tablet' : 'phone'}</Badge>
                </Box>
                <Text variant="body">
                  Native commerce parity app using the same D1 state, Worker contracts and BeeUI public package as Web.
                </Text>
                <Box className="flex-row flex-wrap gap-2">
                  <NavButton active={section === 'shop'} label="Shop" onPress={() => setSection('shop')} />
                  <NavButton active={section === 'cart'} label={`Cart ${cart?.lines.length ?? 0}`} onPress={() => setSection('cart')} />
                  <NavButton active={section === 'orders'} label="Orders" onPress={() => setSection('orders')} />
                  <NavButton active={section === 'account'} label="Account" onPress={() => setSection('account')} />
                  <NavButton active={section === 'support'} label="Support" onPress={() => setSection('support')} />
                </Box>
                <Button variant="outline" onPress={() => void refresh()}>Refresh server state</Button>
              </Box>

              {notice ? (
                <Card className="p-4">
                  <Text variant="body">{notice}</Text>
                </Card>
              ) : null}

              {loading ? (
                <Card className="gap-2 p-5">
                  <Text variant="title">Loading mobile storefront…</Text>
                  <Text variant="body">Reading catalog, cart, customer, orders and support history from the shared API.</Text>
                </Card>
              ) : null}

              {error ? (
                <Card className="gap-3 p-5">
                  <Text variant="title">Request failed</Text>
                  <Text variant="body">{error}</Text>
                  <Button onPress={() => void refresh()}>Try again</Button>
                </Card>
              ) : null}

              {!loading && section === 'shop' ? (
                <Box className="gap-4">
                  <Card className="gap-3 p-5">
                    <Text variant="title">Catalog discovery</Text>
                    <Input
                      accessibilityLabel="Search products"
                      value={search}
                      onChangeText={setSearch}
                      placeholder="Search products"
                    />
                    <Box className="gap-2">
                      <Text variant="body">Category</Text>
                      <Select value={categoryId} onValueChange={setCategoryId}>
                        <SelectTrigger accessibilityLabel="Product category">
                          <SelectValue placeholder="All categories" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All categories</SelectItem>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Box>
                    <Button disabled={busy} onPress={() => void searchCatalog()}>Apply filters</Button>
                  </Card>

                  {products.length === 0 ? (
                    <Card className="gap-2 p-5">
                      <Text variant="title">No products</Text>
                      <Text variant="body">Try another query/category or reset the deterministic demo scenario.</Text>
                    </Card>
                  ) : products.map((product) => (
                    <ProductCard key={product.id} product={product} onPress={chooseProduct} />
                  ))}

                  {selected ? (
                    <Card className="gap-4 p-5">
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
                        <Box className="gap-3">
                          <Text variant="body">
                            {formatMoney(selectedVariant.price)} · {selectedVariant.inventoryState} · SKU {selectedVariant.sku}
                          </Text>
                          <Box className="flex-row flex-wrap items-center gap-2">
                            <Button variant="outline" onPress={() => setQuantity((value) => Math.max(1, value - 1))}>−</Button>
                            <Text variant="body">Qty {quantity}</Text>
                            <Button
                              variant="outline"
                              onPress={() => setQuantity((value) => Math.min(selectedVariant.inventoryQuantity, value + 1))}
                            >
                              +
                            </Button>
                          </Box>
                          <Button disabled={busy || selectedVariant.inventoryQuantity <= 0} onPress={() => void addToCart()}>
                            {selectedVariant.inventoryQuantity <= 0 ? 'Out of stock' : 'Add to cart'}
                          </Button>
                        </Box>
                      ) : null}
                    </Card>
                  ) : null}
                </Box>
              ) : null}

              {!loading && section === 'cart' ? (
                <Card className="gap-4 p-5">
                  <Text variant="title">Persistent cart</Text>
                  {cart?.lines.length ? (
                    <Box className="gap-3">
                      {cart.lines.map((line) => {
                        const product = products.find((item) => item.id === line.productId);
                        const variant = product?.variants.find((item) => item.id === line.variantId);
                        return (
                          <Box key={line.id} className="gap-1 rounded-md border border-border p-3">
                            <Text variant="body">{product?.title ?? line.productId}</Text>
                            <Text variant="body">{variant?.title ?? line.variantId}</Text>
                            <Text variant="body">{line.quantity} × {formatMoney(line.unitPrice)}</Text>
                          </Box>
                        );
                      })}

                      <Input
                        accessibilityLabel="Coupon code"
                        value={coupon}
                        onChangeText={setCoupon}
                        placeholder="WELCOME10"
                      />
                      <Button variant="outline" disabled={busy} onPress={() => void applyCoupon()}>Apply coupon</Button>
                      {cart.couponCode ? <Text variant="body">Applied: {cart.couponCode}</Text> : null}

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
                    <Box className="gap-3">
                      <Text variant="body">Cart is empty.</Text>
                      <Button onPress={() => setSection('shop')}>Browse products</Button>
                    </Box>
                  )}
                </Card>
              ) : null}

              {!loading && section === 'orders' ? (
                <Box className="gap-3">
                  <Box className="flex-row flex-wrap items-center justify-between gap-2">
                    <Text variant="title">Order history</Text>
                    <Button variant="outline" onPress={() => void refreshOrders()}>Refresh orders</Button>
                  </Box>
                  {orders.length ? orders.map((order) => (
                    <Card key={order.id} className="gap-2 p-5">
                      <Box className="flex-row flex-wrap items-center gap-2">
                        <Text variant="title">{order.number}</Text>
                        <Badge>{order.paymentState}</Badge>
                        <Badge>{order.fulfillmentState}</Badge>
                      </Box>
                      <Text variant="body">{order.lines.length} line(s) · {formatMoney(order.total)}</Text>
                      <Text variant="body">Placed {order.placedAt}</Text>
                      {order.lines.map((line) => (
                        <Text key={line.id} variant="body">{line.title} · {line.variantTitle} × {line.quantity}</Text>
                      ))}
                    </Card>
                  )) : (
                    <Card className="p-5">
                      <Text variant="body">No orders in this scenario.</Text>
                    </Card>
                  )}
                </Box>
              ) : null}

              {!loading && section === 'account' ? (
                <Card className="gap-4 p-5">
                  <Text variant="title">Account</Text>
                  {customer ? (
                    <Box className="gap-3">
                      <Box className="flex-row flex-wrap items-center gap-2">
                        <Text variant="body">{customer.displayName}</Text>
                        <Badge>{customer.tier}</Badge>
                      </Box>
                      <Text variant="body">{customer.email}</Text>
                      <Text variant="body">Lifetime value: {formatMoney(customer.lifetimeValue)}</Text>
                      <Text variant="title">Addresses</Text>
                      {customer.addresses.map((address) => (
                        <Box key={address.id} className="gap-1 rounded-md border border-border p-3">
                          <Text variant="body">{address.label}{address.isDefault ? ' · default' : ''}</Text>
                          <Text variant="body">{address.fullName} · {address.phone}</Text>
                          <Text variant="body">{address.line1}, {address.city}, {address.region} {address.postalCode}</Text>
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    <Text variant="body">Customer profile unavailable.</Text>
                  )}
                </Card>
              ) : null}

              {!loading && section === 'support' ? (
                <Card className="gap-4 p-5">
                  <Box className="flex-row flex-wrap items-center gap-2">
                    <Text variant="title">Support conversation</Text>
                    <Badge>{chatStatus}</Badge>
                  </Box>
                  <Text variant="body">
                    History comes from D1; realtime delivery uses the same Durable Object room as Storefront Web and Admin.
                  </Text>

                  <Box className="gap-2">
                    {messages.map((message) => (
                      <Box key={message.id} className="gap-1 rounded-md border border-border p-3">
                        <Text variant="body">{message.senderRole === 'customer' ? 'You' : 'Support'}: {message.body}</Text>
                        <Text variant="body">{message.sentAt}</Text>
                      </Box>
                    ))}
                  </Box>

                  <Input
                    accessibilityLabel="Native support message"
                    value={chatDraft}
                    onChangeText={setChatDraft}
                    placeholder="Ask support about your order"
                  />
                  <Button disabled={busy || !chatDraft.trim()} onPress={() => void sendSupportMessage()}>
                    {busy ? 'Sending…' : 'Send message'}
                  </Button>
                </Card>
              ) : null}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeArea>
      </Screen>
    </BeeUIProvider>
  );
}
