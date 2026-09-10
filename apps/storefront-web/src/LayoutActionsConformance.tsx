import { createBeeEcomClient } from '@beeecom/api-client';
import { formatMoney } from '@beeecom/app-ui';
import type { Cart, Product, Wishlist } from '@beeecom/domain';
import {
  AppHeader,
  Badge,
  BottomActionBar,
  Box,
  Button,
  Card,
  IconButton,
  Screen,
  Section,
  Separator,
  Text,
} from '@beemvp/beeui-ui';
import * as React from 'react';

const api = createBeeEcomClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8787',
});

const CUSTOMER_ID = 'cust-ava';
const CART_ID = 'cart-ava';
const PRODUCT_ID = 'prod-cloud-tee';
const VARIANT_ID = 'var-cloud-black-s';

export function LayoutActionsConformance() {
  const [product, setProduct] = React.useState<Product | null>(null);
  const [wishlist, setWishlist] = React.useState<Wishlist | null>(null);
  const [cart, setCart] = React.useState<Cart | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    void Promise.all([
      api.catalog.getProduct(PRODUCT_ID),
      api.wishlist.get(CUSTOMER_ID),
      api.carts.get(CART_ID),
    ])
      .then(([nextProduct, nextWishlist, nextCart]) => {
        if (!active) return;
        setProduct(nextProduct);
        setWishlist(nextWishlist);
        setCart(nextCart);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load product acceptance state.');
      });
    return () => {
      active = false;
    };
  }, []);

  const wishlisted = wishlist?.productIds.includes(PRODUCT_ID) ?? false;
  const cartQuantity = cart?.lines.find((line) => line.variantId === VARIANT_ID)?.quantity ?? 0;
  const selectedVariant = product?.variants.find((variant) => variant.id === VARIANT_ID);

  async function toggleWishlist() {
    if (!product || busy) return;
    setBusy(true);
    setError(null);
    try {
      const nextWishlist = wishlisted
        ? await api.wishlist.remove(CUSTOMER_ID, product.id)
        : await api.wishlist.add(CUSTOMER_ID, { productId: product.id });
      setWishlist(nextWishlist);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Wishlist action failed.');
    } finally {
      setBusy(false);
    }
  }

  async function addToCart() {
    if (!selectedVariant || busy) return;
    setBusy(true);
    setError(null);
    try {
      const nextCart = await api.carts.addLine(CART_ID, {
        variantId: selectedVariant.id,
        quantity: 1,
      });
      setCart(nextCart);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Cart action failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <AppHeader
        testID="product-app-header"
        title={product?.title ?? 'Product'}
        description={product?.subtitle ?? 'Loading canonical product…'}
        trailing={
          product ? (
            <IconButton
              accessibilityLabel={`${wishlisted ? 'Remove' : 'Add'} ${product.title} ${wishlisted ? 'from' : 'to'} wishlist`}
              disabled={busy}
              onPress={() => void toggleWishlist()}
            >
              <Text>{wishlisted ? '♥' : '♡'}</Text>
            </IconButton>
          ) : null
        }
      />

      <Box className="mx-auto w-full max-w-5xl flex-1 gap-5 p-4 md:p-8">
        <Card className="gap-4 p-5 md:p-6">
          {error ? <Text testID="layout-actions-error" tone="destructive">{error}</Text> : null}
          {product && selectedVariant ? (
            <>
              <Box className="flex-row flex-wrap items-center gap-2">
                <Badge>{selectedVariant.inventoryState}</Badge>
                <Text variant="body">{product.rating.toFixed(1)} rating · {product.reviewCount} reviews</Text>
              </Box>

              <Section
                testID="product-details-section"
                title="Product details"
                description="Canonical catalog content rendered inside BeeUI layout primitives."
              >
                <Text variant="body">{product.description}</Text>
              </Section>

              <Separator testID="product-structural-separator" decorative={false} />

              <Section title="Selected variant" description={selectedVariant.title}>
                <Box className="gap-1">
                  <Text variant="body">Price: {formatMoney(selectedVariant.price)}</Text>
                  <Text variant="body">Available quantity: {selectedVariant.inventoryQuantity}</Text>
                  <Text testID="cart-quantity" variant="body">Cart quantity: {cartQuantity}</Text>
                </Box>
              </Section>
            </>
          ) : (
            <Text variant="body">Loading product details…</Text>
          )}
        </Card>
      </Box>

      <BottomActionBar testID="product-bottom-action-bar" className="sticky bottom-0">
        <Text tone="muted" variant="caption">Black / S</Text>
        <Button disabled={!selectedVariant || busy} onPress={() => void addToCart()}>
          Add to cart
        </Button>
      </BottomActionBar>
    </Screen>
  );
}
