import { createBeeEcomClient } from '@beeecom/api-client';
import { formatMoney } from '@beeecom/app-ui';
import type { Product } from '@beeecom/domain';
import {
  Box,
  Card,
  Checkbox,
  Screen,
  SearchInput,
  SegmentedControl,
  SegmentedControlItem,
  Text,
} from '@beemvp/beeui-ui';
import * as React from 'react';

const api = createBeeEcomClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8787',
});

type SortValue = 'featured' | 'price-asc' | 'rating';

export function CatalogDiscoveryConformance() {
  const [draftQuery, setDraftQuery] = React.useState('');
  const [submittedQuery, setSubmittedQuery] = React.useState('');
  const [sort, setSort] = React.useState<SortValue>('featured');
  const [newOnly, setNewOnly] = React.useState(false);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    void api.catalog.listProducts({
      ...(submittedQuery ? { q: submittedQuery } : {}),
      sort,
      tags: newOnly ? ['new'] : [],
      pageSize: 12,
    })
      .then((page) => {
        if (active) setProducts(page.items);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load catalog.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [newOnly, sort, submittedQuery]);

  return (
    <Screen>
      <Box className="mx-auto w-full max-w-5xl gap-5 p-4 md:p-8">
        <Card className="gap-2 p-5 md:p-6">
          <Text variant="title">Catalog discovery acceptance</Text>
          <Text variant="body">
            Search, sort and tag filtering are owned by BeeECOM and executed against the canonical Worker + D1 catalog; BeeUI owns the control semantics.
          </Text>
        </Card>

        <Card className="gap-4 p-5 md:p-6">
          <SearchInput
            accessibilityLabel="Search products"
            onChangeText={setDraftQuery}
            onSearch={setSubmittedQuery}
            placeholder="Search the catalog"
            testID="catalog-search-input"
            value={draftQuery}
          />

          <SegmentedControl
            accessibilityLabel="Catalog sort"
            onValueChange={(value) => setSort(value as SortValue)}
            testID="catalog-sort-control"
            value={sort}
          >
            <SegmentedControlItem value="featured">Featured</SegmentedControlItem>
            <SegmentedControlItem value="price-asc">Price low</SegmentedControlItem>
            <SegmentedControlItem value="rating">Top rated</SegmentedControlItem>
          </SegmentedControl>

          <Checkbox
            checked={newOnly}
            label="New arrivals only"
            onCheckedChange={setNewOnly}
            testID="catalog-new-filter"
          />
        </Card>

        <Card className="gap-4 p-5 md:p-6" testID="catalog-results">
          <Box className="flex-row flex-wrap items-center justify-between gap-2">
            <Text variant="title">Results</Text>
            <Text testID="catalog-result-summary" variant="body">
              {loading ? 'Loading…' : `${products.length} product${products.length === 1 ? '' : 's'}`}
            </Text>
          </Box>

          {error ? <Text variant="body">{error}</Text> : null}
          {!loading && !error && products.length === 0 ? <Text variant="body">No products found.</Text> : null}

          {!loading && !error ? products.map((product) => (
            <Card className="gap-1 p-4" key={product.id} testID={`catalog-result-${product.id}`}>
              <Text variant="heading">{product.title}</Text>
              <Text variant="body">{product.subtitle}</Text>
              <Text variant="body">{formatMoney(product.variants[0]!.price)}</Text>
              <Text variant="body">Rating {product.rating.toFixed(1)}</Text>
            </Card>
          )) : null}
        </Card>
      </Box>
    </Screen>
  );
}
