import { createBeeEcomClient } from '@beeecom/api-client';
import { formatMoney } from '@beeecom/app-ui';
import type { Product } from '@beeecom/domain';
import {
  Badge,
  Box,
  Breadcrumb,
  BreadcrumbItem,
  Card,
  Link,
  Pagination,
  PaginationItem,
  Screen,
  Stepper,
  StepperItem,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Text,
} from '@beemvp/beeui-ui';
import * as React from 'react';

const api = createBeeEcomClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8787',
});

const PAGE_SIZE = 2;
type Surface = 'catalog' | 'checkout';

export function NavigationConformance() {
  const [surface, setSurface] = React.useState<Surface>('catalog');
  const [page, setPage] = React.useState(1);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [total, setTotal] = React.useState(0);
  const [selected, setSelected] = React.useState<Product | null>(null);
  const [checkoutStep, setCheckoutStep] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void api.catalog.listProducts({ page, pageSize: PAGE_SIZE, sort: 'newest' })
      .then((result) => {
        if (!active) return;
        setProducts(result.items);
        setTotal(result.total);
      })
      .catch((cause) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : 'Unable to load catalog navigation data.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const visiblePages = Array.from({ length: pageCount }, (_, index) => index + 1).slice(0, 5);

  return (
    <Screen>
      <Box className="mx-auto w-full max-w-5xl gap-5 p-4 md:p-8">
        <Card className="gap-2 p-5 md:p-6">
          <Box className="flex-row flex-wrap items-center gap-2">
            <Text variant="title">Commerce navigation acceptance</Text>
            <Badge>router-neutral</Badge>
          </Box>
          <Text variant="body">
            BeeECOM owns routing, paging and checkout workflow state; BeeUI owns the public navigation semantics and controls.
          </Text>
        </Card>

        <Tabs value={surface} onValueChange={(value) => setSurface(value as Surface)}>
          <TabsList accessibilityLabel="Commerce surfaces">
            <TabsTrigger value="catalog">Catalog</TabsTrigger>
            <TabsTrigger value="checkout">Checkout progress</TabsTrigger>
          </TabsList>

          <TabsContent value="catalog">
            <Box testID="catalog-panel" className="gap-5 py-4">
              {selected ? (
                <Card className="gap-4 p-5 md:p-6">
                  <Breadcrumb accessibilityLabel="Product breadcrumb">
                    <BreadcrumbItem onPress={() => setSelected(null)}>Catalog</BreadcrumbItem>
                    <BreadcrumbItem current>{selected.title}</BreadcrumbItem>
                  </Breadcrumb>
                  <Box className="gap-1">
                    <Text variant="title">{selected.title}</Text>
                    <Text variant="body">{selected.description}</Text>
                    <Text variant="body">
                      {selected.variants[0] ? formatMoney(selected.variants[0].price) : 'No purchasable variant'}
                    </Text>
                  </Box>
                  <Link onPress={() => setSelected(null)}>Back to catalog results</Link>
                </Card>
              ) : (
                <Card className="gap-4 p-5 md:p-6">
                  <Box className="gap-1">
                    <Text variant="title">Server-paged catalog</Text>
                    <Text testID="catalog-page-summary" variant="body">
                      Page {page} of {pageCount} · {total} products
                    </Text>
                  </Box>

                  {loading ? <Text variant="body">Loading catalog page…</Text> : null}
                  {error ? <Text variant="body">{error}</Text> : null}

                  {!loading && !error ? (
                    <Box className="grid gap-3 md:grid-cols-2">
                      {products.map((product) => (
                        <Card key={product.id} className="gap-2 p-4">
                          <Text variant="title">{product.title}</Text>
                          <Text variant="body">{product.subtitle ?? product.description}</Text>
                          <Link onPress={() => setSelected(product)}>View {product.title} details</Link>
                        </Card>
                      ))}
                    </Box>
                  ) : null}

                  <Pagination
                    accessibilityLabel="Catalog pagination"
                    page={page}
                    pageCount={pageCount}
                    onPageChange={(nextPage) => {
                      setSelected(null);
                      setPage(nextPage);
                    }}
                  >
                    <PaginationItem type="previous" />
                    {visiblePages.map((pageNumber) => (
                      <PaginationItem key={pageNumber} page={pageNumber} />
                    ))}
                    <PaginationItem type="next" />
                  </Pagination>
                </Card>
              )}
            </Box>
          </TabsContent>

          <TabsContent value="checkout">
            <Card testID="checkout-panel" className="mt-4 gap-4 p-5 md:p-6">
              <Box className="gap-1">
                <Text variant="title">Checkout workflow preview</Text>
                <Text testID="checkout-step-summary" variant="body">Current application-owned step: {checkoutStep}</Text>
              </Box>
              <Stepper currentStep={checkoutStep} onStepChange={setCheckoutStep}>
                <StepperItem
                  step={1}
                  title="Cart"
                  description="Review items and promotion totals."
                  onPress={() => undefined}
                />
                <StepperItem
                  step={2}
                  title="Delivery"
                  description="Confirm the customer shipping address."
                  onPress={() => undefined}
                />
                <StepperItem
                  step={3}
                  title="Review"
                  description="Review the simulated payment before placing the order."
                  onPress={() => undefined}
                />
              </Stepper>
            </Card>
          </TabsContent>
        </Tabs>
      </Box>
    </Screen>
  );
}
