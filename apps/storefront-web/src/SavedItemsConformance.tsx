import { createBeeEcomClient } from '@beeecom/api-client';
import { formatMoney } from '@beeecom/app-ui';
import type { Product, Wishlist } from '@beeecom/domain';
import {
  AppHeader,
  Badge,
  Box,
  Button,
  Card,
  EmptyState,
  Link,
  Screen,
  Text,
} from '@beemvp/beeui-ui';
import * as React from 'react';

const api = createBeeEcomClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8787',
});

const CUSTOMER_ID = 'cust-ava';
const CART_ID = 'cart-ava';

function navigate(path: string) {
  window.location.assign(path);
}

export function SavedItemsConformance() {
  const [wishlist, setWishlist] = React.useState<Wishlist | null>(null);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busyProductId, setBusyProductId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextWishlist, catalog] = await Promise.all([
        api.wishlist.get(CUSTOMER_ID),
        api.catalog.listProducts({ pageSize: 48, sort: 'featured' }),
      ]);
      setWishlist(nextWishlist);
      setProducts(catalog.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load saved items.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const savedProducts = wishlist
    ? wishlist.productIds
        .map((id) => products.find((product) => product.id === id))
        .filter((product): product is Product => Boolean(product))
    : [];

  async function removeSaved(product: Product) {
    setBusyProductId(product.id);
    setError(null);
    setNotice(null);
    try {
      const updated = await api.wishlist.remove(CUSTOMER_ID, product.id);
      setWishlist(updated);
      setNotice(`${product.title} removed from saved items.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to remove this saved item.');
    } finally {
      setBusyProductId(null);
    }
  }

  async function addToCart(product: Product) {
    const variant = product.variants.find((item) => item.inventoryQuantity > 0);
    if (!variant) return;
    setBusyProductId(product.id);
    setError(null);
    setNotice(null);
    try {
      await api.carts.addLine(CART_ID, { variantId: variant.id, quantity: 1 });
      setNotice(`${product.title} added to cart.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to add this item to cart.');
    } finally {
      setBusyProductId(null);
    }
  }

  return (
    <Screen>
      <AppHeader
        title="Saved items"
        description="Products you want to keep close for later."
        trailing={wishlist ? <Badge>{wishlist.productIds.length} saved</Badge> : null}
      />

      <Box className="mx-auto w-full max-w-5xl gap-6 p-4 md:p-8">
        <Box className="flex-row flex-wrap items-center gap-3">
          <Link onPress={() => navigate('/conformance/account')}>Back to account</Link>
          <Link onPress={() => navigate('/conformance/collections')}>Browse collections</Link>
          <Link onPress={() => navigate('/conformance/cart')}>View cart</Link>
        </Box>

        {notice ? (
          <Card className="p-4" testID="saved-items-notice">
            <Text variant="body">{notice}</Text>
          </Card>
        ) : null}

        {loading ? (
          <Card className="p-6">
            <Text variant="body">Loading saved items…</Text>
          </Card>
        ) : null}

        {error ? (
          <Card className="gap-3 p-5 md:p-6">
            <Text variant="heading">We couldn’t update saved items</Text>
            <Text variant="body">{error}</Text>
            <Box className="self-start">
              <Button variant="outline" onPress={() => void load()}>Try again</Button>
            </Box>
          </Card>
        ) : null}

        {!loading && !error && savedProducts.length === 0 ? (
          <EmptyState
            title="Nothing saved yet"
            description="Save products while browsing collections and they’ll appear here."
            action={<Button onPress={() => navigate('/conformance/collections')}>Browse collections</Button>}
          />
        ) : null}

        {!loading && !error && savedProducts.length > 0 ? (
          <Box className="grid grid-cols-1 gap-4 sm:grid-cols-2" testID="saved-items-grid">
            {savedProducts.map((product) => {
              const availableVariant = product.variants.find((variant) => variant.inventoryQuantity > 0);
              return (
                <Card key={product.id} testID={`saved-item-${product.id}`} className="gap-4 p-5 md:p-6">
                  <Box className="gap-1">
                    <Text variant="heading">{product.title}</Text>
                    {product.subtitle ? <Text variant="body">{product.subtitle}</Text> : null}
                    <Text variant="body">{product.description}</Text>
                  </Box>
                  <Box className="flex-row flex-wrap items-center gap-2">
                    <Badge>{availableVariant ? 'In stock' : 'Out of stock'}</Badge>
                    {availableVariant ? <Text variant="label">{formatMoney(availableVariant.price)}</Text> : null}
                  </Box>
                  <Box className="flex-row flex-wrap gap-2">
                    <Button
                      disabled={!availableVariant || busyProductId === product.id}
                      accessibilityLabel={`Add ${product.title} to cart`}
                      onPress={() => void addToCart(product)}
                    >
                      Add to cart
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busyProductId === product.id}
                      accessibilityLabel={`Remove ${product.title} from saved items`}
                      onPress={() => void removeSaved(product)}
                    >
                      Remove
                    </Button>
                  </Box>
                </Card>
              );
            })}
          </Box>
        ) : null}
      </Box>
    </Screen>
  );
}
