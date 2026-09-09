import { createBeeEcomClient } from '@beeecom/api-client';
import { formatMoney } from '@beeecom/app-ui';
import { calculateCartTotals, type Cart, type Customer, type Order, type Promotion } from '@beeecom/domain';
import {
  Box,
  Button,
  Card,
  Screen,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetTitle,
  SheetTrigger,
  Text,
} from '@beemvp/beeui-ui';
import * as React from 'react';

const api = createBeeEcomClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8787',
});

const CART_ID = 'cart-ava';
const CUSTOMER_ID = 'cust-ava';

export function CartSheetConformance() {
  const [open, setOpen] = React.useState(false);
  const [cart, setCart] = React.useState<Cart | null>(null);
  const [customer, setCustomer] = React.useState<Customer | null>(null);
  const [promotions, setPromotions] = React.useState<Promotion[]>([]);
  const [order, setOrder] = React.useState<Order | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextCart, nextCustomer, nextPromotions] = await Promise.all([
        api.carts.get(CART_ID),
        api.customers.get(CUSTOMER_ID),
        api.promotions.list(),
      ]);
      setCart(nextCart);
      setCustomer(nextCustomer);
      setPromotions(nextPromotions);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load cart Sheet acceptance data.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const promotion = cart?.couponCode
    ? promotions.find((item) => item.active && item.code === cart.couponCode)
    : undefined;
  const totals = cart && cart.lines.length > 0 ? calculateCartTotals(cart, promotion) : null;

  async function checkoutFromSheet() {
    const address = customer?.addresses.find((item) => item.isDefault) ?? customer?.addresses[0];
    if (!cart || !address || cart.lines.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const nextOrder = await api.checkout({ cartId: cart.id, addressId: address.id });
      setOrder(nextOrder);
      setCart(await api.carts.get(CART_ID));
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sheet checkout failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Box className="mx-auto w-full max-w-2xl gap-6 p-4 md:p-8">
        <Card className="gap-3 p-5 md:p-6">
          <Text variant="title">Cart Sheet acceptance</Text>
          <Text variant="body">
            Real D1-backed cart and checkout flow used to validate BeeUI Sheet as an external package consumer.
          </Text>
          {loading ? <Text variant="body">Loading cart…</Text> : null}
          {error ? <Text variant="body">{error}</Text> : null}
          {cart ? <Text variant="body">Cart lines: {cart.lines.length}</Text> : null}
          {order ? (
            <Text variant="body">Sheet checkout complete: {order.number} · {order.paymentState}</Text>
          ) : null}

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger disabled={loading || !cart?.lines.length}>Review cart in Sheet</SheetTrigger>
            <SheetContent
              overlayTestID="cart-sheet-backdrop"
              snapPoints={['55%', '90%']}
              initialSnapIndex={0}
            >
              <SheetTitle>Cart summary</SheetTitle>
              <SheetDescription>
                Review the persisted cart before handing off to the same checkout API used by the main storefront.
              </SheetDescription>

              <Box className="gap-3 py-3">
                {cart?.lines.map((line) => (
                  <Card key={line.id} className="gap-1 p-3">
                    <Text variant="body">{line.productId}</Text>
                    <Text variant="body">{line.quantity} × {formatMoney(line.unitPrice)}</Text>
                  </Card>
                ))}
                {totals ? (
                  <Box className="gap-1">
                    <Text variant="body">Subtotal {formatMoney(totals.subtotal)}</Text>
                    <Text variant="body">Discount −{formatMoney(totals.discount)}</Text>
                    <Text variant="body">Shipping {formatMoney(totals.shipping)}</Text>
                    <Text variant="body">Tax {formatMoney(totals.tax)}</Text>
                    <Text variant="title">Total {formatMoney(totals.total)}</Text>
                  </Box>
                ) : null}
              </Box>

              <SheetFooter>
                <SheetClose variant="outline">Continue shopping</SheetClose>
                <Button disabled={busy || !customer || !cart?.lines.length} onPress={() => void checkoutFromSheet()}>
                  {busy ? 'Checking out…' : 'Checkout from Sheet'}
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </Card>
      </Box>
    </Screen>
  );
}
