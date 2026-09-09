import type { BeeEcomClient } from '@beeecom/api-client';
import { formatMoney } from '@beeecom/app-ui';
import type { Customer, Order, Product, Promotion, ReturnRequest, Review } from '@beeecom/domain';
import {
  Badge,
  Box,
  Button,
  Card,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@beemvp/beeui-ui';
import * as React from 'react';

export interface OperationsPanelsProps {
  api: BeeEcomClient;
  products: Product[];
  promotions: Promotion[];
  orders: Order[];
  onCanonicalRefresh(): Promise<void>;
  onNotice(message: string): void;
  onError(message: string): void;
}

export function OperationsPanels(props: OperationsPanelsProps) {
  const [productId, setProductId] = React.useState<string | undefined>();
  const [variantId, setVariantId] = React.useState<string | undefined>();
  const [productTitle, setProductTitle] = React.useState('');
  const [inventoryAdjustment, setInventoryAdjustment] = React.useState('1');
  const [inventoryReason, setInventoryReason] = React.useState('Cycle count');
  const [promotionId, setPromotionId] = React.useState<string | undefined>();
  const [orderId, setOrderId] = React.useState<string | undefined>();
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [returns, setReturns] = React.useState<ReturnRequest[]>([]);
  const [reviews, setReviews] = React.useState<Review[]>([]);
  const [busy, setBusy] = React.useState(false);

  const selectedProduct = productId ? props.products.find((item) => item.id === productId) : undefined;
  const selectedPromotion = promotionId ? props.promotions.find((item) => item.id === promotionId) : undefined;
  const selectedOrder = orderId ? props.orders.find((item) => item.id === orderId) : undefined;

  React.useEffect(() => {
    const nextProductId = productId && props.products.some((item) => item.id === productId)
      ? productId
      : props.products[0]?.id;
    setProductId(nextProductId);
    const product = props.products.find((item) => item.id === nextProductId);
    setProductTitle(product?.title ?? '');
    const nextVariant = product?.variants[0]?.id;
    setVariantId((current) => current && product?.variants.some((item) => item.id === current) ? current : nextVariant);
  }, [productId, props.products]);

  React.useEffect(() => {
    setPromotionId((current) => current && props.promotions.some((item) => item.id === current) ? current : props.promotions[0]?.id);
  }, [props.promotions]);

  React.useEffect(() => {
    setOrderId((current) => current && props.orders.some((item) => item.id === current) ? current : props.orders[0]?.id);
  }, [props.orders]);

  const refreshQueues = React.useCallback(async () => {
    const [customerList, returnList, reviewList] = await Promise.all([
      props.api.admin.customers.list(),
      props.api.admin.returns.list(),
      props.api.admin.reviews.list(),
    ]);
    setCustomers(customerList);
    setReturns(returnList);
    setReviews(reviewList);
  }, [props.api]);

  React.useEffect(() => {
    void refreshQueues().catch((cause) => props.onError(cause instanceof Error ? cause.message : 'Unable to load Admin queues.'));
  }, [refreshQueues]);

  async function run(action: () => Promise<unknown>, success: string, refreshQueuesToo = false) {
    setBusy(true);
    try {
      await action();
      await props.onCanonicalRefresh();
      if (refreshQueuesToo) await refreshQueues();
      props.onNotice(success);
    } catch (cause) {
      props.onError(cause instanceof Error ? cause.message : 'Admin mutation failed.');
    } finally {
      setBusy(false);
    }
  }

  function chooseProduct(nextProductId: string | undefined) {
    setProductId(nextProductId);
    const product = props.products.find((item) => item.id === nextProductId);
    setProductTitle(product?.title ?? '');
    setVariantId(product?.variants[0]?.id);
  }

  const canProcess = selectedOrder?.state === 'placed' && selectedOrder.fulfillmentState === 'unfulfilled';
  const canShip = selectedOrder?.fulfillmentState === 'processing';
  const canDeliver = selectedOrder?.fulfillmentState === 'shipped';
  const canCancel = selectedOrder?.state === 'placed' && ['unfulfilled', 'processing'].includes(selectedOrder.fulfillmentState);
  const canRefund = selectedOrder?.paymentState === 'paid';

  return (
    <Box className="gap-6">
      <Card className="gap-4 p-4 md:p-6">
        <Box className="gap-1">
          <Text variant="title">Catalog operations</Text>
          <Text variant="body">Metadata and inventory changes persist in D1 and are visible to customer surfaces after refresh.</Text>
        </Box>
        {productId ? (
          <Select value={productId} onValueChange={chooseProduct}>
            <SelectTrigger accessibilityLabel="Admin product"><SelectValue placeholder="Choose product" /></SelectTrigger>
            <SelectContent>{props.products.map((product) => <SelectItem key={product.id} value={product.id}>{product.title}</SelectItem>)}</SelectContent>
          </Select>
        ) : <Text variant="body">No products in current scenario.</Text>}

        {selectedProduct ? (
          <Box className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="gap-3 p-4">
              <Text variant="title">Merchandising</Text>
              <Input accessibilityLabel="Product title" value={productTitle} onChangeText={setProductTitle} placeholder="Product title" />
              <Box className="flex-row flex-wrap gap-2">
                <Button disabled={busy || !productTitle.trim()} onPress={() => void run(
                  () => props.api.admin.products.update(selectedProduct.id, { title: productTitle, featured: selectedProduct.featured }),
                  'Product metadata persisted.',
                )}>Save title</Button>
                <Button variant="outline" disabled={busy} onPress={() => void run(
                  () => props.api.admin.products.update(selectedProduct.id, { featured: !selectedProduct.featured }),
                  selectedProduct.featured ? 'Product removed from featured merchandising.' : 'Product promoted to featured merchandising.',
                )}>{selectedProduct.featured ? 'Unfeature' : 'Feature'}</Button>
              </Box>
            </Card>

            <Card className="gap-3 p-4">
              <Text variant="title">Inventory adjustment</Text>
              {variantId ? (
                <Select value={variantId} onValueChange={setVariantId}>
                  <SelectTrigger accessibilityLabel="Inventory variant"><SelectValue placeholder="Choose variant" /></SelectTrigger>
                  <SelectContent>{selectedProduct.variants.map((variant) => (
                    <SelectItem key={variant.id} value={variant.id}>{variant.sku} · {variant.inventoryQuantity} · {variant.inventoryState}</SelectItem>
                  ))}</SelectContent>
                </Select>
              ) : <Text variant="body">No variants.</Text>}
              <Input accessibilityLabel="Inventory adjustment" value={inventoryAdjustment} onChangeText={setInventoryAdjustment} placeholder="+/- quantity" />
              <Input accessibilityLabel="Inventory reason" value={inventoryReason} onChangeText={setInventoryReason} placeholder="Reason" />
              <Button
                disabled={busy || !variantId || !Number.isInteger(Number(inventoryAdjustment)) || Number(inventoryAdjustment) === 0 || !inventoryReason.trim()}
                onPress={() => variantId && void run(
                  () => props.api.admin.products.adjustInventory(selectedProduct.id, { variantId, adjustment: Number(inventoryAdjustment), reason: inventoryReason }),
                  'Inventory adjustment persisted.',
                )}
              >Apply adjustment</Button>
            </Card>
          </Box>
        ) : null}
      </Card>

      <Card className="gap-4 p-4 md:p-6">
        <Text variant="title">Promotions & campaigns</Text>
        {promotionId ? (
          <Select value={promotionId} onValueChange={setPromotionId}>
            <SelectTrigger accessibilityLabel="Promotion campaign"><SelectValue placeholder="Choose promotion" /></SelectTrigger>
            <SelectContent>{props.promotions.map((promotion) => <SelectItem key={promotion.id} value={promotion.id}>{promotion.code} · {promotion.active ? 'active' : 'inactive'}</SelectItem>)}</SelectContent>
          </Select>
        ) : <Text variant="body">No promotions.</Text>}
        {selectedPromotion ? (
          <Box className="flex-row flex-wrap items-center gap-3">
            <Badge>{selectedPromotion.active ? 'active' : 'inactive'}</Badge>
            <Text variant="body">{selectedPromotion.title} · {selectedPromotion.startsAt} → {selectedPromotion.endsAt}</Text>
            <Button disabled={busy} onPress={() => void run(
              () => props.api.admin.promotions.update(selectedPromotion.id, { active: !selectedPromotion.active }),
              selectedPromotion.active ? 'Promotion deactivated.' : 'Promotion activated.',
            )}>{selectedPromotion.active ? 'Deactivate' : 'Activate'}</Button>
          </Box>
        ) : null}
      </Card>

      <Card className="gap-4 p-4 md:p-6">
        <Text variant="title">Order lifecycle</Text>
        {orderId ? (
          <Select value={orderId} onValueChange={setOrderId}>
            <SelectTrigger accessibilityLabel="Operations order"><SelectValue placeholder="Choose order" /></SelectTrigger>
            <SelectContent>{props.orders.map((order) => <SelectItem key={order.id} value={order.id}>{order.number} · {order.paymentState} · {order.fulfillmentState}</SelectItem>)}</SelectContent>
          </Select>
        ) : <Text variant="body">No orders.</Text>}
        {selectedOrder ? (
          <Box className="gap-3">
            <Text variant="title">{selectedOrder.number}</Text>
            <Box className="flex-row flex-wrap gap-2">
              <Badge>{selectedOrder.state}</Badge><Badge>{selectedOrder.paymentState}</Badge><Badge>{selectedOrder.fulfillmentState}</Badge>
              <Text variant="body">{formatMoney(selectedOrder.total)} · customer {selectedOrder.customerId}</Text>
            </Box>
            <Box className="flex-row flex-wrap gap-2">
              <Button disabled={busy || !canProcess} onPress={() => void run(() => props.api.admin.orders.transition(selectedOrder.id, { action: 'process' }), 'Order moved to processing.')}>Process</Button>
              <Button disabled={busy || !canShip} onPress={() => void run(() => props.api.admin.orders.transition(selectedOrder.id, { action: 'ship' }), 'Order marked shipped.')}>Ship</Button>
              <Button disabled={busy || !canDeliver} onPress={() => void run(() => props.api.admin.orders.transition(selectedOrder.id, { action: 'deliver' }), 'Order delivered.')}>Deliver</Button>
              <Button variant="outline" disabled={busy || !canCancel} onPress={() => void run(() => props.api.admin.orders.transition(selectedOrder.id, { action: 'cancel' }), 'Order cancelled.')}>Cancel</Button>
              <Button variant="outline" disabled={busy || !canRefund} onPress={() => void run(() => props.api.admin.orders.transition(selectedOrder.id, { action: 'refund' }), 'Order payment refunded.')}>Refund</Button>
            </Box>
          </Box>
        ) : null}
      </Card>

      <Card className="gap-4 p-4 md:p-6">
        <Box className="flex-row flex-wrap items-center justify-between gap-2">
          <Text variant="title">Customers</Text>
          <Button variant="outline" disabled={busy} onPress={() => void refreshQueues()}>Refresh operations queues</Button>
        </Box>
        <Table accessibilityLabel="Customer operations table">
          <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Email</TableHead><TableHead>Tier</TableHead><TableHead>LTV</TableHead><TableHead>Addresses</TableHead></TableRow></TableHeader>
          <TableBody>{customers.map((customer) => (
            <TableRow key={customer.id}><TableCell>{customer.displayName}</TableCell><TableCell>{customer.email}</TableCell><TableCell>{customer.tier}</TableCell><TableCell>{formatMoney(customer.lifetimeValue)}</TableCell><TableCell>{customer.addresses.length}</TableCell></TableRow>
          ))}</TableBody>
        </Table>
        {customers.length === 0 ? <Text variant="body">No customers in this scenario.</Text> : null}
      </Card>

      <Card className="gap-4 p-4 md:p-6">
        <Text variant="title">Returns & refunds queue</Text>
        {returns.length ? returns.map((item) => (
          <Card key={item.id} className="gap-2 p-4">
            <Box className="flex-row flex-wrap items-center gap-2"><Badge>{item.state}</Badge><Text variant="body">Order {item.orderId} · customer {item.customerId}</Text></Box>
            <Text variant="body">{item.reason}</Text>
            <Box className="flex-row flex-wrap gap-2">
              <Button disabled={busy || item.state !== 'requested'} onPress={() => void run(() => props.api.admin.returns.transition(item.id, { action: 'approve' }), 'Return approved.', true)}>Approve</Button>
              <Button variant="outline" disabled={busy || item.state !== 'requested'} onPress={() => void run(() => props.api.admin.returns.transition(item.id, { action: 'reject' }), 'Return rejected.', true)}>Reject</Button>
              <Button disabled={busy || item.state !== 'approved'} onPress={() => void run(() => props.api.admin.returns.transition(item.id, { action: 'refund' }), 'Return refunded and related order synchronized.', true)}>Refund</Button>
            </Box>
          </Card>
        )) : <Text variant="body">No return requests in this scenario.</Text>}
      </Card>

      <Card className="gap-4 p-4 md:p-6">
        <Text variant="title">Review moderation</Text>
        {reviews.length ? reviews.map((review) => (
          <Card key={review.id} className="gap-2 p-4">
            <Box className="flex-row flex-wrap items-center gap-2"><Badge>{review.status}</Badge><Text variant="body">{review.rating}/5 · product {review.productId}</Text></Box>
            <Text variant="title">{review.title}</Text><Text variant="body">{review.body}</Text>
            <Box className="flex-row flex-wrap gap-2">
              <Button disabled={busy || review.status === 'published'} onPress={() => void run(() => props.api.admin.reviews.moderate(review.id, { status: 'published' }), 'Review published.', true)}>Publish</Button>
              <Button variant="outline" disabled={busy || review.status === 'rejected'} onPress={() => void run(() => props.api.admin.reviews.moderate(review.id, { status: 'rejected' }), 'Review rejected.', true)}>Reject</Button>
            </Box>
          </Card>
        )) : <Text variant="body">No reviews in this scenario.</Text>}
      </Card>
    </Box>
  );
}
