import { createBeeEcomClient } from '@beeecom/api-client';
import { formatMoney } from '@beeecom/app-ui';
import { calculateCartTotals, type Cart, type Product, type Promotion } from '@beeecom/domain';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
  AppHeader,
  Badge,
  Box,
  Button,
  Card,
  IconButton,
  Input,
  Screen,
  Separator,
  Text,
} from '@beemvp/beeui-ui';
import * as React from 'react';

const api = createBeeEcomClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8787',
});

const CART_ID = 'cart-ava';

function navigate(path: string) {
  window.location.assign(path);
}

export function CartManagementConformance() {
  const [cart, setCart] = React.useState<Cart | null>(null);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [promotions, setPromotions] = React.useState<Promotion[]>([]);
  const [coupon, setCoupon] = React.useState('WELCOME10');
  const [loading, setLoading] = React.useState(true);
  const [busyLineId, setBusyLineId] = React.useState<string | null>(null);
  const [busyCoupon, setBusyCoupon] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextCart, catalog, nextPromotions] = await Promise.all([
        api.carts.get(CART_ID),
        api.catalog.listProducts({ pageSize: 48, sort: 'featured' }),
        api.promotions.list(),
      ]);
      setCart(nextCart);
      setProducts(catalog.items);
      setPromotions(nextPromotions);
      setCoupon(nextCart.couponCode ?? 'WELCOME10');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load your cart.');
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
  const totals = cart && cart.lines.length > 0 ? calculateCartTotals(cart, appliedPromotion) : null;

  async function changeQuantity(lineId: string, quantity: number) {
    setBusyLineId(lineId);
    setError(null);
    setNotice(null);
    try {
      const updated = await api.carts.updateLine(CART_ID, lineId, { quantity });
      setCart(updated);
      setNotice('Cart quantity updated.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update this item.');
    } finally {
      setBusyLineId(null);
    }
  }

  async function removeLine(lineId: string, title: string) {
    setBusyLineId(lineId);
    setError(null);
    setNotice(null);
    try {
      const updated = await api.carts.removeLine(CART_ID, lineId);
      setCart(updated);
      setNotice(`${title} removed from your cart.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to remove this item.');
    } finally {
      setBusyLineId(null);
    }
  }

  async function applyCoupon() {
    setBusyCoupon(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await api.carts.applyCoupon(CART_ID, { code: coupon });
      setCart(updated);
      setNotice(updated.couponCode ? `Coupon ${updated.couponCode} applied.` : 'Coupon removed.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Coupon could not be applied.');
    } finally {
      setBusyCoupon(false);
    }
  }

  async function removeCoupon() {
    setCoupon('');
    setBusyCoupon(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await api.carts.applyCoupon(CART_ID, { code: '' });
      setCart(updated);
      setNotice('Coupon removed.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Coupon could not be removed.');
    } finally {
      setBusyCoupon(false);
    }
  }

  return (
    <Screen>
      <AppHeader
        leading={(
          <IconButton accessibilityLabel="Back to shop" variant="ghost" onPress={() => navigate('/')}>
            <Text aria-hidden variant="heading">‹</Text>
          </IconButton>
        )}
        title="Your cart"
        description="Review quantities, savings and your order total before checkout."
      />

      <Box className="mx-auto w-full max-w-5xl gap-6 p-4 md:p-8">
        {notice ? (
          <Card className="p-4" testID="cart-notice">
            <Text variant="body">{notice}</Text>
          </Card>
        ) : null}
        {error ? (
          <Card className="gap-3 p-4" testID="cart-error">
            <Text variant="title">Cart update failed</Text>
            <Text variant="body">{error}</Text>
            <Button variant="outline" onPress={() => void load()}>Reload cart</Button>
          </Card>
        ) : null}
        {loading ? (
          <Card className="p-6"><Text variant="body">Loading your cart…</Text></Card>
        ) : null}

        {!loading && cart ? (
          <Box className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <Box className="gap-4">
              {cart.lines.length === 0 ? (
                <Card className="gap-3 p-6" testID="cart-empty-state">
                  <Text variant="title">Your cart is empty</Text>
                  <Text variant="body">Browse the collection and add something you love.</Text>
                  <Box className="items-start"><Button onPress={() => navigate('/conformance/collections')}>Continue shopping</Button></Box>
                </Card>
              ) : cart.lines.map((line) => {
                const product = products.find((item) => item.id === line.productId);
                const variant = product?.variants.find((item) => item.id === line.variantId);
                const title = product?.title ?? line.productId;
                const variantTitle = variant?.title ?? line.variantId;
                const maxQuantity = variant?.inventoryQuantity ?? line.quantity;
                const busy = busyLineId === line.id;
                return (
                  <Card key={line.id} className="gap-4 p-5 md:p-6" testID={`cart-line-${line.id}`}>
                    <Box className="flex-row flex-wrap items-start justify-between gap-3">
                      <Box className="min-w-0 flex-1 gap-1">
                        <Text variant="title">{title}</Text>
                        <Text variant="body">{variantTitle}</Text>
                        <Box className="flex-row flex-wrap items-center gap-2">
                          <Text variant="body">{formatMoney(line.unitPrice)} each</Text>
                          {variant ? <Badge>{variant.inventoryState}</Badge> : null}
                        </Box>
                      </Box>
                      <Text variant="title">{formatMoney({ ...line.unitPrice, amount: line.unitPrice.amount * line.quantity })}</Text>
                    </Box>

                    <Separator decorative />

                    <Box className="flex-row flex-wrap items-center justify-between gap-3">
                      <Box className="flex-row items-center gap-2">
                        <Button
                          variant="outline"
                          accessibilityLabel={`Decrease ${title} quantity`}
                          disabled={busy || line.quantity <= 1}
                          onPress={() => void changeQuantity(line.id, line.quantity - 1)}
                        >−</Button>
                        <Text variant="body" testID={`cart-quantity-${line.id}`}>Quantity {line.quantity}</Text>
                        <Button
                          variant="outline"
                          accessibilityLabel={`Increase ${title} quantity`}
                          disabled={busy || line.quantity >= maxQuantity}
                          onPress={() => void changeQuantity(line.id, line.quantity + 1)}
                        >+</Button>
                      </Box>

                      <AlertDialog>
                        <AlertDialogTrigger variant="ghost" disabled={busy}>Remove {title}</AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogTitle>Remove {title} from your cart?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This item will be removed from your cart. You can add it again from the shop later.
                          </AlertDialogDescription>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep item</AlertDialogCancel>
                            <AlertDialogAction disabled={busy} onPress={() => void removeLine(line.id, title)}>
                              Remove item
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </Box>
                  </Card>
                );
              })}
            </Box>

            <Card className="h-fit gap-4 p-5 md:p-6" testID="cart-order-summary">
              <Box className="gap-1">
                <Text variant="title">Order summary</Text>
                <Text variant="body">{cart.lines.length} item{cart.lines.length === 1 ? '' : 's'} in your cart.</Text>
              </Box>

              {cart.lines.length > 0 ? (
                <>
                  <Box className="gap-2">
                    <Text variant="body">Coupon code</Text>
                    <Input
                      accessibilityLabel="Coupon code"
                      value={coupon}
                      onChangeText={setCoupon}
                      placeholder="WELCOME10"
                    />
                    <Box className="flex-row flex-wrap gap-2">
                      <Button variant="outline" disabled={busyCoupon || !coupon.trim()} onPress={() => void applyCoupon()}>
                        Apply coupon
                      </Button>
                      {cart.couponCode ? (
                        <Button variant="ghost" disabled={busyCoupon} onPress={() => void removeCoupon()}>Remove coupon</Button>
                      ) : null}
                    </Box>
                    {cart.couponCode ? <Badge>Applied: {cart.couponCode}</Badge> : null}
                  </Box>

                  <Separator decorative />

                  {totals ? (
                    <Box className="gap-2" testID="cart-totals">
                      <Box className="flex-row justify-between gap-3"><Text variant="body">Subtotal</Text><Text variant="body">{formatMoney(totals.subtotal)}</Text></Box>
                      <Box className="flex-row justify-between gap-3"><Text variant="body">Discount</Text><Text variant="body">−{formatMoney(totals.discount)}</Text></Box>
                      <Box className="flex-row justify-between gap-3"><Text variant="body">Shipping</Text><Text variant="body">{formatMoney(totals.shipping)}</Text></Box>
                      <Box className="flex-row justify-between gap-3"><Text variant="body">Tax</Text><Text variant="body">{formatMoney(totals.tax)}</Text></Box>
                      <Separator decorative />
                      <Box className="flex-row justify-between gap-3"><Text variant="title">Total</Text><Text variant="title">{formatMoney(totals.total)}</Text></Box>
                    </Box>
                  ) : null}

                  <Button onPress={() => navigate('/conformance/checkout')}>Continue to checkout</Button>
                </>
              ) : null}
            </Card>
          </Box>
        ) : null}
      </Box>
    </Screen>
  );
}
