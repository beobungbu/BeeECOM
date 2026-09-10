import { createBeeEcomClient } from '@beeecom/api-client';
import { formatMoney } from '@beeecom/app-ui';
import {
  calculateCartTotals,
  type Cart,
  type Customer,
  type Order,
  type PaymentMethod,
  type Product,
  type Promotion,
  type ShippingMethod,
} from '@beeecom/domain';
import {
  AppHeader,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  DescriptionItem,
  DescriptionList,
  IconButton,
  ListGroup,
  ListGroupHeader,
  ListItem,
  Radio,
  RadioGroup,
  Screen,
  Separator,
  Text,
} from '@beemvp/beeui-ui';
import * as React from 'react';

const api = createBeeEcomClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8787',
});

const CART_ID = 'cart-ava';
const CUSTOMER_ID = 'cust-ava';
const SHIPPING_AMOUNT: Record<ShippingMethod, number> = { standard: 900, express: 1800 };

function navigate(path: string) {
  window.location.assign(path);
}

export function CheckoutConformance() {
  const [cart, setCart] = React.useState<Cart | null>(null);
  const [customer, setCustomer] = React.useState<Customer | null>(null);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [promotions, setPromotions] = React.useState<Promotion[]>([]);
  const [addressId, setAddressId] = React.useState('');
  const [shippingMethod, setShippingMethod] = React.useState<ShippingMethod>('standard');
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>('card');
  const [confirmed, setConfirmed] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [order, setOrder] = React.useState<Order | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextCart, nextCustomer, catalog, nextPromotions] = await Promise.all([
        api.carts.get(CART_ID),
        api.customers.get(CUSTOMER_ID),
        api.catalog.listProducts({ pageSize: 48, sort: 'featured' }),
        api.promotions.list(),
      ]);
      setCart(nextCart);
      setCustomer(nextCustomer);
      setProducts(catalog.items);
      setPromotions(nextPromotions);
      setAddressId(nextCustomer.addresses.find((item) => item.isDefault)?.id ?? nextCustomer.addresses[0]?.id ?? '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load checkout.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const appliedPromotion = cart?.couponCode
    ? promotions.find((promotion) => promotion.active && promotion.code === cart.couponCode)
    : undefined;
  const totals = cart && cart.lines.length > 0
    ? calculateCartTotals(cart, appliedPromotion, SHIPPING_AMOUNT[shippingMethod])
    : null;
  const selectedAddress = customer?.addresses.find((item) => item.id === addressId);

  async function placeOrder() {
    if (!cart || cart.lines.length === 0 || !addressId || !confirmed) return;
    setBusy(true);
    setError(null);
    try {
      const created = await api.checkout({
        cartId: cart.id,
        addressId,
        shippingMethod,
        paymentMethod,
      });
      setOrder(created);
      setCart(await api.carts.get(CART_ID));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to place your order.');
    } finally {
      setBusy(false);
    }
  }

  if (order) {
    return (
      <Screen>
        <AppHeader title="Order confirmed" description="Your order has been placed and is ready for fulfillment." />
        <Box className="mx-auto w-full max-w-3xl gap-6 p-4 md:p-8">
          <Card className="gap-4 p-6 md:p-8" testID="checkout-success">
            <Box className="flex-row flex-wrap items-center justify-between gap-3">
              <Box className="gap-1">
                <Text variant="title">Thank you, {customer?.displayName ?? 'shopper'}.</Text>
                <Text variant="body">Order {order.number} is confirmed.</Text>
              </Box>
              <Badge>{order.paymentState}</Badge>
            </Box>
            <DescriptionList>
              <DescriptionItem label="Delivery" value={order.shippingMethod === 'express' ? 'Express delivery' : 'Standard delivery'} />
              <DescriptionItem label="Payment" value={order.paymentMethod === 'wallet' ? 'Wallet' : 'Card ending in 4242'} />
              <DescriptionItem label="Total" value={formatMoney(order.total)} />
            </DescriptionList>
            <Box className="flex-row flex-wrap gap-2">
              <Button onPress={() => navigate(`/conformance/orders/${encodeURIComponent(order.id)}`)}>View order</Button>
              <Button variant="outline" onPress={() => navigate('/conformance/collections')}>Continue shopping</Button>
            </Box>
          </Card>
        </Box>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
        leading={(
          <IconButton accessibilityLabel="Back to cart" variant="ghost" onPress={() => navigate('/conformance/cart')}>
            <Text aria-hidden variant="heading">‹</Text>
          </IconButton>
        )}
        title="Checkout"
        description="Choose delivery and payment, then review your order before placing it."
      />

      <Box className="mx-auto w-full max-w-6xl gap-6 p-4 md:p-8">
        {error ? (
          <Card className="gap-2 p-5" testID="checkout-error">
            <Text variant="heading">We couldn’t complete checkout</Text>
            <Text variant="body">{error}</Text>
          </Card>
        ) : null}
        {loading ? <Card className="p-6"><Text variant="body">Loading checkout…</Text></Card> : null}

        {!loading && cart && customer ? (
          cart.lines.length === 0 ? (
            <Card className="gap-3 p-6" testID="checkout-empty">
              <Text variant="title">Your cart is empty</Text>
              <Text variant="body">Add an item before continuing to checkout.</Text>
              <Box className="items-start"><Button onPress={() => navigate('/conformance/collections')}>Shop products</Button></Box>
            </Card>
          ) : (
            <Box className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_23rem]">
              <Box className="gap-5">
                <Card className="gap-4 p-5 md:p-6">
                  <Box className="gap-1">
                    <Text variant="title">Contact</Text>
                    <Text variant="body">Order updates will be sent to this account.</Text>
                  </Box>
                  <Text variant="heading">{customer.displayName}</Text>
                  <Text variant="body">{customer.email}</Text>
                </Card>

                <Card className="gap-4 p-5 md:p-6">
                  <Box className="gap-1">
                    <Text variant="title">Delivery address</Text>
                    <Text variant="body">Choose where this order should be delivered.</Text>
                  </Box>
                  <RadioGroup accessibilityLabel="Delivery address" value={addressId} onValueChange={setAddressId} testID="checkout-address-group">
                    {customer.addresses.map((address) => (
                      <Radio
                        key={address.id}
                        value={address.id}
                        label={`${address.label} — ${address.line1}, ${address.city}, ${address.region} ${address.postalCode}`}
                      />
                    ))}
                  </RadioGroup>
                </Card>

                <Card className="gap-4 p-5 md:p-6">
                  <Box className="gap-1">
                    <Text variant="title">Delivery speed</Text>
                    <Text variant="body">Select the shipping option that works best for you.</Text>
                  </Box>
                  <RadioGroup
                    accessibilityLabel="Shipping method"
                    value={shippingMethod}
                    onValueChange={(value) => setShippingMethod(value as ShippingMethod)}
                    testID="checkout-shipping-group"
                  >
                    <Radio value="standard" label="Standard delivery — $9.00" />
                    <Radio value="express" label="Express delivery — $18.00" />
                  </RadioGroup>
                </Card>

                <Card className="gap-4 p-5 md:p-6">
                  <Box className="gap-1">
                    <Text variant="title">Payment</Text>
                    <Text variant="body">This demo store does not charge a real payment method.</Text>
                  </Box>
                  <RadioGroup
                    accessibilityLabel="Payment method"
                    value={paymentMethod}
                    onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
                    testID="checkout-payment-group"
                  >
                    <Radio value="card" label="Card ending in 4242" />
                    <Radio value="wallet" label="Wallet" />
                  </RadioGroup>
                </Card>
              </Box>

              <Card className="h-fit gap-4 p-5 md:p-6" testID="checkout-order-review">
                <Box className="gap-1">
                  <Text variant="title">Review order</Text>
                  <Text variant="body">Confirm your items and total before placing the order.</Text>
                </Box>

                <ListGroup accessibilityLabel="Checkout items">
                  <ListGroupHeader title={`${cart.lines.length} item${cart.lines.length === 1 ? '' : 's'}`} description="Current cart" />
                  {cart.lines.map((line) => {
                    const product = products.find((item) => item.id === line.productId);
                    const variant = product?.variants.find((item) => item.id === line.variantId);
                    return (
                      <ListItem
                        key={line.id}
                        title={product?.title ?? line.productId}
                        description={`${variant?.title ?? line.variantId} · Qty ${line.quantity}`}
                        trailing={formatMoney({ ...line.unitPrice, amount: line.unitPrice.amount * line.quantity })}
                      />
                    );
                  })}
                </ListGroup>

                <Separator decorative />

                {selectedAddress ? (
                  <Box className="gap-1" testID="checkout-selected-address">
                    <Text variant="heading">Deliver to</Text>
                    <Text variant="body">{selectedAddress.fullName}</Text>
                    <Text variant="body">{selectedAddress.line1}, {selectedAddress.city}, {selectedAddress.region} {selectedAddress.postalCode}</Text>
                  </Box>
                ) : null}

                {cart.couponCode ? <Badge>Coupon {cart.couponCode}</Badge> : null}

                {totals ? (
                  <DescriptionList testID="checkout-totals">
                    <DescriptionItem label="Subtotal" value={formatMoney(totals.subtotal)} />
                    <DescriptionItem label="Discount" value={`−${formatMoney(totals.discount)}`} />
                    <DescriptionItem label="Shipping" value={formatMoney(totals.shipping)} />
                    <DescriptionItem label="Tax" value={formatMoney(totals.tax)} />
                    <DescriptionItem label="Total" value={formatMoney(totals.total)} />
                  </DescriptionList>
                ) : null}

                <Checkbox
                  checked={confirmed}
                  onCheckedChange={setConfirmed}
                  label="I confirm my delivery, payment and order details"
                  disabled={busy}
                />

                <Button disabled={busy || !addressId || !confirmed} onPress={() => void placeOrder()}>
                  {busy ? 'Placing order…' : 'Place order'}
                </Button>
                <Button variant="ghost" disabled={busy} onPress={() => navigate('/conformance/cart')}>Back to cart</Button>
              </Card>
            </Box>
          )
        ) : null}
      </Box>
    </Screen>
  );
}
