import { createBeeEcomClient } from '@beeecom/api-client';
import { formatMoney } from '@beeecom/app-ui';
import type { Order } from '@beeecom/domain';
import {
  Badge,
  Box,
  Card,
  DescriptionItem,
  DescriptionList,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
  Screen,
  Text,
} from '@beemvp/beeui-ui';
import * as React from 'react';

const api = createBeeEcomClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8787',
});

const ORDER_ID = 'order-1001';

export function OrderOverlayConformance() {
  const [order, setOrder] = React.useState<Order | null>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [breakdownOpen, setBreakdownOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    void api.orders.get(ORDER_ID)
      .then((next) => {
        if (active) setOrder(next);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load canonical order.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function deliverOrder() {
    if (!order) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await api.admin.orders.transition(order.id, { action: 'deliver' });
      setOrder(updated);
      setNotice('Order delivery persisted.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to persist order delivery.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Box className="mx-auto w-full max-w-4xl gap-5 p-4 md:p-8">
        <Card className="gap-2 p-5 md:p-6">
          <Text variant="title">Order overlay acceptance</Text>
          <Text variant="body">
            BeeECOM owns canonical order state and mutations; BeeUI owns menu/popover trigger, overlay and keyboard semantics.
          </Text>
        </Card>

        {loading ? <Card className="p-5"><Text variant="body">Loading canonical order…</Text></Card> : null}
        {error ? <Card className="p-5"><Text variant="body">{error}</Text></Card> : null}

        {!loading && order ? (
          <>
            <Card className="gap-4 p-5 md:p-6">
              <Box className="flex-row flex-wrap items-center justify-between gap-3">
                <Box className="gap-1">
                  <Text variant="title">Order {order.number}</Text>
                  <Text variant="body">Persisted operations state</Text>
                </Box>
                <Badge testID="order-fulfillment-state">{order.fulfillmentState}</Badge>
              </Box>

              <DescriptionList testID="order-overlay-summary">
                <DescriptionItem label="Payment" value={order.paymentState} />
                <DescriptionItem label="Fulfillment" value={order.fulfillmentState} />
                <DescriptionItem label="Total" value={formatMoney(order.total)} />
              </DescriptionList>

              <Box className="flex-row flex-wrap gap-3">
                <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                  <DropdownMenuTrigger accessibilityLabel="Order actions">Order actions</DropdownMenuTrigger>
                  <DropdownMenuContent testID="order-actions-menu" outsidePressTestID="order-actions-dismiss-layer">
                    <DropdownMenuItem disabled={busy || order.fulfillmentState !== 'shipped'} onSelect={() => void deliverOrder()}>
                      Mark delivered
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled>Ship order</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Popover open={breakdownOpen} onOpenChange={setBreakdownOpen}>
                  <PopoverTrigger accessibilityLabel="Order cost breakdown">Cost breakdown</PopoverTrigger>
                  <PopoverContent testID="order-cost-popover" outsidePressTestID="order-cost-dismiss-layer">
                    <PopoverTitle>Order total breakdown</PopoverTitle>
                    <PopoverDescription>Canonical persisted money values for {order.number}.</PopoverDescription>
                    <DescriptionList>
                      <DescriptionItem label="Subtotal" value={formatMoney(order.subtotal)} />
                      <DescriptionItem label="Discount" value={formatMoney(order.discount)} />
                      <DescriptionItem label="Shipping" value={formatMoney(order.shipping)} />
                      <DescriptionItem label="Tax" value={formatMoney(order.tax)} />
                      <DescriptionItem label="Total" value={formatMoney(order.total)} />
                    </DescriptionList>
                    <PopoverClose>Close breakdown</PopoverClose>
                  </PopoverContent>
                </Popover>
              </Box>

              {notice ? <Text testID="order-overlay-notice" variant="body">{notice}</Text> : null}
            </Card>
          </>
        ) : null}
      </Box>
    </Screen>
  );
}
