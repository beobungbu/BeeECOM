import { createBeeEcomClient } from '@beeecom/api-client';
import { formatMoney } from '@beeecom/app-ui';
import type { Customer, Order, ReturnRequest } from '@beeecom/domain';
import {
  Badge,
  Box,
  Button,
  Card,
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

export function ReturnOperationsConformance() {
  const [returnRequest, setReturnRequest] = React.useState<ReturnRequest | null>(null);
  const [order, setOrder] = React.useState<Order | null>(null);
  const [customer, setCustomer] = React.useState<Customer | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [actionPending, setActionPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const returns = await api.admin.returns.list();
        const nextReturn = returns[0];
        if (!nextReturn) throw new Error('There are no return requests in this scenario.');
        const [nextOrder, nextCustomer] = await Promise.all([
          api.orders.get(nextReturn.orderId),
          api.customers.get(nextReturn.customerId),
        ]);
        if (!active) return;
        setReturnRequest(nextReturn);
        setOrder(nextOrder);
        setCustomer(nextCustomer);
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : 'Unable to load this return request.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const issueRefund = React.useCallback(async () => {
    if (!returnRequest || actionPending) return;
    setActionPending(true);
    setError(null);
    try {
      const updatedReturn = await api.admin.returns.transition(returnRequest.id, { action: 'refund' });
      const updatedOrder = await api.orders.get(returnRequest.orderId);
      setReturnRequest(updatedReturn);
      setOrder(updatedOrder);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to issue the refund.');
    } finally {
      setActionPending(false);
    }
  }, [actionPending, returnRequest]);

  return (
    <Screen>
      <Box className="mx-auto w-full max-w-6xl gap-6 p-4 md:p-8">
        <Box className="gap-3 px-1 md:flex-row md:items-end md:justify-between">
          <Box className="min-w-0 flex-1 gap-1">
            <Text variant="body">Returns</Text>
            <Text variant="title">Return request</Text>
            <Text variant="body">
              Review the customer request, original order and refund status in one place.
            </Text>
          </Box>
          {returnRequest ? <Badge>{returnRequest.state}</Badge> : null}
        </Box>

        {loading ? (
          <Card className="p-5 md:p-6">
            <Text variant="body">Loading return details…</Text>
          </Card>
        ) : null}

        {error ? (
          <Card className="gap-2 p-5 md:p-6">
            <Text variant="heading">Return action needs attention</Text>
            <Text variant="body">{error}</Text>
          </Card>
        ) : null}

        {returnRequest && order && customer ? (
          <>
            <Box className="gap-5 lg:flex-row lg:items-start">
              <Box className="min-w-0 flex-[1.35] gap-5">
                <Card className="gap-4 p-5 md:p-6">
                  <Box className="gap-1">
                    <Text variant="heading">Return summary</Text>
                    <Text variant="body">
                      {customer.displayName} requested a return for order {order.number}.
                    </Text>
                  </Box>
                  <DescriptionList testID="return-summary">
                    <DescriptionItem label="Return ID" value={returnRequest.id} />
                    <DescriptionItem label="Order" value={order.number} />
                    <DescriptionItem label="Customer" value={customer.displayName} />
                    <DescriptionItem label="Reason" value={returnRequest.reason} />
                    <DescriptionItem label="Requested" value={returnRequest.requestedAt} />
                    <DescriptionItem label="Refund amount" value={formatMoney(order.total)} />
                  </DescriptionList>
                </Card>

                <Card className="gap-4 p-5 md:p-6">
                  <Box className="gap-1">
                    <Text variant="heading">Items in this return</Text>
                    <Text variant="body">Original order lines included in this return request.</Text>
                  </Box>
                  <ListGroup accessibilityLabel="Returned items" testID="return-items">
                    <ListGroupHeader
                      title={`${order.lines.length} item${order.lines.length === 1 ? '' : 's'}`}
                      description={`Order ${order.number}`}
                    />
                    {order.lines.map((line) => (
                      <ListItem
                        key={line.id}
                        title={line.title}
                        description={`${line.variantTitle} · Qty ${line.quantity}`}
                        trailing={formatMoney(line.unitPrice)}
                      />
                    ))}
                  </ListGroup>
                </Card>
              </Box>

              <Box className="min-w-0 flex-1 gap-5">
                <Card className="gap-4 p-5 md:p-6">
                  <Box className="flex-row flex-wrap items-center justify-between gap-2">
                    <Text variant="heading">Refund decision</Text>
                    <Badge>{returnRequest.state}</Badge>
                  </Box>
                  <Box testID="return-decision-metadata">
                    <MetadataRow label="Return status" value={returnRequest.state} />
                    <MetadataRow label="Payment" value={order.paymentState} />
                    <MetadataRow label="Fulfillment" value={order.fulfillmentState} />
                    <MetadataRow label="Total" value={formatMoney(order.total)} />
                  </Box>
                  {returnRequest.state === 'approved' ? (
                    <Button
                      accessibilityLabel="Issue refund"
                      disabled={actionPending}
                      onPress={() => void issueRefund()}
                      testID="issue-refund"
                    >
                      {actionPending ? 'Issuing refund…' : `Issue ${formatMoney(order.total)} refund`}
                    </Button>
                  ) : (
                    <Box className="gap-1" testID="refund-complete">
                      <Text variant="heading">Refund complete</Text>
                      <Text variant="body">The return and original payment are marked refunded.</Text>
                    </Box>
                  )}
                </Card>

                <Card className="gap-4 p-5 md:p-6">
                  <Box className="gap-1">
                    <Text variant="heading">Return timeline</Text>
                    <Text variant="body">A concise operational history for support and finance teams.</Text>
                  </Box>
                  <Timeline testID="return-timeline">
                    <TimelineItem
                      title="Return requested"
                      description={returnRequest.reason}
                      meta={returnRequest.requestedAt}
                      status="primary"
                    />
                    <TimelineItem
                      title="Return approved"
                      description="Eligible for refund"
                      meta={returnRequest.updatedAt}
                      status="success"
                    />
                    {returnRequest.state === 'refunded' ? (
                      <TimelineItem
                        title="Refund issued"
                        description={formatMoney(order.total)}
                        meta={returnRequest.updatedAt}
                        status="success"
                      />
                    ) : null}
                  </Timeline>
                </Card>
              </Box>
            </Box>
          </>
        ) : null}
      </Box>
    </Screen>
  );
}
