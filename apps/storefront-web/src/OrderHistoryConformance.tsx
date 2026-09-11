import { createBeeEcomClient } from '@beeecom/api-client';
import { formatMoney } from '@beeecom/app-ui';
import type { Customer, Order } from '@beeecom/domain';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
  Badge,
  Box,
  Breadcrumb,
  BreadcrumbItem,
  Button,
  Card,
  DescriptionItem,
  DescriptionList,
  Input,
  ListGroup,
  ListGroupHeader,
  ListItem,
  Screen,
  Text,
  Timeline,
  TimelineItem,
} from '@beemvp/beeui-ui';
import * as React from 'react';

const api = createBeeEcomClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8787',
});

const CUSTOMER_ID = 'cust-ava';

function navigate(path: string) {
  window.location.assign(path);
}

function orderIdFromPath() {
  const match = window.location.pathname.match(/^\/conformance\/orders\/([^/]+)$/);
  return match ? decodeURIComponent(match[1] ?? '') : null;
}

function statusLabel(order: Order) {
  if (order.paymentState === 'failed') return 'Payment issue';
  if (order.fulfillmentState === 'delivered') return 'Delivered';
  if (order.fulfillmentState === 'shipped') return 'Shipped';
  if (order.fulfillmentState === 'processing') return 'Processing';
  if (order.fulfillmentState === 'cancelled') return 'Cancelled';
  return 'Order placed';
}

function formatOrderDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  }).format(date)} UTC`;
}

function shippingMethodLabel(order: Order) {
  if (order.shippingMethod === 'express') return 'Express delivery';
  if (order.shippingMethod === 'standard') return 'Standard delivery';
  return 'Not recorded';
}

function paymentMethodLabel(order: Order) {
  if (order.paymentMethod === 'wallet') return 'Wallet';
  if (order.paymentMethod === 'card') return 'Card';
  return 'Not recorded';
}

function paymentTimeline(order: Order) {
  if (order.paymentState === 'paid') {
    return { title: 'Payment confirmed', description: paymentMethodLabel(order), status: 'success' as const };
  }
  if (order.paymentState === 'failed') {
    return { title: 'Payment needs attention', description: 'The last payment attempt did not complete.', status: 'destructive' as const };
  }
  if (order.paymentState === 'refunded') {
    return { title: 'Payment refunded', description: paymentMethodLabel(order), status: 'primary' as const };
  }
  return { title: 'Payment pending', description: paymentMethodLabel(order), status: 'default' as const };
}

function fulfillmentTimeline(order: Order) {
  switch (order.fulfillmentState) {
    case 'processing':
      return {
        title: 'Preparing your order',
        description: 'Your items are being prepared for shipment.',
        status: 'primary' as const,
      };
    case 'shipped':
      return {
        title: 'On the way',
        description: order.shippingMethod
          ? `Your order has shipped with ${shippingMethodLabel(order).toLowerCase()}.`
          : 'Your order has shipped.',
        status: 'primary' as const,
      };
    case 'delivered':
      return {
        title: 'Delivered',
        description: `Delivered to ${order.shippingAddress.city}, ${order.shippingAddress.region}.`,
        status: 'success' as const,
      };
    case 'cancelled':
      return {
        title: 'Fulfillment cancelled',
        description: 'This order will not be shipped.',
        status: 'destructive' as const,
      };
    default:
      return {
        title: 'Fulfillment pending',
        description: 'Fulfillment has not started yet.',
        status: 'default' as const,
      };
  }
}

export function OrderHistoryConformance() {
  const [customer, setCustomer] = React.useState<Customer | null>(null);
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = React.useState('Ordered by mistake');
  const orderId = orderIdFromPath();
  const selectedOrder = orderId ? orders.find((order) => order.id === orderId) : undefined;

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void Promise.all([
      api.customers.get(CUSTOMER_ID),
      api.orders.list({ customerId: CUSTOMER_ID, pageSize: 50 }),
    ])
      .then(([nextCustomer, orderPage]) => {
        if (!active) return;
        setCustomer(nextCustomer);
        setOrders(orderPage.items);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load your orders.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function cancelOrder() {
    if (!selectedOrder || cancellationReason.trim().length < 5) return;
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      const updated = await api.orders.cancel(selectedOrder.id, {
        customerId: CUSTOMER_ID,
        reason: cancellationReason.trim(),
      });
      setOrders((current) => current.map((order) => order.id === updated.id ? updated : order));
      setNotice(`Order ${updated.number} cancelled. The demo payment is marked as refunded.`);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Unable to cancel this order.');
    } finally {
      setBusy(false);
    }
  }

  async function retryPayment() {
    if (!selectedOrder) return;
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      const updated = await api.orders.retryPayment(selectedOrder.id, {
        customerId: CUSTOMER_ID,
        outcome: 'success',
      });
      setOrders((current) => current.map((order) => order.id === updated.id ? updated : order));
      setNotice(updated.paymentState === 'paid'
        ? `Payment confirmed for order ${updated.number}. Your order is ready for fulfillment.`
        : `Payment for order ${updated.number} could not be completed. Please try again.`);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Unable to retry payment for this order.');
    } finally {
      setBusy(false);
    }
  }

  const canCustomerCancel = selectedOrder?.state === 'placed'
    && selectedOrder.paymentState === 'paid'
    && selectedOrder.fulfillmentState === 'unfulfilled';
  const canRetryPayment = selectedOrder?.state === 'placed'
    && selectedOrder.paymentState === 'failed'
    && selectedOrder.fulfillmentState === 'unfulfilled';
  const canReview = selectedOrder?.paymentState === 'paid'
    && selectedOrder.fulfillmentState === 'delivered';

  const paymentProgress = selectedOrder ? paymentTimeline(selectedOrder) : null;
  const fulfillmentProgress = selectedOrder ? fulfillmentTimeline(selectedOrder) : null;

  return (
    <Screen>
      <Box className="mx-auto w-full max-w-5xl gap-6 p-4 md:p-8">
        {orderId ? (
          <Breadcrumb accessibilityLabel="Order navigation" testID="order-breadcrumb">
            <BreadcrumbItem onPress={() => navigate('/conformance/collections')}>Shop</BreadcrumbItem>
            <BreadcrumbItem onPress={() => navigate('/conformance/orders')}>Orders</BreadcrumbItem>
            <BreadcrumbItem current>{selectedOrder?.number ?? 'Order'}</BreadcrumbItem>
          </Breadcrumb>
        ) : null}

        <Box className="gap-2 px-1">
          <Text variant="body">Account</Text>
          <Text variant="title">{orderId ? `Order ${selectedOrder?.number ?? ''}`.trim() : 'Your orders'}</Text>
          <Text variant="body">
            {orderId
              ? 'Review order status, items, delivery progress and payment details.'
              : 'Track recent purchases and open an order for full details.'}
          </Text>
        </Box>

        {notice ? (
          <Card className="p-4" testID="order-notice">
            <Text variant="body">{notice}</Text>
          </Card>
        ) : null}

        {actionError ? (
          <Card className="gap-1 p-4" testID="order-action-error">
            <Text variant="heading">We couldn’t complete that action</Text>
            <Text variant="body">{actionError}</Text>
          </Card>
        ) : null}

        {loading ? (
          <Card className="p-5 md:p-6">
            <Text variant="body">Loading your orders…</Text>
          </Card>
        ) : null}

        {error ? (
          <Card className="gap-2 p-5 md:p-6">
            <Text variant="heading">We couldn’t load your orders</Text>
            <Text variant="body">{error}</Text>
          </Card>
        ) : null}

        {!loading && !error && customer && !orderId ? (
          <>
            <Card className="gap-2 p-5 md:p-6">
              <Text variant="heading">{customer.displayName}</Text>
              <Text variant="body">{orders.length} recent order{orders.length === 1 ? '' : 's'}</Text>
            </Card>

            {orders.length > 0 ? (
              <ListGroup accessibilityLabel="Order history" testID="order-history-list">
                <ListGroupHeader title="Recent orders" description="Select an order to view its details." />
                {orders.map((order) => (
                  <ListItem
                    key={order.id}
                    accessibilityLabel={`View order ${order.number}`}
                    description={`${statusLabel(order)} · ${order.lines.length} item${order.lines.length === 1 ? '' : 's'}`}
                    onPress={() => navigate(`/conformance/orders/${encodeURIComponent(order.id)}`)}
                    title={order.number}
                    trailing={formatMoney(order.total)}
                  />
                ))}
              </ListGroup>
            ) : (
              <Card className="p-5 md:p-6">
                <Text variant="heading">No orders yet</Text>
                <Text variant="body">Your completed purchases will appear here.</Text>
              </Card>
            )}
          </>
        ) : null}

        {!loading && !error && customer && orderId && !selectedOrder ? (
          <Card className="gap-2 p-5 md:p-6">
            <Text variant="heading">Order not found</Text>
            <Text variant="body">This order is not available in {customer.displayName}’s order history.</Text>
          </Card>
        ) : null}

        {!loading && !error && customer && selectedOrder && paymentProgress && fulfillmentProgress ? (
          <Box className="gap-5">
            <Card className="gap-4 p-5 md:p-6">
              <Box className="flex-row flex-wrap items-start justify-between gap-3">
                <Box className="min-w-0 flex-1 gap-1">
                  <Text variant="heading">{selectedOrder.number}</Text>
                  <Text variant="body">Placed {formatOrderDate(selectedOrder.placedAt)}</Text>
                </Box>
                <Box className="flex-row flex-wrap gap-2">
                  <Badge>{selectedOrder.paymentState}</Badge>
                  <Badge>{selectedOrder.fulfillmentState}</Badge>
                </Box>
              </Box>
              <Text variant="body">
                {statusLabel(selectedOrder)} · {selectedOrder.lines.length} item{selectedOrder.lines.length === 1 ? '' : 's'}
              </Text>
            </Card>

            <Card className="gap-4 p-5 md:p-6" testID="order-progress-card">
              <Box className="gap-1">
                <Text variant="heading">Order progress</Text>
                <Text variant="body">The latest persisted status for payment and fulfillment.</Text>
              </Box>
              <Timeline accessibilityLabel={`Progress for order ${selectedOrder.number}`} testID="order-progress-timeline">
                <TimelineItem
                  title="Order placed"
                  description="We received your order."
                  meta={formatOrderDate(selectedOrder.placedAt)}
                  status="success"
                />
                <TimelineItem
                  title={paymentProgress.title}
                  description={paymentProgress.description}
                  meta={`Payment status: ${selectedOrder.paymentState}`}
                  status={paymentProgress.status}
                />
                <TimelineItem
                  title={fulfillmentProgress.title}
                  description={fulfillmentProgress.description}
                  meta={`Updated ${formatOrderDate(selectedOrder.updatedAt)}`}
                  status={fulfillmentProgress.status}
                />
              </Timeline>
            </Card>

            <Box className="gap-5 lg:flex-row lg:items-start">
              <Card className="min-w-0 flex-[1.35] gap-4 p-5 md:p-6">
                <Box className="gap-1">
                  <Text variant="heading">Items</Text>
                  <Text variant="body">Products included in this purchase.</Text>
                </Box>
                <ListGroup accessibilityLabel={`Items in order ${selectedOrder.number}`} testID="order-detail-items">
                  <ListGroupHeader title={`${selectedOrder.lines.length} item${selectedOrder.lines.length === 1 ? '' : 's'}`} description="Original order pricing" />
                  {selectedOrder.lines.map((line) => (
                    <ListItem
                      key={line.id}
                      description={`${line.variantTitle} · Qty ${line.quantity}`}
                      title={line.title}
                      trailing={formatMoney(line.unitPrice)}
                    />
                  ))}
                </ListGroup>

                {canRetryPayment ? (
                  <Box className="gap-3 rounded-lg border border-border p-4" testID="order-payment-recovery">
                    <Box className="gap-1">
                      <Text variant="heading">Payment needs attention</Text>
                      <Text variant="body">Your last payment did not complete. Retry it before fulfillment can begin.</Text>
                    </Box>
                    <Box className="self-start">
                      <Button
                        disabled={busy}
                        accessibilityLabel={`Retry payment for order ${selectedOrder.number}`}
                        onPress={() => void retryPayment()}
                      >
                        {busy ? 'Retrying payment…' : 'Retry payment'}
                      </Button>
                    </Box>
                  </Box>
                ) : null}

                {canCustomerCancel ? (
                  <Box className="gap-3 rounded-lg border border-border p-4" testID="order-cancel-action">
                    <Box className="gap-1">
                      <Text variant="heading">Need to cancel?</Text>
                      <Text variant="body">You can cancel before fulfillment starts. A paid demo order is refunded when cancellation succeeds.</Text>
                    </Box>
                    <Input
                      accessibilityLabel="Cancellation reason"
                      value={cancellationReason}
                      onChangeText={setCancellationReason}
                      placeholder="Why are you cancelling?"
                    />
                    <Box className="self-start">
                      <AlertDialog>
                        <AlertDialogTrigger
                          variant="outline"
                          disabled={busy || cancellationReason.trim().length < 5}
                          accessibilityLabel={`Cancel order ${selectedOrder.number}`}
                        >
                          Cancel order
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogTitle>Cancel order {selectedOrder.number}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This stops fulfillment for this demo order and marks its paid amount as refunded. This action cannot be undone.
                          </AlertDialogDescription>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep order</AlertDialogCancel>
                            <AlertDialogAction disabled={busy} onPress={() => void cancelOrder()}>Confirm cancellation</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </Box>
                  </Box>
                ) : null}

                {canReview ? (
                  <Box className="gap-3 rounded-lg border border-border p-4" testID="order-review-actions">
                    <Box className="gap-1">
                      <Text variant="heading">Share your experience</Text>
                      <Text variant="body">Review a delivered item to help other shoppers.</Text>
                    </Box>
                    <Box className="flex-row flex-wrap gap-2">
                      {selectedOrder.lines.map((line) => (
                        <Button
                          key={line.id}
                          variant="outline"
                          accessibilityLabel={`Review ${line.title}`}
                          onPress={() => navigate(`/conformance/product-review?orderId=${encodeURIComponent(selectedOrder.id)}&productId=${encodeURIComponent(line.productId)}`)}
                        >
                          Review {line.title}
                        </Button>
                      ))}
                    </Box>
                  </Box>
                ) : null}

                {selectedOrder.paymentState === 'paid' && selectedOrder.fulfillmentState === 'delivered' ? (
                  <Box className="gap-3 rounded-lg border border-border p-4" testID="order-return-action">
                    <Box className="gap-1">
                      <Text variant="heading">Need to send something back?</Text>
                      <Text variant="body">Start a return request and our returns team will review it.</Text>
                    </Box>
                    <Box className="self-start">
                      <Button
                        variant="outline"
                        accessibilityLabel={`Start a return for order ${selectedOrder.number}`}
                        onPress={() => navigate(`/conformance/return-request?orderId=${encodeURIComponent(selectedOrder.id)}`)}
                      >
                        Start a return
                      </Button>
                    </Box>
                  </Box>
                ) : null}
              </Card>

              <Box className="min-w-0 flex-1 gap-5">
                <Card className="gap-3 p-5 md:p-6">
                  <Text variant="heading">Order summary</Text>
                  <DescriptionList testID="order-detail-summary">
                    <DescriptionItem label="Subtotal" value={formatMoney(selectedOrder.subtotal)} />
                    <DescriptionItem label="Discount" value={formatMoney(selectedOrder.discount)} />
                    <DescriptionItem label="Shipping" value={formatMoney(selectedOrder.shipping)} />
                    <DescriptionItem label="Delivery method" value={shippingMethodLabel(selectedOrder)} />
                    <DescriptionItem label="Payment method" value={paymentMethodLabel(selectedOrder)} />
                    <DescriptionItem label="Tax" value={formatMoney(selectedOrder.tax)} />
                    <DescriptionItem label="Total" value={formatMoney(selectedOrder.total)} />
                  </DescriptionList>
                </Card>

                <Card className="gap-3 p-5 md:p-6">
                  <Text variant="heading">Delivery address</Text>
                  <Text variant="body">{selectedOrder.shippingAddress.fullName}</Text>
                  <Text variant="body">{selectedOrder.shippingAddress.line1}</Text>
                  <Text variant="body">
                    {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.region} {selectedOrder.shippingAddress.postalCode}
                  </Text>
                </Card>
              </Box>
            </Box>
          </Box>
        ) : null}
      </Box>
    </Screen>
  );
}
