import { createBeeEcomClient } from '@beeecom/api-client';
import { formatMoney } from '@beeecom/app-ui';
import type { Customer, Order } from '@beeecom/domain';
import {
  Badge,
  Box,
  Breadcrumb,
  BreadcrumbItem,
  Button,
  Card,
  DescriptionItem,
  DescriptionList,
  ListGroup,
  ListGroupHeader,
  ListItem,
  Screen,
  Text,
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

export function OrderHistoryConformance() {
  const [customer, setCustomer] = React.useState<Customer | null>(null);
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
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
              ? 'Review order status, items, delivery address and payment summary.'
              : 'Track recent purchases and open an order for full details.'}
          </Text>
        </Box>

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

        {!loading && !error && customer && selectedOrder ? (
          <Box className="gap-5">
            <Card className="gap-4 p-5 md:p-6">
              <Box className="flex-row flex-wrap items-start justify-between gap-3">
                <Box className="min-w-0 flex-1 gap-1">
                  <Text variant="heading">{selectedOrder.number}</Text>
                  <Text variant="body">Placed {selectedOrder.placedAt}</Text>
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

                {selectedOrder.paymentState === 'paid' ? (
                  <Box className="gap-3 rounded-lg border border-border p-4" testID="order-review-actions">
                    <Box className="gap-1">
                      <Text variant="heading">Share your experience</Text>
                      <Text variant="body">Review a purchased item to help other shoppers.</Text>
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
              </Card>

              <Box className="min-w-0 flex-1 gap-5">
                <Card className="gap-3 p-5 md:p-6">
                  <Text variant="heading">Order summary</Text>
                  <DescriptionList testID="order-detail-summary">
                    <DescriptionItem label="Subtotal" value={formatMoney(selectedOrder.subtotal)} />
                    <DescriptionItem label="Discount" value={formatMoney(selectedOrder.discount)} />
                    <DescriptionItem label="Shipping" value={formatMoney(selectedOrder.shipping)} />
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
