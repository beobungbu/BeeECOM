import { createBeeEcomClient } from '@beeecom/api-client';
import type { Product } from '@beeecom/domain';
import {
  Box,
  Button,
  Card,
  Checkbox,
  Field,
  FormGroup,
  FormMessage,
  HelperText,
  Input,
  Radio,
  RadioGroup,
  Screen,
  Switch,
  Text,
  Textarea,
} from '@beemvp/beeui-ui';
import * as React from 'react';

const api = createBeeEcomClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8787',
});

type Direction = 'add' | 'remove';

export function CatalogFormConformance() {
  const [product, setProduct] = React.useState<Product | null>(null);
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [featured, setFeatured] = React.useState(false);
  const [direction, setDirection] = React.useState<Direction>('add');
  const [quantity, setQuantity] = React.useState('1');
  const [reason, setReason] = React.useState('Cycle count');
  const [confirmed, setConfirmed] = React.useState(false);
  const [attemptedSave, setAttemptedSave] = React.useState(false);
  const [attemptedAdjustment, setAttemptedAdjustment] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const loadProduct = React.useCallback(async () => {
    setError(null);
    try {
      const page = await api.catalog.listProducts({ pageSize: 24, sort: 'featured' });
      const first = page.items[0] ?? null;
      setProduct(first);
      setTitle(first?.title ?? '');
      setDescription(first?.description ?? '');
      setFeatured(first?.featured ?? false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load catalog form data.');
    }
  }, []);

  React.useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  const titleInvalid = attemptedSave && !title.trim();
  const quantityNumber = Number(quantity);
  const quantityInvalid =
    attemptedAdjustment && (!Number.isInteger(quantityNumber) || quantityNumber <= 0);
  const reasonInvalid = attemptedAdjustment && !reason.trim();
  const confirmationInvalid = attemptedAdjustment && !confirmed;

  async function saveMetadata() {
    setAttemptedSave(true);
    setMessage(null);
    setError(null);
    if (!product || !title.trim()) return;

    setBusy(true);
    try {
      const updated = await api.admin.products.update(product.id, {
        title: title.trim(),
        description: description.trim(),
        featured,
      });
      setProduct(updated);
      setTitle(updated.title);
      setDescription(updated.description);
      setFeatured(updated.featured);
      setMessage('Catalog metadata persisted.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to persist catalog metadata.');
    } finally {
      setBusy(false);
    }
  }

  async function applyInventoryAdjustment() {
    setAttemptedAdjustment(true);
    setMessage(null);
    setError(null);
    if (
      !product ||
      !product.variants[0] ||
      !Number.isInteger(quantityNumber) ||
      quantityNumber <= 0 ||
      !reason.trim() ||
      !confirmed
    ) {
      return;
    }

    setBusy(true);
    try {
      const adjustment = direction === 'add' ? quantityNumber : -quantityNumber;
      const updated = await api.admin.products.adjustInventory(product.id, {
        variantId: product.variants[0].id,
        adjustment,
        reason: reason.trim(),
      });
      setProduct(updated);
      setConfirmed(false);
      setMessage('Inventory adjustment persisted.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to persist inventory adjustment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Box className="mx-auto w-full max-w-4xl gap-5 p-4 md:p-8">
        <Card className="gap-2 p-5 md:p-6">
          <Text variant="title">Catalog form acceptance</Text>
          <Text variant="body">
            Real D1-backed Admin editing used to validate BeeUI form composition from the public package contract.
          </Text>
          {product ? (
            <HelperText>Editing {product.id} · first variant {product.variants[0]?.sku ?? 'none'}</HelperText>
          ) : (
            <HelperText>Loading catalog product…</HelperText>
          )}
          {error ? <FormMessage>{error}</FormMessage> : null}
          {message ? <Text variant="body">{message}</Text> : null}
        </Card>

        <Card className="gap-5 p-5 md:p-6">
          <Text variant="title">Merchandising metadata</Text>

          <Field
            label="Product title"
            description="Required storefront merchandising title."
            required
            invalid={titleInvalid}
            error="Product title is required."
          >
            <Input value={title} onChangeText={setTitle} placeholder="Product title" />
          </Field>

          <Field label="Product description" description="Long-form PDP merchandising copy.">
            <Textarea value={description} onChangeText={setDescription} placeholder="Product description" />
          </Field>

          <Box className="flex-row items-center justify-between gap-4 rounded-lg border border-border p-3">
            <Box className="flex-1 gap-1">
              <Text variant="body">Featured merchandising</Text>
              <HelperText>Controls whether this product participates in featured storefront placements.</HelperText>
            </Box>
            <Switch
              accessibilityLabel="Featured product"
              value={featured}
              onValueChange={setFeatured}
              disabled={!product || busy}
            />
          </Box>

          <Button disabled={!product || busy} onPress={() => void saveMetadata()}>
            Save merchandising metadata
          </Button>
        </Card>

        <Card className="gap-5 p-5 md:p-6">
          <Text variant="title">Inventory adjustment</Text>

          <FormGroup
            legend="Adjustment direction"
            description="Choose whether the signed D1 inventory mutation adds or removes stock."
            required
          >
            <RadioGroup value={direction} onValueChange={(value) => setDirection(value as Direction)}>
              <Radio label="Add stock" value="add" />
              <Radio label="Remove stock" value="remove" />
            </RadioGroup>
          </FormGroup>

          <Field
            label="Quantity"
            required
            invalid={quantityInvalid}
            error="Quantity must be a positive whole number."
          >
            <Input
              inputMode="numeric"
              value={quantity}
              onChangeText={setQuantity}
              placeholder="Quantity"
            />
          </Field>

          <Field
            label="Adjustment reason"
            required
            invalid={reasonInvalid}
            error="Adjustment reason is required."
          >
            <Input value={reason} onChangeText={setReason} placeholder="Adjustment reason" />
          </Field>

          <Checkbox
            checked={confirmed}
            onCheckedChange={setConfirmed}
            label="I reviewed the resulting stock level"
            disabled={!product || busy}
          />
          {confirmationInvalid ? (
            <FormMessage>Confirm the stock-level review before applying the adjustment.</FormMessage>
          ) : null}

          <Button disabled={!product || busy} onPress={() => void applyInventoryAdjustment()}>
            Apply inventory adjustment
          </Button>

          {product?.variants[0] ? (
            <Text testID="forms-current-stock" variant="body">
              Current stock: {product.variants[0].inventoryQuantity} · {product.variants[0].inventoryState}
            </Text>
          ) : null}
        </Card>
      </Box>
    </Screen>
  );
}
