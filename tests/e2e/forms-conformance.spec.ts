import AxeBuilder from '@axe-core/playwright';
import { expect, request as playwrightRequest, test } from '@playwright/test';

const API = 'http://127.0.0.1:8787';
const ADMIN = 'http://127.0.0.1:5174';
const RESET_TOKEN = 'qa-reset-token';

type CatalogProductSnapshot = {
  id: string;
  title: string;
  description: string;
  featured: boolean;
  variants: Array<{ id: string; inventoryQuantity: number }>;
};

async function resetHealthy() {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.post('/api/v1/demo/reset', {
    headers: { 'x-demo-reset-token': RESET_TOKEN },
    data: { scenario: 'healthy' },
  });
  expect(response.ok()).toBeTruthy();
  await api.dispose();
}

async function catalogProducts(): Promise<CatalogProductSnapshot[]> {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.get('/api/v1/catalog/products?pageSize=24&sort=featured');
  expect(response.ok()).toBeTruthy();
  const body = await response.json() as {
    ok: true;
    data: { items: CatalogProductSnapshot[] };
  };
  await api.dispose();
  return body.data.items;
}

async function firstCatalogProduct(): Promise<CatalogProductSnapshot> {
  const product = (await catalogProducts())[0];
  if (!product?.variants[0]) throw new Error('Healthy scenario must expose a product with a variant.');
  return product;
}

async function catalogProductById(productId: string): Promise<CatalogProductSnapshot> {
  const product = (await catalogProducts()).find((item) => item.id === productId);
  if (!product?.variants[0]) throw new Error(`Catalog product ${productId} must remain queryable after mutation.`);
  return product;
}

test.describe('BeeUI form composition in real Admin operations', () => {
  test.beforeEach(async () => {
    await resetHealthy();
  });

  test('Field wires required text-entry naming/error feedback and persists metadata controls', async ({ page }) => {
    const before = await firstCatalogProduct();
    await page.goto(`${ADMIN}/conformance/forms`);
    await expect(page.getByText('Catalog form acceptance')).toBeVisible();

    const title = page.getByRole('textbox', { name: 'Product title, required' });
    const description = page.getByRole('textbox', { name: 'Product description' });
    const featured = page.getByRole('switch', { name: 'Featured product' });

    await expect(title).toHaveValue(before.title);
    await expect(description).toHaveValue(before.description);

    await title.fill('');
    await page.getByRole('button', { name: 'Save merchandising metadata' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Product title is required.' })).toBeVisible();

    const nextTitle = `${before.title} QA`;
    const nextDescription = `${before.description} Consumer form acceptance.`;
    await title.fill(nextTitle);
    await description.fill(nextDescription);
    await featured.click();
    await page.getByRole('button', { name: 'Save merchandising metadata' }).click();
    await expect(page.getByText('Catalog metadata persisted.')).toBeVisible();

    // Toggling `featured` is allowed to reorder `sort=featured`; persistence is
    // therefore verified by stable product identity, never by list position.
    const after = await catalogProductById(before.id);
    expect(after.title).toBe(nextTitle);
    expect(after.description).toBe(nextDescription);
    expect(after.featured).toBe(!before.featured);

    const violations = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
  });

  test('FormGroup/RadioGroup, Field, Checkbox and FormMessage drive a persisted inventory adjustment', async ({ page }) => {
    const before = await firstCatalogProduct();
    const beforeStock = before.variants[0].inventoryQuantity;

    await page.goto(`${ADMIN}/conformance/forms`);
    await expect(page.getByText('Catalog form acceptance')).toBeVisible();

    const group = page.getByRole('radiogroup');
    await expect(group).toBeVisible();
    const remove = page.getByRole('radio', { name: 'Remove stock' });
    await remove.click();
    await expect(remove).toBeChecked();

    const quantity = page.getByRole('textbox', { name: 'Quantity, required' });
    const reason = page.getByRole('textbox', { name: 'Adjustment reason, required' });
    const confirmation = page.getByRole('checkbox', { name: 'I reviewed the resulting stock level' });

    await quantity.fill('1');
    await reason.fill('');
    await page.getByRole('button', { name: 'Apply inventory adjustment' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Adjustment reason is required.' })).toBeVisible();

    // Standalone FormMessage deliberately uses a polite live region and does
    // not claim role="alert". Field-generated invalid feedback has its own alert semantics.
    const confirmationMessage = page.getByText('Confirm the stock-level review before applying the adjustment.');
    await expect(confirmationMessage).toBeVisible();
    await expect(confirmationMessage).toHaveAttribute('aria-live', 'polite');

    await reason.fill('BeeUI forms acceptance');
    await confirmation.click();
    await expect(confirmation).toBeChecked();
    await page.getByRole('button', { name: 'Apply inventory adjustment' }).click();
    await expect(page.getByText('Inventory adjustment persisted.')).toBeVisible();
    await expect(page.getByTestId('forms-current-stock')).toContainText(`Current stock: ${beforeStock - 1}`);

    const after = await catalogProductById(before.id);
    expect(after.variants[0].inventoryQuantity).toBe(beforeStock - 1);
  });
});
