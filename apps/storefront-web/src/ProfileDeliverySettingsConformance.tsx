import { createBeeEcomClient } from '@beeecom/api-client';
import type { Address, Customer } from '@beeecom/domain';
import {
  AppHeader,
  Badge,
  Box,
  Button,
  Card,
  Field,
  HStack,
  IconButton,
  Input,
  Label,
  ListGroup,
  ListGroupHeader,
  Screen,
  SettingsItem,
  Switch,
  Text,
  VStack,
} from '@beemvp/beeui-ui';
import * as React from 'react';

const api = createBeeEcomClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8787',
});

const CUSTOMER_ID = 'cust-ava';
const DEFAULT_LABEL_ID = 'delivery-default-address-label';

type Panel = 'profile' | 'delivery';

type AddressDraft = Pick<Address, 'id' | 'label' | 'fullName' | 'phone' | 'line1' | 'city' | 'region' | 'postalCode' | 'countryCode' | 'isDefault'> & {
  line2: string;
};

function navigate(path: string) {
  window.location.assign(path);
}

function addressDraft(address: Address): AddressDraft {
  return {
    id: address.id,
    label: address.label,
    fullName: address.fullName,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2 ?? '',
    city: address.city,
    region: address.region,
    postalCode: address.postalCode,
    countryCode: address.countryCode,
    isDefault: address.isDefault,
  };
}

function addressSummary(address: Address): string {
  return `${address.line1}, ${address.city}, ${address.region} ${address.postalCode}`;
}

