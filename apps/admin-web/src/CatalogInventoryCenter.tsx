import { createBeeEcomClient } from '@beeecom/api-client';
import type { Product, ProductVariant } from '@beeecom/domain';
import {
  AppHeader,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Field,
  FormGroup,
  FormMessage,
  IconButton,
  Input,
  ListGroup,
  ListGroupHeader,
  ListItem,
  Radio,
  RadioGroup,
  Screen,
  Switch,
  Text,
  Textarea,
} from '@beemvp/beeui-ui';
import * as React from 'react';

const api = createBeeEcomClient({ baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8787' });
type Direction = 'add' | 'remove';

function navigate(path: string) { window.location.assign(path); }
function productUnits(product: Product): number {
  return product.variants.reduce((sum, variant) => sum + variant.inventoryQuantity, 0);
}
function variantStatus(variant: ProductVariant): string {
  if (variant.inventoryState === 'out-of-stock') return 'Out of stock';
  if (variant.inventoryState === 'low-stock') return 'Low stock';
  return 'In stock';
}
function inventorySummary(product: Product): string {
  const attention = product.variants.filter((variant) => variant.inventoryState !== 'in-stock').length;
  return `${product.variants.length} variant${product.variants.length === 1 ? '' : 's'} · ${productUnits(product)} units${attention ? ` · ${attention} need attention` : ''}`;
}

export function CatalogInventoryCenter() {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = React.useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [featured, setFeatured] = React.useState(false);
  const [direction, setDirection] = React.useState<Direction>('add');
  const [quantity, setQuantity] = React.useState('1');
  const [reason, setReason] = React.useState('Cycle count');
  const [confirmed, setConfirmed] = React.useState(false);
  const [attemptedSave, setAttemptedSave] = React.useState(false);
  const [attemptedAdjustment, setAttemptedAdjustment] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [loadVersion, setLoadVersion] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const selectedProduct = selectedProductId
    ? products.find((product) => product.id === selectedProductId) ?? null
    : null;
  const selectedVariant = selectedProduct && selectedVariantId
    ? selectedProduct.variants.find((variant) => variant.id === selectedVariantId) ?? null
    : null;

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await api.catalog.listProducts({ pageSize: 100, sort: 'featured' });
      setProducts(page.items);
      setSelectedProductId((current) => current && page.items.some((product) => product.id === current)
        ? current
        : page.items[0]?.id ?? null);
      setLoadVersion((current) => current + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load the product catalog.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  React.useEffect(() => {
    if (!selectedProduct) {
      setSelectedVariantId(null);
      return;
    }
    setTitle(selectedProduct.title);
    setDescription(selectedProduct.description);
    setFeatured(selectedProduct.featured);
    setSelectedVariantId((current) => current && selectedProduct.variants.some((variant) => variant.id === current)
      ? current
      : selectedProduct.variants[0]?.id ?? null);
    setAttemptedSave(false);
    setAttemptedAdjustment(false);
    setDirection('add');
    setQuantity('1');
    setReason('Cycle count');
    setConfirmed(false);
    setNotice(null);
    setError(null);
  }, [selectedProductId, loadVersion]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredProducts = React.useMemo(() => normalizedQuery
    ? products.filter((product) => [
      product.title,
      product.slug,
      ...product.tags,
      ...product.variants.flatMap((variant) => [variant.sku, variant.title]),
    ].some((value) => value.toLowerCase().includes(normalizedQuery)))
    : products, [normalizedQuery, products]);

  React.useEffect(() => {
    if (filteredProducts.length === 0) {
      if (selectedProductId !== null) setSelectedProductId(null);
      return;
    }
    if (!selectedProductId || !filteredProducts.some((product) => product.id === selectedProductId)) {
      setSelectedProductId(filteredProducts[0]!.id);
    }
  }, [filteredProducts, selectedProductId]);

  const variants = products.flatMap((product) => product.variants);
  const totalUnits = variants.reduce((sum, variant) => sum + variant.inventoryQuantity, 0);
  const lowStock = variants.filter((variant) => variant.inventoryState === 'low-stock').length;
  const outOfStock = variants.filter((variant) => variant.inventoryState === 'out-of-stock').length;

  const titleInvalid = attemptedSave && !title.trim();
  const descriptionInvalid = attemptedSave && !description.trim();
  const quantityNumber = Number(quantity);
  const quantityInvalid = attemptedAdjustment && (!Number.isInteger(quantityNumber) || quantityNumber <= 0);
  const reasonInvalid = attemptedAdjustment && !reason.trim();
  const confirmationInvalid = attemptedAdjustment && !confirmed;
  const negativeInvalid = attemptedAdjustment
    && direction === 'remove'
    && Boolean(selectedVariant)
    && Number.isInteger(quantityNumber)
    && quantityNumber > (selectedVariant?.inventoryQuantity ?? 0);

  function chooseProduct(id: string) {
    setSelectedProductId(id);
  }

  async function saveMetadata() {
    setAttemptedSave(true);
    setNotice(null);
    setError(null);
    if (!selectedProduct || !title.trim() || !description.trim()) return;
    setBusy(true);
    try {
      const updated = await api.admin.products.update(selectedProduct.id, {
        title: title.trim(),
        description: description.trim(),
        featured,
      });
      setProducts((current) => current.map((product) => product.id === updated.id ? updated : product));
      setNotice(`${updated.title} merchandising metadata saved.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save product metadata.');
    } finally {
      setBusy(false);
    }
  }

  async function applyInventoryAdjustment() {
    setAttemptedAdjustment(true);
    setNotice(null);
    setError(null);
    if (!selectedProduct || !selectedVariant || !Number.isInteger(quantityNumber) || quantityNumber <= 0 || !reason.trim() || !confirmed) return;
    if (direction === 'remove' && quantityNumber > selectedVariant.inventoryQuantity) return;
    setBusy(true);
    try {
      const adjustment = direction === 'add' ? quantityNumber : -quantityNumber;
      const updated = await api.admin.products.adjustInventory(selectedProduct.id, {
        variantId: selectedVariant.id,
        adjustment,
        reason: reason.trim(),
      });
      setProducts((current) => current.map((product) => product.id === updated.id ? updated : product));
      const nextVariant = updated.variants.find((variant) => variant.id === selectedVariant.id);
      setConfirmed(false);
      setNotice(`${nextVariant?.sku ?? selectedVariant.sku} inventory updated to ${nextVariant?.inventoryQuantity ?? '—'} units.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to adjust inventory.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <AppHeader
        title="Catalog & inventory"
        description="Manage merchandising metadata and stock from one canonical commerce workspace."
        leading={<IconButton accessibilityLabel="Back to operations" variant="ghost" onPress={() => navigate('/')}><Text aria-hidden variant="heading">‹</Text></IconButton>}
        trailing={<Button variant="outline" disabled={loading || busy} onPress={() => void load()}>Refresh</Button>}
      />

      <Box className="mx-auto w-full max-w-6xl gap-6 p-4 md:p-8">
        <Box className="grid grid-cols-2 gap-3 md:grid-cols-4" testID="catalog-inventory-summary">
          <Card className="gap-1 p-4"><Text variant="body">Products</Text><Text variant="title">{products.length}</Text></Card>
          <Card className="gap-1 p-4"><Text variant="body">Available units</Text><Text variant="title">{totalUnits}</Text></Card>
          <Card className="gap-1 p-4"><Text variant="body">Low stock</Text><Text variant="title">{lowStock}</Text></Card>
          <Card className="gap-1 p-4"><Text variant="body">Out of stock</Text><Text variant="title">{outOfStock}</Text></Card>
        </Box>

        {notice ? <Card className="p-4" testID="catalog-inventory-notice"><Text variant="body">{notice}</Text></Card> : null}
        {error ? <Card className="gap-2 p-4" testID="catalog-inventory-error"><Text variant="heading">Catalog operation failed</Text><FormMessage>{error}</FormMessage></Card> : null}
        {loading ? <Card className="p-6"><Text variant="body">Loading catalog and inventory…</Text></Card> : null}

        {!loading ? (
          <Box className="grid grid-cols-1 gap-6 lg:grid-cols-[21rem_minmax(0,1fr)] lg:items-start">
            <Box className="gap-4">
              <Field label="Search products" description="Search by product, tag, SKU or variant.">
                <Input value={query} onChangeText={setQuery} placeholder="Cloud Tee or TRAIL-41" />
              </Field>
              <ListGroup accessibilityLabel="Catalog products" testID="catalog-product-list">
                <ListGroupHeader title="Products" description={`${filteredProducts.length} of ${products.length} shown`} />
                {filteredProducts.map((product) => (
                  <ListItem
                    key={product.id}
                    accessibilityLabel={`Edit product ${product.title}`}
                    title={product.title}
                    description={inventorySummary(product)}
                    trailing={product.featured ? 'Featured' : 'Standard'}
                    onPress={() => chooseProduct(product.id)}
                  />
                ))}
              </ListGroup>
              {filteredProducts.length === 0 ? (
                <Card className="p-5" testID="catalog-search-empty"><Text variant="body">No products match “{query.trim()}”.</Text></Card>
              ) : null}
            </Box>

            {selectedProduct ? (
              <Box className="gap-6" testID="catalog-product-editor">
                <Card className="gap-5 p-5 md:p-6">
                  <Box className="flex-row flex-wrap items-start justify-between gap-3">
                    <Box className="min-w-0 flex-1 gap-1">
                      <Text variant="title">{selectedProduct.title}</Text>
                      <Text variant="body">{selectedProduct.slug} · {selectedProduct.variants.length} variant{selectedProduct.variants.length === 1 ? '' : 's'}</Text>
                    </Box>
                    <Badge>{selectedProduct.featured ? 'Featured' : 'Standard'}</Badge>
                  </Box>

                  <Field label="Product title" required invalid={titleInvalid} error="Product title is required.">
                    <Input value={title} onChangeText={setTitle} placeholder="Product title" />
                  </Field>
                  <Field label="Product description" required invalid={descriptionInvalid} error="Product description is required.">
                    <Textarea value={description} onChangeText={setDescription} placeholder="Product description" />
                  </Field>
                  <Box className="flex-row items-center justify-between gap-4 rounded-lg border border-border p-3">
                    <Box className="min-w-0 flex-1 gap-1">
                      <Text variant="body">Featured merchandising</Text>
                      <Text variant="body">Show this product in featured storefront placements.</Text>
                    </Box>
                    <Switch accessibilityLabel="Featured product" value={featured} onValueChange={setFeatured} disabled={busy} />
                  </Box>
                  <Box className="flex-row flex-wrap justify-end gap-2">
                    <Button disabled={busy} onPress={() => void saveMetadata()}>{busy ? 'Saving…' : 'Save product'}</Button>
                  </Box>
                </Card>

                <Card className="gap-5 p-5 md:p-6" testID="inventory-editor">
                  <Box className="gap-1">
                    <Text variant="title">Inventory</Text>
                    <Text variant="body">Select a variant, then record a signed stock adjustment against D1.</Text>
                  </Box>

                  <ListGroup accessibilityLabel={`Variants for ${selectedProduct.title}`} testID="catalog-variant-list">
                    <ListGroupHeader title="Variants" description={`${selectedProduct.variants.length} SKU${selectedProduct.variants.length === 1 ? '' : 's'}`} />
                    {selectedProduct.variants.map((variant) => (
                      <ListItem
                        key={variant.id}
                        accessibilityLabel={`Select variant ${variant.sku}`}
                        title={`${variant.sku} · ${variant.title}`}
                        description={`${variant.inventoryQuantity} units · ${variantStatus(variant)}`}
                        trailing={selectedVariantId === variant.id ? 'Selected' : variantStatus(variant)}
                        onPress={() => setSelectedVariantId(variant.id)}
                      />
                    ))}
                  </ListGroup>

                  {selectedVariant ? (
                    <>
                      <Box className="flex-row flex-wrap items-center justify-between gap-3">
                        <Box className="min-w-0 flex-1 gap-1">
                          <Text variant="heading">{selectedVariant.sku}</Text>
                          <Text testID="selected-variant-stock" variant="body">Current stock: {selectedVariant.inventoryQuantity} · {variantStatus(selectedVariant)}</Text>
                        </Box>
                        <Badge>{variantStatus(selectedVariant)}</Badge>
                      </Box>

                      <FormGroup legend="Adjustment direction" required>
                        <RadioGroup value={direction} onValueChange={(value) => setDirection(value as Direction)} accessibilityLabel="Adjustment direction">
                          <Radio label="Add stock" value="add" />
                          <Radio label="Remove stock" value="remove" />
                        </RadioGroup>
                      </FormGroup>
                      <Field label="Quantity" required invalid={quantityInvalid || negativeInvalid} error={negativeInvalid ? 'Removal cannot exceed current stock.' : 'Quantity must be a positive whole number.'}>
                        <Input inputMode="numeric" value={quantity} onChangeText={setQuantity} placeholder="Quantity" />
                      </Field>
                      <Field label="Adjustment reason" required invalid={reasonInvalid} error="Adjustment reason is required.">
                        <Input value={reason} onChangeText={setReason} placeholder="Cycle count" />
                      </Field>
                      <Checkbox checked={confirmed} onCheckedChange={setConfirmed} label="I reviewed the resulting stock level" disabled={busy} />
                      {confirmationInvalid ? <FormMessage>Confirm the stock-level review before applying the adjustment.</FormMessage> : null}
                      <Box className="flex-row flex-wrap justify-end gap-2">
                        <Button disabled={busy} onPress={() => void applyInventoryAdjustment()}>{busy ? 'Updating…' : 'Apply inventory adjustment'}</Button>
                      </Box>
                    </>
                  ) : <Text variant="body">This product has no selectable variant.</Text>}
                </Card>
              </Box>
            ) : (
              <Card className="p-6"><Text variant="body">Select a product to manage merchandising and inventory.</Text></Card>
            )}
          </Box>
        ) : null}
      </Box>
    </Screen>
  );
}
