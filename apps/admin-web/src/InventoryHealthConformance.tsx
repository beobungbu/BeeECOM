import { createBeeEcomClient } from '@beeecom/api-client';
import type { Product } from '@beeecom/domain';
import {
  AlertBanner,
  Badge,
  Box,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Screen,
  Skeleton,
  Spinner,
  Stat,
  StatHelpText,
  StatLabel,
  StatValue,
  Text,
} from '@beemvp/beeui-ui';
import * as React from 'react';

const api = createBeeEcomClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8787',
});

export function InventoryHealthConformance() {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    void api.catalog
      .listProducts({ pageSize: 48, sort: 'featured' })
      .then((page) => {
        if (active) setProducts(page.items);
      })
      .catch((cause) => {
        if (!active) return;
        setProducts([]);
        setError(cause instanceof Error ? cause.message : 'Inventory data is temporarily unavailable.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [refreshKey]);

  const variants = products.flatMap((product) => product.variants);
  const inStock = variants.filter((variant) => variant.inventoryState === 'in-stock').length;
  const lowStock = variants.filter((variant) => variant.inventoryState === 'low-stock').length;
  const outOfStock = variants.filter((variant) => variant.inventoryState === 'out-of-stock').length;
  const availableUnits = variants.reduce((sum, variant) => sum + variant.inventoryQuantity, 0);
  const needsAttention = lowStock + outOfStock;

  const refresh = React.useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  return (
    <Screen>
      <Box className="mx-auto w-full max-w-6xl gap-6 p-4 md:p-8">
        <Box className="gap-3 px-1 md:flex-row md:items-end md:justify-between">
          <Box className="min-w-0 flex-1 gap-1">
            <Text variant="body">Inventory</Text>
            <Text variant="title">Inventory health</Text>
            <Text variant="body">
              Monitor stock availability and focus replenishment on the products that need attention first.
            </Text>
          </Box>
          {!loading && !error && products.length > 0 ? (
            <Badge>{needsAttention > 0 ? `${needsAttention} need attention` : 'Healthy'}</Badge>
          ) : null}
        </Box>

        {loading ? (
          <Card className="gap-5 p-5 md:p-6" testID="inventory-health-loading">
            <Box className="flex-row items-center gap-3">
              <Spinner accessibilityLabel="Loading inventory health" />
              <Box className="min-w-0 flex-1 gap-1">
                <Text variant="heading">Checking stock levels</Text>
                <Text variant="body">Preparing the latest inventory overview…</Text>
              </Box>
            </Box>
            <Box className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((item) => (
                <Card key={item} className="gap-3 p-4">
                  <Skeleton className="h-4 w-24" variant="text" />
                  <Skeleton className="h-8 w-16" variant="text" />
                  <Skeleton className="h-4 w-full" variant="text" />
                </Card>
              ))}
            </Box>
          </Card>
        ) : null}

        {!loading && error ? (
          <Card className="p-5 md:p-6" testID="inventory-health-error">
            <ErrorState
              title="Inventory health is unavailable"
              description="We couldn’t load the current stock overview. Try again to continue monitoring inventory."
              action={<Button onPress={refresh}>Try again</Button>}
            />
          </Card>
        ) : null}

        {!loading && !error && products.length === 0 ? (
          <Card className="p-5 md:p-6" testID="inventory-health-empty">
            <EmptyState
              title="No products to monitor"
              description="Add products to the catalog before tracking stock availability and replenishment needs."
              action={<Button onPress={refresh}>Refresh inventory</Button>}
            />
          </Card>
        ) : null}

        {!loading && !error && products.length > 0 ? (
          <>
            <AlertBanner
              description={
                needsAttention > 0
                  ? `${lowStock} low-stock variant${lowStock === 1 ? '' : 's'} and ${outOfStock} out-of-stock variant${outOfStock === 1 ? '' : 's'} should be reviewed.`
                  : 'All tracked variants currently have healthy stock levels.'
              }
              live="polite"
              testID="inventory-health-alert"
              title={needsAttention > 0 ? 'Replenishment recommended' : 'Inventory is healthy'}
              variant={needsAttention > 0 ? 'warning' : 'success'}
            />

            <Box className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" testID="inventory-health-stats">
              <Card className="p-4 md:p-5">
                <Stat testID="inventory-products-stat">
                  <StatLabel>Products</StatLabel>
                  <StatValue>{products.length}</StatValue>
                  <StatHelpText>Active catalog products</StatHelpText>
                </Stat>
              </Card>
              <Card className="p-4 md:p-5">
                <Stat testID="inventory-variants-stat">
                  <StatLabel>Variants</StatLabel>
                  <StatValue>{variants.length}</StatValue>
                  <StatHelpText>{inStock} currently in stock</StatHelpText>
                </Stat>
              </Card>
              <Card className="p-4 md:p-5">
                <Stat testID="inventory-units-stat">
                  <StatLabel>Available units</StatLabel>
                  <StatValue>{availableUnits}</StatValue>
                  <StatHelpText>Across all tracked variants</StatHelpText>
                </Stat>
              </Card>
              <Card className="p-4 md:p-5">
                <Stat testID="inventory-attention-stat">
                  <StatLabel>Needs attention</StatLabel>
                  <StatValue>{needsAttention}</StatValue>
                  <StatHelpText>Low or out of stock</StatHelpText>
                </Stat>
              </Card>
            </Box>

            <Card className="gap-4 p-5 md:p-6">
              <Box className="flex-row flex-wrap items-center justify-between gap-3">
                <Box className="min-w-0 flex-1 gap-1">
                  <Text variant="heading">Stock overview</Text>
                  <Text variant="body">A quick operating snapshot for merchandising and fulfillment teams.</Text>
                </Box>
                <Button variant="outline" onPress={refresh}>Refresh inventory</Button>
              </Box>
              <Box className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Card className="gap-1 p-4">
                  <Text variant="body">In stock</Text>
                  <Text variant="title">{inStock}</Text>
                </Card>
                <Card className="gap-1 p-4">
                  <Text variant="body">Low stock</Text>
                  <Text variant="title">{lowStock}</Text>
                </Card>
                <Card className="gap-1 p-4">
                  <Text variant="body">Out of stock</Text>
                  <Text variant="title">{outOfStock}</Text>
                </Card>
              </Box>
            </Card>
          </>
        ) : null}
      </Box>
    </Screen>
  );
}