export function ProfileDeliverySettingsConformance() {
  const [customer, setCustomer] = React.useState<Customer | null>(null);
  const [panel, setPanel] = React.useState<Panel>('profile');
  const [displayName, setDisplayName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [delivery, setDelivery] = React.useState<AddressDraft | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const applyCustomer = React.useCallback((next: Customer) => {
    const defaultAddress = next.addresses.find((address) => address.isDefault) ?? next.addresses[0] ?? null;
    setCustomer(next);
    setDisplayName(next.displayName);
    setEmail(next.email);
    setDelivery(defaultAddress ? addressDraft(defaultAddress) : null);
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      applyCustomer(await api.customers.get(CUSTOMER_ID));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load account settings.');
    } finally {
      setLoading(false);
    }
  }, [applyCustomer]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const profileValid = displayName.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const deliveryValid = Boolean(
    delivery
      && delivery.label.trim()
      && delivery.fullName.trim()
      && delivery.phone.trim()
      && delivery.line1.trim()
      && delivery.city.trim()
      && delivery.region.trim()
      && delivery.postalCode.trim()
      && /^[A-Za-z]{2}$/.test(delivery.countryCode.trim()),
  );
  const profileDirty = Boolean(customer && (displayName !== customer.displayName || email !== customer.email));
  const currentAddress = customer && delivery ? customer.addresses.find((address) => address.id === delivery.id) : undefined;
  const deliveryDirty = Boolean(currentAddress && delivery && (
    delivery.label !== currentAddress.label
    || delivery.fullName !== currentAddress.fullName
    || delivery.phone !== currentAddress.phone
    || delivery.line1 !== currentAddress.line1
    || delivery.line2 !== (currentAddress.line2 ?? '')
    || delivery.city !== currentAddress.city
    || delivery.region !== currentAddress.region
    || delivery.postalCode !== currentAddress.postalCode
    || delivery.countryCode.toUpperCase() !== currentAddress.countryCode
    || delivery.isDefault !== currentAddress.isDefault
  ));

  async function saveProfile() {
    if (!customer || !profileValid || !profileDirty) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await api.customers.update(customer.id, {
        displayName: displayName.trim(),
        email: email.trim(),
      });
      applyCustomer(updated);
      setNotice('Profile details saved.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save profile details.');
    } finally {
      setSaving(false);
    }
  }

  async function saveDelivery() {
    if (!customer || !delivery || !deliveryValid || !deliveryDirty) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await api.customers.update(customer.id, {
        address: {
          id: delivery.id,
          label: delivery.label.trim(),
          fullName: delivery.fullName.trim(),
          phone: delivery.phone.trim(),
          line1: delivery.line1.trim(),
          line2: delivery.line2.trim(),
          city: delivery.city.trim(),
          region: delivery.region.trim(),
          postalCode: delivery.postalCode.trim(),
          countryCode: delivery.countryCode.trim().toUpperCase(),
          isDefault: delivery.isDefault,
        },
      });
      applyCustomer(updated);
      setNotice('Delivery address saved.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save delivery address.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <AppHeader
        title="Account settings"
        description="Manage the details we use for your account and deliveries."
        leading={(
          <IconButton accessibilityLabel="Back to account" variant="ghost" onPress={() => navigate('/conformance/account')}>
            <Text aria-hidden variant="heading">‹</Text>
          </IconButton>
        )}
      />

      <Box className="mx-auto w-full max-w-5xl p-4 md:p-8">
        {loading ? (
          <Card className="p-6"><Text variant="body">Loading account settings…</Text></Card>
        ) : null}

        {error ? (
          <Card className="gap-3 p-5 md:p-6">
            <Text variant="heading">We couldn’t save your settings</Text>
            <Text variant="body">{error}</Text>
            <Box className="self-start"><Button variant="outline" onPress={() => void load()}>Try again</Button></Box>
          </Card>
        ) : null}

        {notice ? (
          <Card testID="account-settings-notice" className="mb-5 p-4"><Text variant="body">{notice}</Text></Card>
        ) : null}

        {!loading && customer ? (
          <Box className="gap-6 lg:flex-row lg:items-start">
            <Card className="w-full p-2 lg:w-80 lg:shrink-0">
              <ListGroup accessibilityLabel="Account settings sections" testID="account-settings-sections">
                <ListGroupHeader title="Settings" description="Choose what you want to update." />
                <SettingsItem
                  title="Profile details"
                  description="Name and contact email"
                  value={customer.email}
                  onPress={() => setPanel('profile')}
                  accessibilityState={{ selected: panel === 'profile' }}
                  testID="settings-profile-item"
                />
                <SettingsItem
                  title="Delivery address"
                  description="Default shipping destination"
                  value={delivery?.label ?? 'Not set'}
                  onPress={() => setPanel('delivery')}
                  accessibilityState={{ selected: panel === 'delivery' }}
                  testID="settings-delivery-item"
                />
              </ListGroup>
            </Card>

            <Box className="min-w-0 flex-1">
              {panel === 'profile' ? (
                <Card className="gap-5 p-5 md:p-6" testID="profile-settings-panel">
                  <VStack gap="xs">
                    <Text variant="heading">Profile details</Text>
                    <Text variant="body">Keep your name and email up to date for order and support messages.</Text>
                  </VStack>
                  <Field label="Full name" required>
                    <Input value={displayName} onChangeText={setDisplayName} placeholder="Full name" />
                  </Field>
                  <Field label="Email" required invalid={email.length > 0 && !profileValid} error="Enter a valid email address.">
                    <Input value={email} onChangeText={setEmail} inputMode="email" autoCapitalize="none" placeholder="you@example.com" />
                  </Field>
                  <HStack justify="end" gap="sm" wrap>
                    <Button variant="outline" disabled={!profileDirty || saving} onPress={() => {
                      setDisplayName(customer.displayName);
                      setEmail(customer.email);
                      setError(null);
                      setNotice(null);
                    }}>Reset changes</Button>
                    <Button disabled={!profileDirty || !profileValid || saving} onPress={() => void saveProfile()}>
                      {saving ? 'Saving…' : 'Save profile'}
                    </Button>
                  </HStack>
                </Card>
              ) : null}

              {panel === 'delivery' && delivery ? (
                <Card className="gap-5 p-5 md:p-6" testID="delivery-settings-panel">
                  <VStack gap="xs">
                    <HStack gap="sm" wrap>
                      <Text variant="heading">Delivery address</Text>
                      {delivery.isDefault ? <Badge>Default</Badge> : null}
                    </HStack>
                    <Text testID="delivery-address-summary" variant="body">{currentAddress ? addressSummary(currentAddress) : ''}</Text>
                  </VStack>

                  <Box className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field label="Address label" required>
                      <Input value={delivery.label} onChangeText={(value) => setDelivery({ ...delivery, label: value })} placeholder="Home" />
                    </Field>
                    <Field label="Recipient name" required>
                      <Input value={delivery.fullName} onChangeText={(value) => setDelivery({ ...delivery, fullName: value })} placeholder="Recipient name" />
                    </Field>
                    <Field label="Phone" required>
                      <Input value={delivery.phone} onChangeText={(value) => setDelivery({ ...delivery, phone: value })} inputMode="tel" placeholder="Phone" />
                    </Field>
                    <Field label="Address line" required>
                      <Input value={delivery.line1} onChangeText={(value) => setDelivery({ ...delivery, line1: value })} placeholder="Street address" />
                    </Field>
                    <Field label="Apartment, suite, etc.">
                      <Input value={delivery.line2} onChangeText={(value) => setDelivery({ ...delivery, line2: value })} placeholder="Optional" />
                    </Field>
                    <Field label="City" required>
                      <Input value={delivery.city} onChangeText={(value) => setDelivery({ ...delivery, city: value })} placeholder="City" />
                    </Field>
                    <Field label="State / region" required>
                      <Input value={delivery.region} onChangeText={(value) => setDelivery({ ...delivery, region: value })} placeholder="State / region" />
                    </Field>
                    <Field label="Postal code" required>
                      <Input value={delivery.postalCode} onChangeText={(value) => setDelivery({ ...delivery, postalCode: value })} placeholder="Postal code" />
                    </Field>
                    <Field label="Country code" required description="Use the two-letter country code, for example US.">
                      <Input value={delivery.countryCode} onChangeText={(value) => setDelivery({ ...delivery, countryCode: value })} autoCapitalize="characters" maxLength={2} placeholder="US" />
                    </Field>
                  </Box>

                  <Card className="p-4">
                    <HStack align="center" justify="between" gap="lg" wrap>
                      <VStack className="min-w-0 flex-1" gap="xs">
                        <Label nativeID={DEFAULT_LABEL_ID}>Default delivery address</Label>
                        <Text variant="body">Checkout uses this address first.</Text>
                      </VStack>
                      <Switch
                        accessibilityLabelledBy={DEFAULT_LABEL_ID}
                        disabled={customer.addresses.length === 1 && delivery.isDefault}
                        onValueChange={(value) => setDelivery({ ...delivery, isDefault: value })}
                        value={delivery.isDefault}
                        testID="delivery-default-switch"
                      />
                    </HStack>
                  </Card>

                  <HStack justify="end" gap="sm" wrap>
                    <Button variant="outline" disabled={!deliveryDirty || saving} onPress={() => {
                      if (currentAddress) setDelivery(addressDraft(currentAddress));
                      setError(null);
                      setNotice(null);
                    }}>Reset changes</Button>
                    <Button disabled={!deliveryDirty || !deliveryValid || saving} onPress={() => void saveDelivery()}>
                      {saving ? 'Saving…' : 'Save address'}
                    </Button>
                  </HStack>
                </Card>
              ) : null}
            </Box>
          </Box>
        ) : null}
      </Box>
    </Screen>
  );
}
