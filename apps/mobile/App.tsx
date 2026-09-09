import './global.css';

import { createBeeEcomClient } from '@beeecom/api-client';
import { ProductCard } from '@beeecom/app-ui';
import type { Product } from '@beeecom/domain';
import { BeeUIProvider, Box, Button, Card, SafeArea, Screen, Text } from '@beemvp/beeui-ui';
import * as React from 'react';
import { Platform, ScrollView, useWindowDimensions } from 'react-native';

const localApiBaseUrl = Platform.select({
  android: 'http://10.0.2.2:8787',
  default: 'http://127.0.0.1:8787',
});

const api = createBeeEcomClient({
  baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? localApiBaseUrl ?? 'http://127.0.0.1:8787',
});

export default function App() {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Product | null>(null);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

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
        <SafeArea className="flex-1" edges={['top', 'left', 'right']}>
          <ScrollView
            contentContainerStyle={{
              alignSelf: 'center',
              gap: 20,
              maxWidth: isTablet ? 760 : undefined,
              padding: 16,
              width: '100%',
            }}
          >
            <Box className="gap-2 py-4">
              <Text variant="title">BeeECOM Mobile</Text>
              <Text variant="body">
                Native iOS/Android storefront consuming the same Worker API and BeeUI package as the Web showcase.
              </Text>
              <Text variant="body">Layout: {isTablet ? 'tablet' : 'phone'} · Platform: {Platform.OS}</Text>
              <Button onPress={() => void loadProducts()}>Refresh catalog</Button>
            </Box>

            {loading ? (
              <Card className="gap-2 p-5">
                <Text variant="title">Loading catalog…</Text>
                <Text variant="body">Reading deterministic products from the shared API.</Text>
              </Card>
            ) : null}

            {error ? (
              <Card className="gap-3 p-5">
                <Text variant="title">Catalog unavailable</Text>
                <Text variant="body">{error}</Text>
                <Button onPress={() => void loadProducts()}>Try again</Button>
              </Card>
            ) : null}

            {!loading && !error && products.length === 0 ? (
              <Card className="gap-2 p-5">
                <Text variant="title">No products</Text>
                <Text variant="body">The active dummy-data scenario intentionally has an empty catalog.</Text>
              </Card>
            ) : null}

            {!loading && !error
              ? products.map((product) => (
                  <ProductCard key={product.id} product={product} onPress={setSelected} />
                ))
              : null}

            {selected ? (
              <Card className="gap-2 p-5">
                <Text variant="title">Selected: {selected.title}</Text>
                <Text variant="body">{selected.description}</Text>
                <Button variant="outline" onPress={() => setSelected(null)}>Clear selection</Button>
              </Card>
            ) : null}
          </ScrollView>
        </SafeArea>
      </Screen>
    </BeeUIProvider>
  );
}
