import { createBeeEcomClient } from '@beeecom/api-client';
import { formatMoney } from '@beeecom/app-ui';
import type { Product, Promotion } from '@beeecom/domain';
import {
  BeeUIProvider,
  Box,
  Button,
  Card,
  Screen,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@beemvp/beeui-ui';
import * as React from 'react';

const api = createBeeEcomClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8787',
});

export function App() {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [promotions, setPromotions] = React.useState<Promotion[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [catalog, promoList] = await Promise.all([
        api.catalog.listProducts({ pageSize: 48, sort: 'featured' }),
        api.promotions.list(),
      ]);
      setProducts(catalog.items);
      setPromotions(promoList);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load admin data.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const lowStock = products.reduce(
    (count, product) => count + product.variants.filter((variant) => variant.inventoryState === 'low-stock').length,
    0,
  );
  const outOfStock = products.reduce(
    (count, product) => count + product.variants.filter((variant) => variant.inventoryState === 'out-of-stock').length,
    0,
  );
  const activePromotions = promotions.filter((promotion) => promotion.active).length;

  return (
    <BeeUIProvider>
      <Screen>
        <Box className="mx-auto w-full max-w-screen-2xl gap-6 p-4 md:p-8">
          <Box className="flex-row flex-wrap items-center justify-between gap-4">
            <Box className="gap-1">
              <Text variant="title">BeeECOM Admin</Text>
              <Text variant="body">Responsive operations surface powered by the same persistent demo API.</Text>
            </Box>
            <Button onPress={() => void refresh()}>Refresh</Button>
          </Box>

          <Box className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="gap-1 p-5">
              <Text variant="body">Products</Text>
              <Text variant="title">{products.length}</Text>
            </Card>
            <Card className="gap-1 p-5">
              <Text variant="body">Low-stock variants</Text>
              <Text variant="title">{lowStock}</Text>
            </Card>
            <Card className="gap-1 p-5">
              <Text variant="body">Out-of-stock variants</Text>
              <Text variant="title">{outOfStock}</Text>
            </Card>
            <Card className="gap-1 p-5">
              <Text variant="body">Active promotions</Text>
              <Text variant="title">{activePromotions}</Text>
            </Card>
          </Box>

          {loading ? (
            <Card className="p-6">
              <Text variant="body">Loading catalog operations data…</Text>
            </Card>
          ) : null}

          {error ? (
            <Card className="gap-3 p-6">
              <Text variant="title">Admin data unavailable</Text>
              <Text variant="body">{error}</Text>
              <Button onPress={() => void refresh()}>Try again</Button>
            </Card>
          ) : null}

          {!loading && !error ? (
            <Card className="gap-4 p-4 md:p-6">
              <Box className="gap-1">
                <Text variant="title">Catalog & inventory</Text>
                <Text variant="body">Dense table composition intentionally exercises BeeUI's caller-owned Table primitive.</Text>
              </Box>
              <Table accessibilityLabel="Product catalog inventory table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>State</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.flatMap((product) =>
                    product.variants.map((variant) => (
                      <TableRow key={variant.id}>
                        <TableCell>{product.title}</TableCell>
                        <TableCell>{variant.sku}</TableCell>
                        <TableCell>{formatMoney(variant.price)}</TableCell>
                        <TableCell>{variant.inventoryQuantity}</TableCell>
                        <TableCell>{variant.inventoryState}</TableCell>
                      </TableRow>
                    )),
                  )}
                </TableBody>
              </Table>
            </Card>
          ) : null}
        </Box>
      </Screen>
    </BeeUIProvider>
  );
}
