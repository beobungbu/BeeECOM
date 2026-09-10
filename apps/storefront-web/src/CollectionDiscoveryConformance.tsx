import { createBeeEcomClient } from '@beeecom/api-client';
import { ProductCard, formatMoney } from '@beeecom/app-ui';
import type { Category, Customer, Product } from '@beeecom/domain';
import {
  Avatar,
  Badge,
  Box,
  Card,
  Chip,
  ChipGroup,
  Link,
  Screen,
  Text,
  VisuallyHidden,
} from '@beemvp/beeui-ui';
import * as React from 'react';

const api = createBeeEcomClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8787',
});

const CUSTOMER_ID = 'cust-ava';

type CollectionValue = 'all' | string;

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function CollectionDiscoveryConformance() {
  const [customer, setCustomer] = React.useState<Customer | null>(null);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [collection, setCollection] = React.useState<CollectionValue>('all');
  const [selectedProduct, setSelectedProduct] = React.useState<Product | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    void Promise.all([api.customers.get(CUSTOMER_ID), api.catalog.listCategories()])
      .then(([nextCustomer, nextCategories]) => {
        if (!active) return;
        setCustomer(nextCustomer);
        setCategories(nextCategories);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load your shopping profile.');
      });
    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setSelectedProduct(null);
    void api.catalog
      .listProducts({
        ...(collection === 'all' ? {} : { category: collection }),
        sort: 'featured',
        pageSize: 24,
      })
      .then((page) => {
        if (active) setProducts(page.items);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load this collection.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [collection]);

  const selectedCategory = categories.find((item) => item.slug === collection);

  return (
    <Screen>
      <Box className="mx-auto w-full max-w-screen-xl gap-7 p-4 md:p-8">
        <Box className="flex-row flex-wrap items-center justify-between gap-4 py-2 md:py-4">
          <Box className="flex-row items-center gap-3">
            <Avatar
              accessibilityLabel={customer ? `${customer.displayName} profile` : 'Customer profile'}
              fallback={customer ? initials(customer.displayName) : 'B'}
              size="lg"
            />
            <Box className="min-w-0 gap-0.5" testID="collection-customer">
              <Text variant="body">Welcome back</Text>
              <Text variant="heading">{customer?.displayName ?? 'BeeECOM shopper'}</Text>
            </Box>
          </Box>
          <Link onPress={() => window.location.assign('/conformance/account-verification')}>
            Account security
          </Link>
        </Box>

        <Box className="gap-2">
          <Text variant="title">Shop collections</Text>
          <Text variant="body">
            {selectedCategory?.description ?? 'Everyday essentials selected for simple, useful wardrobes and daily routines.'}
          </Text>
        </Box>

        <Card className="gap-4 p-4 md:p-5">
          <Box className="flex-row flex-wrap items-center justify-between gap-3">
            <Text variant="heading">Browse by collection</Text>
            <Badge testID="collection-result-count">
              {products.length} product{products.length === 1 ? '' : 's'}
            </Badge>
          </Box>
          <ChipGroup
            accessibilityLabel="Shop collections"
            onValueChange={(next) => {
              const value = Array.isArray(next) ? next[0] : next;
              setCollection(value || 'all');
            }}
            selectionMode="single"
            value={collection}
          >
            <Chip value="all">All</Chip>
            {categories.map((category) => (
              <Chip key={category.id} value={category.slug}>
                {category.name}
              </Chip>
            ))}
          </ChipGroup>
          <VisuallyHidden testID="collection-a11y-summary">
            <Text variant="body">
              Showing {products.length} product{products.length === 1 ? '' : 's'} in {selectedCategory?.name ?? 'all collections'}.
            </Text>
          </VisuallyHidden>
        </Card>

        {loading ? (
          <Card className="p-6">
            <Text variant="body">Loading collection…</Text>
          </Card>
        ) : null}

        {error ? (
          <Card className="gap-2 p-6">
            <Text variant="heading">We couldn’t load this collection</Text>
            <Text variant="body">{error}</Text>
          </Card>
        ) : null}

        {!loading && !error ? (
          <Box className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" testID="collection-products">
            {products.map((product) => (
              <Box key={product.id} testID={`collection-product-${product.id}`}>
                <ProductCard product={product} onPress={setSelectedProduct} />
              </Box>
            ))}
          </Box>
        ) : null}

        {selectedProduct ? (
          <Card className="gap-3 p-5 md:p-6" testID="collection-selected-product">
            <Box className="flex-row flex-wrap items-center justify-between gap-3">
              <Box className="min-w-0 flex-1 gap-1">
                <Text variant="body">Selected product</Text>
                <Text variant="heading">{selectedProduct.title}</Text>
                <Text variant="body">{selectedProduct.description}</Text>
              </Box>
              <Badge>
                {selectedProduct.variants[0] ? formatMoney(selectedProduct.variants[0].price) : 'Unavailable'}
              </Badge>
            </Box>
          </Card>
        ) : null}
      </Box>
    </Screen>
  );
}
