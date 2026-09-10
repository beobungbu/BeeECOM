import { createBeeEcomClient } from '@beeecom/api-client';
import { formatMoney } from '@beeecom/app-ui';
import type { Customer, Order, Product, Wishlist } from '@beeecom/domain';
import {
  AppHeader,
  Avatar,
  Badge,
  Box,
  Card,
  HStack,
  IconButton,
  Link,
  Screen,
  Section,
  Separator,
  Text,
  VStack,
} from '@beemvp/beeui-ui';
import * as React from 'react';

const api = createBeeEcomClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8787',
});

const CUSTOMER_ID = 'cust-ava';

function navigate(path: string) {
  window.location.assign(path);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function orderStatus(order: Order) {
  if (order.paymentState === 'failed') return 'Payment issue';
  if (order.fulfillmentState === 'delivered') return 'Delivered';
  if (order.fulfillmentState === 'shipped') return 'Shipped';
  if (order.fulfillmentState === 'processing') return 'Processing';
  return 'Order placed';
}

export function AccountHubConformance() {
  const [customer, setCustomer] = React.useState<Customer | null>(null);
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [wishlist, setWishlist] = React.useState<Wishlist | null>(null);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void Promise.all([
      api.customers.get(CUSTOMER_ID),
      api.orders.list({ customerId: CUSTOMER_ID, pageSize: 10 }),
      api.wishlist.get(CUSTOMER_ID),
      api.catalog.listProducts({ pageSize: 48, sort: 'featured' }),
    ])
      .then(([nextCustomer, orderPage, nextWishlist, catalog]) => {
        if (!active) return;
        setCustomer(nextCustomer);
        setOrders(orderPage.items);
        setWishlist(nextWishlist);
        setProducts(catalog.items);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load your account.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const savedProducts = wishlist
    ? wishlist.productIds
        .map((id) => products.find((product) => product.id === id))
        .filter((product): product is Product => Boolean(product))
    : [];
  const recentOrder = orders[0];

  return (
    <Screen>
      <AppHeader
        testID="account-app-header"
        leading={(
          <IconButton accessibilityLabel="Back to shop" variant="ghost" onPress={() => navigate('/conformance/collections')}>
            <Text aria-hidden variant="heading">‹</Text>
          </IconButton>
        )}
        title="Your account"
        description={customer ? `Welcome back, ${customer.displayName}` : 'Orders, saved items and account settings'}
        trailing={customer ? (
          <Avatar
            accessibilityLabel={`${customer.displayName} profile`}
            fallback={initials(customer.displayName)}
            size="md"
            testID="account-avatar"
          />
        ) : null}
      />

      <Box className="mx-auto w-full max-w-5xl p-4 md:p-8">
        {loading ? (
          <Card className="p-6">
            <Text variant="body">Loading your account…</Text>
          </Card>
        ) : null}

        {error ? (
          <Card className="gap-2 p-5 md:p-6">
            <Text variant="heading">We couldn’t load your account</Text>
            <Text variant="body">{error}</Text>
          </Card>
        ) : null}

        {!loading && !error && customer ? (
          <VStack gap="xl">
            <Card className="p-5 md:p-6">
              <HStack align="center" gap="lg" wrap>
                <Avatar fallback={initials(customer.displayName)} size="lg" />
                <VStack className="min-w-0 flex-1" gap="xs">
                  <HStack gap="sm" wrap>
                    <Text variant="heading">{customer.displayName}</Text>
                    <Badge>{customer.tier === 'vip' ? 'VIP member' : 'Member'}</Badge>
                  </HStack>
                  <Text variant="body">{customer.email}</Text>
                  <Text variant="body">Member since {new Date(customer.createdAt).getUTCFullYear()}</Text>
                </VStack>
              </HStack>
            </Card>

            <Section
              testID="account-orders-section"
              title="Recent orders"
              description="Track delivery and review the details of your latest purchases."
              action={<Link onPress={() => navigate('/conformance/orders')}>View all</Link>}
            >
              {recentOrder ? (
                <Card className="gap-4 p-5 md:p-6">
                  <HStack align="start" justify="between" gap="lg" wrap>
                    <VStack className="min-w-0 flex-1" gap="xs">
                      <Text variant="heading">Order {recentOrder.number}</Text>
                      <Text variant="body">{recentOrder.lines.length} item{recentOrder.lines.length === 1 ? '' : 's'}</Text>
                    </VStack>
                    <VStack align="end" gap="xs">
                      <Badge>{orderStatus(recentOrder)}</Badge>
                      <Text variant="label">{formatMoney(recentOrder.total)}</Text>
                    </VStack>
                  </HStack>
                  <Separator decorative />
                  <Link
                    accessibilityLabel={`View order ${recentOrder.number}`}
                    onPress={() => navigate(`/conformance/orders/${encodeURIComponent(recentOrder.id)}`)}
                  >
                    View order details
                  </Link>
                </Card>
              ) : (
                <Card className="p-5 md:p-6">
                  <Text variant="body">Your recent orders will appear here.</Text>
                </Card>
              )}
            </Section>

            <Separator decorative={false} testID="account-structural-separator" />

            <Section
              testID="account-saved-section"
              title="Saved items"
              description="Keep favorites close so you can return to them later."
              action={<Link onPress={() => navigate('/conformance/collections')}>Keep shopping</Link>}
            >
              <Box className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {savedProducts.length > 0 ? savedProducts.map((product) => (
                  <Card key={product.id} testID={`account-saved-${product.id}`} className="gap-2 p-5">
                    <Text variant="heading">{product.title}</Text>
                    {product.subtitle ? <Text variant="body">{product.subtitle}</Text> : null}
                    <HStack gap="sm" wrap>
                      <Badge>{product.variants.some((variant) => variant.inventoryQuantity > 0) ? 'In stock' : 'Out of stock'}</Badge>
                      {product.variants[0] ? <Text variant="label">{formatMoney(product.variants[0].price)}</Text> : null}
                    </HStack>
                  </Card>
                )) : (
                  <Card className="p-5 md:p-6">
                    <Text variant="body">No saved items yet.</Text>
                  </Card>
                )}
              </Box>
            </Section>

            <Section
              testID="account-settings-section"
              title="Account settings"
              description="Manage your profile, delivery details and account security."
            >
              <Box className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Card className="gap-4 p-5 md:p-6">
                  <VStack className="min-w-0 flex-1" gap="xs">
                    <Text variant="heading">Profile & delivery</Text>
                    <Text variant="body">Update your name, email and default delivery address.</Text>
                  </VStack>
                  <Link onPress={() => navigate('/conformance/account-settings')}>Open profile & delivery</Link>
                </Card>
                <Card className="gap-4 p-5 md:p-6">
                  <VStack className="min-w-0 flex-1" gap="xs">
                    <Text variant="heading">Security</Text>
                    <Text variant="body">Review your password and verification settings.</Text>
                  </VStack>
                  <Link onPress={() => navigate('/conformance/account-verification')}>Open security</Link>
                </Card>
              </Box>
            </Section>
          </VStack>
        ) : null}
      </Box>
    </Screen>
  );
}