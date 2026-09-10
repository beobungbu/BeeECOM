import { createBeeEcomClient } from '@beeecom/api-client';
import type { Product } from '@beeecom/domain';
import {
  AlertBanner,
  Box,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Progress,
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

export function StatusConformance() {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    void api.catalog.listProducts({ pageSize: 100, sort: 'featured' })
      .then((result) => {
        if (active) setProducts(result.items);
      })
      .catch((cause) => {
        if (active) {
          setProducts([]);
          setError(cause instanceof Error ? cause.message : 'Unable to load catalog status.');
        }
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

  return (
    <Screen>
      <Box className="mx-auto w-full max-w-5xl gap-5 p-4 md:p-8">
        <Card className="gap-2 p-5 md:p-6">
          <Text variant="title">Commerce status acceptance</Text>
          <Text variant="body">
            Status and loading components reflect canonical catalog data; BeeECOM owns fetching and derived commerce metrics.
          </Text>
        </Card>

        {loading ? (
          <Card testID="status-loading" className="gap-4 p-5 md:p-6">
            <Box className="flex-row items-center gap-3">
              <Spinner accessibilityLabel="Catalog loading" />
              <Text variant="body">Loading canonical catalog status…</Text>
            </Box>
            <Skeleton testID="catalog-loading-skeleton" className="h-6 w-full" variant="text" />
            <Skeleton className="h-20 w-full" variant="block" />
          </Card>
        ) : null}

        {!loading && error ? (
          <Card className="p-5 md:p-6">
            <ErrorState
              title="Catalog unavailable"
              description={error}
              action={<Button onPress={() => setRefreshKey((value) => value + 1)}>Retry catalog</Button>}
            />
          </Card>
        ) : null}

        {!loading && !error && products.length === 0 ? (
          <Card className="p-5 md:p-6">
            <EmptyState
              title="No catalog products"
              description="The canonical catalog currently contains no products."
              action={<Button onPress={() => setRefreshKey((value) => value + 1)}>Reload catalog</Button>}
            />
          </Card>
        ) : null}

        {!loading && !error && products.length > 0 ? (
          <>
            <AlertBanner
              testID="inventory-alert"
              variant={lowStock > 0 || outOfStock > 0 ? 'warning' : 'success'}
              live="polite"
              title={lowStock > 0 || outOfStock > 0 ? 'Inventory attention' : 'Inventory healthy'}
              description={`${lowStock} low-stock variants · ${outOfStock} out-of-stock variants`}
            />

            <Box className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="p-4">
                <Stat>
                  <StatLabel>Products</StatLabel>
                  <StatValue>{products.length}</StatValue>
                  <StatHelpText>Canonical catalog rows</StatHelpText>
                </Stat>
              </Card>
              <Card className="p-4">
                <Stat>
                  <StatLabel>Variants</StatLabel>
                  <StatValue>{variants.length}</StatValue>
                  <StatHelpText>Purchasable SKU records</StatHelpText>
                </Stat>
              </Card>
              <Card className="p-4">
                <Stat>
                  <StatLabel>Available units</StatLabel>
                  <StatValue>{availableUnits}</StatValue>
                  <StatHelpText>Inventory quantity sum</StatHelpText>
                </Stat>
              </Card>
              <Card className="p-4">
                <Stat>
                  <StatLabel>Needs attention</StatLabel>
                  <StatValue>{lowStock + outOfStock}</StatValue>
                  <StatHelpText>Low or out-of-stock variants</StatHelpText>
                </Stat>
              </Card>
            </Box>

            <Card className="gap-3 p-5 md:p-6">
              <Box className="gap-1">
                <Text variant="title">In-stock variant coverage</Text>
                <Text testID="inventory-progress-summary" variant="body">
                  {inStock} of {variants.length} variants are in stock.
                </Text>
              </Box>
              <Progress
                accessibilityLabel="In-stock variant coverage"
                value={inStock}
                max={variants.length}
              />
            </Card>
          </>
        ) : null}
      </Box>
    </Screen>
  );
}
