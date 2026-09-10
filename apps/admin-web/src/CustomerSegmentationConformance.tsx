import { createBeeEcomClient } from '@beeecom/api-client';
import { formatMoney } from '@beeecom/app-ui';
import type { Customer } from '@beeecom/domain';
import {
  Box,
  Card,
  Radio,
  RadioGroup,
  Screen,
  Switch,
  Text,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@beemvp/beeui-ui';
import * as React from 'react';

const api = createBeeEcomClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8787',
});

export function CustomerSegmentationConformance() {
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = React.useState('cust-ava');
  const [vipOnly, setVipOnly] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    void api.admin.customers.list()
      .then((next) => {
        if (active) setCustomers(next);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load canonical customers.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const visibleCustomers = React.useMemo(
    () => customers.filter((customer) => !vipOnly || customer.tier === 'vip'),
    [customers, vipOnly],
  );

  React.useEffect(() => {
    if (visibleCustomers.length === 0) return;
    if (!visibleCustomers.some((customer) => customer.id === selectedCustomerId)) {
      setSelectedCustomerId(visibleCustomers[0]!.id);
    }
  }, [selectedCustomerId, visibleCustomers]);

  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId) ?? null;

  return (
    <Screen>
      <Box className="mx-auto w-full max-w-4xl gap-5 p-4 md:p-8">
        <Card className="gap-2 p-5 md:p-6">
          <Text variant="title">Customer segmentation acceptance</Text>
          <Text variant="body">
            BeeECOM loads customer identity, tier and lifetime value from Worker + D1; BeeUI owns radio, switch and tooltip semantics.
          </Text>
        </Card>

        {loading ? <Card className="p-5"><Text variant="body">Loading canonical customers…</Text></Card> : null}
        {error ? <Card className="p-5"><Text variant="body">{error}</Text></Card> : null}

        {!loading && !error ? (
          <Card className="gap-5 p-5 md:p-6">
            <Box className="flex-row flex-wrap items-center justify-between gap-3">
              <Box className="gap-1">
                <Text variant="heading">Customer filter</Text>
                <Text variant="body">Show only persisted VIP customer records.</Text>
              </Box>
              <Switch
                accessibilityLabel="VIP customers only"
                onValueChange={setVipOnly}
                testID="vip-only-switch"
                value={vipOnly}
              />
            </Box>

            <RadioGroup
              accessibilityLabel="Customer selection"
              onValueChange={setSelectedCustomerId}
              testID="customer-selection-group"
              value={selectedCustomerId}
            >
              {visibleCustomers.map((customer) => (
                <Radio
                  key={customer.id}
                  label={`${customer.displayName} — ${customer.tier}`}
                  testID={`customer-radio-${customer.id}`}
                  value={customer.id}
                />
              ))}
            </RadioGroup>

            <Text testID="customer-visible-count" variant="body">
              {visibleCustomers.length} visible customer{visibleCustomers.length === 1 ? '' : 's'}
            </Text>

            {selectedCustomer ? (
              <Card className="gap-3 p-4" testID="selected-customer-summary">
                <Text variant="heading">{selectedCustomer.displayName}</Text>
                <Text variant="body">{selectedCustomer.email}</Text>
                <Text variant="body">Tier: {selectedCustomer.tier}</Text>
                <Text variant="body">Lifetime value: {formatMoney(selectedCustomer.lifetimeValue)}</Text>

                <Tooltip openDelay={0} closeDelay={0}>
                  <TooltipTrigger
                    accessibilityLabel="Explain lifetime value"
                    onPress={() => setNotice(`Reviewed lifetime value for ${selectedCustomer.displayName}.`)}
                  >
                    Explain lifetime value
                  </TooltipTrigger>
                  <TooltipContent testID="lifetime-value-tooltip">
                    {`Lifetime value for ${selectedCustomer.displayName} is ${formatMoney(selectedCustomer.lifetimeValue)}.`}
                  </TooltipContent>
                </Tooltip>
              </Card>
            ) : null}

            {notice ? <Text testID="customer-segmentation-notice" variant="body">{notice}</Text> : null}
          </Card>
        ) : null}
      </Box>
    </Screen>
  );
}
