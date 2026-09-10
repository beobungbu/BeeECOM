import { createBeeEcomClient } from '@beeecom/api-client';
import { formatMoney } from '@beeecom/app-ui';
import type { Customer, Order, OrderLine } from '@beeecom/domain';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Box,
  Card,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DescriptionItem,
  DescriptionList,
  ListGroup,
  ListGroupHeader,
  ListItem,
  MetadataRow,
  Screen,
  Text,
  Timeline,
  TimelineItem,
} from '@beemvp/beeui-ui';
import * as React from 'react';

const api = createBeeEcomClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8787',
});

type OrderSection = 'summary' | 'shipping';

export function ContentDisclosureConformance() {
  const [order, setOrder] = React.useState<Order | null>(null);
  const [customer, setCustomer] = React.useState<Customer | null>(null);
  const [section, setSection] = React.useState<OrderSection | null>('summary');
  const [linesOpen, setLinesOpen] = React.useState(false);
  const [activeLineId, setActiveLineId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const orderPage = await api.orders.list({ pageSize: 10 });
        const nextOrder = orderPage.items[0];
        if (!nextOrder) throw new Error('The current demo scenario has no order to inspect.');
        const nextCustomer = await api.customers.get(nextOrder.customerId);
        if (!active) return;
        setOrder(nextOrder);
        setCustomer(nextCustomer);
        setActiveLineId(nextOrder.lines[0]?.id ?? null);
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : 'Unable to load canonical order state.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const activeLine: OrderLine | undefined = order?.lines.find((line) => line.id === activeLineId);

  return (
    <Screen>
      <Box className="mx-auto w-full max-w-5xl gap-5 p-4 md:p-8">
        <Card className="gap-2 p-5 md:p-6">
          <Box className="flex-row flex-wrap items-center gap-2">
            <Text variant="title">Order content & disclosure acceptance</Text>
            <Badge>D1-backed</Badge>
          </Box>
          <Text variant="body">
            BeeECOM owns order/customer selection state. BeeUI owns disclosure, list, metadata and timeline presentation semantics.
          </Text>
        </Card>

        {loading ? (
          <Card className="p-5"><Text variant="body">Loading canonical order state…</Text></Card>
        ) : null}

        {error ? (
          <Card className="gap-2 p-5">
            <Text variant="title">Unable to load order</Text>
            <Text variant="body">{error}</Text>
          </Card>
        ) : null}

        {order && customer ? (
          <>
            <Card className="gap-4 p-5 md:p-6">
              <Box className="flex-row flex-wrap items-center justify-between gap-3">
                <Box className="gap-1">
                  <Text variant="title">Order {order.number}</Text>
                  <Text variant="body">Customer {customer.displayName}</Text>
                </Box>
                <Badge>{order.fulfillmentState}</Badge>
              </Box>

              <Accordion
                value={section}
                onValueChange={(value) => setSection(value as OrderSection | null)}
              >
                <AccordionItem value="summary">
                  <AccordionTrigger>Order summary</AccordionTrigger>
                  <AccordionContent testID="order-summary-region">
                    <DescriptionList testID="order-description-list">
                      <DescriptionItem label="Order number" value={order.number} />
                      <DescriptionItem label="Customer" value={customer.displayName} />
                      <DescriptionItem label="Payment" value={order.paymentState} />
                      <DescriptionItem label="Fulfillment" value={order.fulfillmentState} />
                    </DescriptionList>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="shipping">
                  <AccordionTrigger>Shipping address</AccordionTrigger>
                  <AccordionContent testID="shipping-region">
                    <DescriptionList>
                      <DescriptionItem label="Recipient" value={order.shippingAddress.fullName} />
                      <DescriptionItem label="Address" value={order.shippingAddress.line1} />
                      <DescriptionItem
                        label="City / region"
                        value={`${order.shippingAddress.city}, ${order.shippingAddress.region}`}
                      />
                      <DescriptionItem label="Postal code" value={order.shippingAddress.postalCode} />
                    </DescriptionList>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Card>

            <Card className="gap-4 p-5 md:p-6">
              <Collapsible open={linesOpen} onOpenChange={setLinesOpen}>
                <CollapsibleTrigger>Order lines</CollapsibleTrigger>
                <CollapsibleContent testID="order-lines-region">
                  <ListGroup accessibilityLabel="Order line items">
                    <ListGroupHeader
                      title={`${order.lines.length} line item${order.lines.length === 1 ? '' : 's'}`}
                      description="Select a line to inspect canonical persisted values."
                    />
                    {order.lines.map((line) => (
                      <ListItem
                        key={line.id}
                        title={line.title}
                        description={`${line.variantTitle} · Qty ${line.quantity}`}
                        trailing={formatMoney(line.unitPrice)}
                        onPress={() => setActiveLineId(line.id)}
                      />
                    ))}
                  </ListGroup>
                </CollapsibleContent>
              </Collapsible>

              {activeLine ? (
                <Box testID="active-line-details" className="gap-1">
                  <MetadataRow label="Selected product" value={activeLine.title} />
                  <MetadataRow label="Variant" value={activeLine.variantTitle} />
                  <MetadataRow label="Quantity" value={activeLine.quantity} />
                  <MetadataRow label="Unit price" value={formatMoney(activeLine.unitPrice)} />
                </Box>
              ) : null}
            </Card>

            <Card className="gap-4 p-5 md:p-6">
              <Box className="gap-1">
                <Text variant="title">Lifecycle snapshot</Text>
                <Text variant="body">Current persisted order state rendered as a read-only operational timeline.</Text>
              </Box>
              <Timeline testID="order-timeline">
                <TimelineItem
                  title="Order placed"
                  description={order.state}
                  meta={order.placedAt}
                  status="primary"
                />
                <TimelineItem
                  title="Payment"
                  description={order.paymentState}
                  meta={`Total ${formatMoney(order.total)}`}
                  status={order.paymentState === 'paid' ? 'success' : order.paymentState === 'failed' ? 'destructive' : 'default'}
                />
                <TimelineItem
                  title="Fulfillment"
                  description={order.fulfillmentState}
                  meta={order.updatedAt}
                  status={order.fulfillmentState === 'cancelled' ? 'destructive' : 'success'}
                />
              </Timeline>
            </Card>
          </>
        ) : null}
      </Box>
    </Screen>
  );
}
