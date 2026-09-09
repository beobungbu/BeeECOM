import { createBeeEcomClient } from '@beeecom/api-client';
import { ProductGrid } from '@beeecom/app-ui';
import type { Product } from '@beeecom/domain';
import { BeeUIProvider, Box, Button, Card, Screen, Text } from '@beemvp/beeui-ui';
import * as React from 'react';

const api = createBeeEcomClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8787',
});

export function App() {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [selected, setSelected] = React.useState<Product | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadProducts = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await api.catalog.listProducts({ sort: 'featured', pageSize: 12 });
      setProducts(page.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load the catalog.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  return (
    <BeeUIProvider>
      <Screen>
        <Box className="mx-auto w-full max-w-screen-xl gap-8 p-4 md:p-8">
          <Box className="gap-3 py-8 md:py-12">
            <Text variant="title">BeeECOM</Text>
            <Text variant="body">
              A full e-commerce reference app exercising BeeUI against persistent deterministic demo data.
            </Text>
            <Box className="flex-row flex-wrap gap-3">
              <Button onPress={() => void loadProducts()}>Refresh catalog</Button>
              <Button variant="outline" onPress={() => setSelected(null)}>Clear selection</Button>
            </Box>
          </Box>

          {loading ? (
            <Card className="gap-2 p-6">
              <Text variant="title">Loading catalog…</Text>
              <Text variant="body">Fetching products from the shared Cloudflare Worker API.</Text>
            </Card>
          ) : null}

          {error ? (
            <Card className="gap-3 p-6">
              <Text variant="title">Catalog unavailable</Text>
              <Text variant="body">{error}</Text>
              <Button onPress={() => void loadProducts()}>Try again</Button>
            </Card>
          ) : null}

          {!loading && !error && products.length === 0 ? (
            <Card className="gap-2 p-6">
              <Text variant="title">No products</Text>
              <Text variant="body">This is an intentional empty-state scenario supported by the dummy data service.</Text>
            </Card>
          ) : null}

          {!loading && !error && products.length > 0 ? (
            <Box className="gap-4">
              <Box className="gap-1">
                <Text variant="title">Featured products</Text>
                <Text variant="body">Select a product to prove shared BeeUI composition and API state.</Text>
              </Box>
              <ProductGrid products={products} onProductPress={setSelected} />
            </Box>
          ) : null}

          {selected ? (
            <Card className="gap-2 p-6">
              <Text variant="title">Selected: {selected.title}</Text>
              <Text variant="body">{selected.description}</Text>
              <Text variant="body">Product ID: {selected.id}</Text>
            </Card>
          ) : null}
        </Box>
      </Screen>
    </BeeUIProvider>
  );
}
