import { createBeeEcomClient } from '@beeecom/api-client';
import { formatMoney } from '@beeecom/app-ui';
import type { Customer, Order, ReturnRequest } from '@beeecom/domain';
import {
  AppHeader,
  Badge,
  Box,
  Button,
  Card,
  DescriptionItem,
  DescriptionList,
  Field,
  FormGroup,
  FormMessage,
  HStack,
  IconButton,
  Radio,
  RadioGroup,
  Screen,
  Text,
  Textarea,
  VStack,
} from '@beemvp/beeui-ui';
import * as React from 'react';

const api = createBeeEcomClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8787',
});
const CUSTOMER_ID = 'cust-ava';

type ReasonCode = 'changed-mind' | 'damaged' | 'not-as-expected' | 'other';
const reasons: Array<{ value: ReasonCode; label: string }> = [
  { value: 'changed-mind', label: 'Changed my mind' },
  { value: 'damaged', label: 'Damaged or defective' },
  { value: 'not-as-expected', label: 'Not as expected' },
  { value: 'other', label: 'Other reason' },
];

function navigate(path: string) { window.location.assign(path); }
function orderIdFromLocation() { return new URLSearchParams(window.location.search).get('orderId')?.trim() ?? ''; }
function reasonLabel(code: ReasonCode) { return reasons.find((item) => item.value === code)?.label ?? 'Other reason'; }

export function ReturnRequestConformance() {
  const [orderId] = React.useState(orderIdFromLocation);
  const [customer, setCustomer] = React.useState<Customer | null>(null);
  const [order, setOrder] = React.useState<Order | null>(null);
  const [returnRequest, setReturnRequest] = React.useState<ReturnRequest | null>(null);
  const [reason, setReason] = React.useState<ReasonCode | ''>('');
  const [details, setDetails] = React.useState('');
  const [attempted, setAttempted] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    if (!orderId) {
      setError('Choose a delivered order from your order history to start a return.');
      setLoading(false);
      return;
    }
    try {
      const [nextCustomer, nextOrder, returns] = await Promise.all([
        api.customers.get(CUSTOMER_ID),
        api.orders.get(orderId),
        api.returns.list({ customerId: CUSTOMER_ID, orderId }),
      ]);
      setCustomer(nextCustomer);
      setOrder(nextOrder);
      setReturnRequest(returns[0] ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load return details.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  React.useEffect(() => { void load(); }, [load]);

  const eligible = Boolean(
    customer && order
      && order.customerId === customer.id
      && order.paymentState === 'paid'
      && order.fulfillmentState === 'delivered',
  );
  const reasonInvalid = attempted && !reason;
  const detailsInvalid = attempted && reason === 'other' && details.trim().length < 10;

  async function submit() {
    setAttempted(true);
    setError(null);
    if (!customer || !order || !eligible || !reason || (reason === 'other' && details.trim().length < 10)) return;
    setBusy(true);
    try {
      const label = reasonLabel(reason);
      const fullReason = details.trim() ? `${label} — ${details.trim()}` : label;
      setReturnRequest(await api.returns.create({ orderId: order.id, customerId: customer.id, reason: fullReason }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to submit your return request.');
    } finally {
      setBusy(false);
    }
  }

  const backPath = orderId ? `/conformance/orders/${encodeURIComponent(orderId)}` : '/conformance/orders';

  return (
    <Screen>
      <AppHeader
        title="Start a return"
        description="Tell us what happened and we’ll send your request to the returns team."
        leading={(
          <IconButton accessibilityLabel="Back to order" variant="ghost" onPress={() => navigate(backPath)}>
            <Text aria-hidden variant="heading">‹</Text>
          </IconButton>
        )}
      />

      <Box className="mx-auto w-full max-w-4xl gap-5 p-4 md:p-8">
        {loading ? <Card className="p-6"><Text variant="body">Loading return details…</Text></Card> : null}
        {error ? (
          <Card className="gap-3 p-5 md:p-6">
            <Text variant="heading">We couldn’t complete that return action</Text>
            <FormMessage>{error}</FormMessage>
          </Card>
        ) : null}

        {!loading && customer && order ? (
          <>
            <Card className="gap-4 p-5 md:p-6" testID="return-order-summary">
              <HStack align="start" justify="between" gap="lg" wrap>
                <VStack className="min-w-0 flex-1" gap="xs">
                  <Text variant="heading">Order {order.number}</Text>
                  <Text variant="body">{order.lines.length} item{order.lines.length === 1 ? '' : 's'} · {formatMoney(order.total)}</Text>
                  <Text variant="body">Purchased by {customer.displayName}</Text>
                </VStack>
                <Badge>{order.fulfillmentState === 'delivered' ? 'Delivered' : order.fulfillmentState}</Badge>
              </HStack>
            </Card>

            {returnRequest ? (
              <Card className="gap-4 p-5 md:p-6" testID="submitted-return">
                <HStack align="center" justify="between" gap="lg" wrap>
                  <VStack className="min-w-0 flex-1" gap="xs">
                    <Text variant="heading">Return request received</Text>
                    <Text variant="body">We saved your request. The returns team can now review it.</Text>
                  </VStack>
                  <Badge>{returnRequest.state}</Badge>
                </HStack>
                <DescriptionList>
                  <DescriptionItem label="Order" value={order.number} />
                  <DescriptionItem label="Status" value={returnRequest.state} />
                  <DescriptionItem label="Reason" value={returnRequest.reason} />
                </DescriptionList>
                <Box className="self-start"><Button variant="outline" onPress={() => navigate(backPath)}>Back to order</Button></Box>
              </Card>
            ) : !eligible ? (
              <Card className="gap-2 p-5 md:p-6" testID="return-not-eligible">
                <Text variant="heading">This order isn’t ready for a return</Text>
                <Text variant="body">Returns can be requested after a paid order has been delivered.</Text>
              </Card>
            ) : (
              <Card className="gap-5 p-5 md:p-6" testID="return-request-form">
                <VStack gap="xs">
                  <Text variant="heading">Why are you returning this order?</Text>
                  <Text variant="body">Choose the reason that best matches your experience.</Text>
                </VStack>
                <FormGroup legend="Return reason" required>
                  <RadioGroup value={reason} onValueChange={(value) => setReason(value as ReasonCode)}>
                    {reasons.map((item) => <Radio key={item.value} value={item.value} label={item.label} />)}
                  </RadioGroup>
                </FormGroup>
                {reasonInvalid ? <FormMessage>Select a return reason.</FormMessage> : null}
                <Field
                  label="Additional details"
                  description={reason === 'other' ? 'Required for Other reason; at least 10 characters.' : 'Optional. Add details that may help the returns team.'}
                  required={reason === 'other'}
                  invalid={detailsInvalid}
                  error="Please add at least 10 characters for Other reason."
                >
                  <Textarea value={details} onChangeText={setDetails} maxLength={900} placeholder="Tell us more about the issue" />
                </Field>
                <HStack justify="end" gap="sm" wrap>
                  <Button variant="outline" disabled={busy} onPress={() => navigate(backPath)}>Cancel</Button>
                  <Button disabled={busy} onPress={() => void submit()}>{busy ? 'Submitting…' : 'Submit return request'}</Button>
                </HStack>
              </Card>
            )}
          </>
        ) : null}
      </Box>
    </Screen>
  );
}
