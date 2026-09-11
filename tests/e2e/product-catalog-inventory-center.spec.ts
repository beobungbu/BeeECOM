import AxeBuilder from '@axe-core/playwright';
import { expect, request as playwrightRequest, test, type Page, type TestInfo } from '@playwright/test';

const API = 'http://127.0.0.1:8787';
const ADMIN = 'http://127.0.0.1:5174';
const RESET_TOKEN = 'qa-reset-token';

async function resetHealthy() {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.post('/api/v1/demo/reset', {
    headers: { 'x-demo-reset-token': RESET_TOKEN },
    data: { scenario: 'healthy' },
  });
  expect(response.ok()).toBeTruthy();
  await api.dispose();
}

async function product(id: string) {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.get(`/api/v1/catalog/products/${id}`);
  expect(response.ok()).toBeTruthy();
  const payload = await response.json() as {
    ok: true;
    data: {
      id: string;
      title: string;
      description: string;
      featured: boolean;
      variants: Array<{ id: string; sku: string; inventoryQuantity: number; inventoryState: string }>;
    };
  };
  await api.dispose();
  return payload.data;
}

async function attachFullPage(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' }),
    contentType: 'image/png',
  });
}

test.describe('Catalog & Inventory Center product flow', () => {
  test.beforeEach(async () => {
    await resetHealthy();
  });

  test('edits a non-first product, persists it and refreshes external canonical changes', async ({ page }) => {
    await page.goto(`${ADMIN}/conformance/catalog-inventory`);
    await expect(page.getByText('Catalog & inventory', { exact: true }).first()).toBeVisible();

    await page.getByLabel('Edit product Trail Runner').click();
    const title = page.getByRole('textbox', { name: 'Product title, required' });
    await expect(title).toHaveValue('Trail Runner');
    await title.fill('Trail Runner Pro');
    await page.getByRole('button', { name: 'Save product' }).click();

    await expect(page.getByTestId('catalog-inventory-notice')).toContainText('Trail Runner Pro merchandising metadata saved.');
    expect(await product('prod-trail-runner')).toMatchObject({ title: 'Trail Runner Pro', featured: true });

    await page.reload();
    await page.getByLabel('Edit product Trail Runner Pro').click();
    await expect(title).toHaveValue('Trail Runner Pro');

    const api = await playwrightRequest.newContext({ baseURL: API });
    const external = await api.patch('/api/v1/admin/products/prod-trail-runner', { data: { title: 'Trail Runner External' } });
    expect(external.ok()).toBeTruthy();
    await api.dispose();

    await page.getByRole('button', { name: 'Refresh' }).click();
    await expect(title).toHaveValue('Trail Runner External');
  });

  test('selects a non-first variant, adjusts its stock and survives reload', async ({ page }) => {
    await page.goto(`${ADMIN}/conformance/catalog-inventory`);
    await page.getByLabel('Edit product Trail Runner').click();
    await page.getByLabel('Select variant TRAIL-41').click();
    await expect(page.getByTestId('selected-variant-stock')).toContainText('Current stock: 7');

    await page.getByRole('textbox', { name: 'Quantity, required' }).fill('3');
    await page.getByRole('textbox', { name: 'Adjustment reason, required' }).fill('Warehouse receipt');
    const confirmation = page.getByRole('checkbox', { name: 'I reviewed the resulting stock level' });
    await confirmation.click();
    await expect(confirmation).toBeChecked();
    await page.getByRole('button', { name: 'Apply inventory adjustment' }).click();

    await expect(page.getByTestId('catalog-inventory-notice')).toContainText('TRAIL-41 inventory updated to 10 units.');
    const updated = await product('prod-trail-runner');
    expect(updated.variants.find((variant) => variant.sku === 'TRAIL-41')).toMatchObject({
      inventoryQuantity: 10,
      inventoryState: 'in-stock',
    });

    await page.reload();
    await page.getByLabel('Edit product Trail Runner').click();
    await page.getByLabel('Select variant TRAIL-41').click();
    await expect(page.getByTestId('selected-variant-stock')).toContainText('Current stock: 10');
  });

  test('searches by SKU and keeps the editor aligned with the filtered canonical list', async ({ page }) => {
    await page.goto(`${ADMIN}/conformance/catalog-inventory`);
    await page.getByRole('textbox', { name: 'Search products' }).fill('CAP-001');
    await expect(page.getByLabel('Edit product Studio Cap')).toBeVisible();
    await expect(page.getByLabel('Edit product Cloud Tee')).toHaveCount(0);
    await expect(page.getByText('1 of 4 shown')).toBeVisible();
    await expect(page.getByTestId('catalog-product-editor').getByText('Studio Cap', { exact: true }).first()).toBeVisible();

    await page.getByRole('textbox', { name: 'Search products' }).fill('NO-SUCH-SKU');
    await expect(page.getByTestId('catalog-search-empty')).toBeVisible();
    await expect(page.getByTestId('catalog-product-editor')).toHaveCount(0);
  });

  test('server rejects malformed product payloads and negative inventory without corrupting state', async () => {
    const api = await playwrightRequest.newContext({ baseURL: API });
    const original = await product('prod-cloud-tee');
    const originalVariant = original.variants.find((variant) => variant.id === 'var-cloud-black-s')!;

    const malformedTitle = await api.patch('/api/v1/admin/products/prod-cloud-tee', { data: { title: 123 } });
    expect(malformedTitle.status()).toBe(400);
    expect((await malformedTitle.json() as { ok: false; error: { code: string } }).error.code).toBe('INVALID_PRODUCT_TITLE');

    const malformedReason = await api.post('/api/v1/admin/products/prod-cloud-tee/inventory-adjustments', {
      data: { variantId: 'var-cloud-black-s', adjustment: 1, reason: 123 },
    });
    expect(malformedReason.status()).toBe(400);
    expect((await malformedReason.json() as { ok: false; error: { code: string } }).error.code).toBe('INVALID_INVENTORY_ADJUSTMENT');

    const negative = await api.post('/api/v1/admin/products/prod-cloud-tee/inventory-adjustments', {
      data: { variantId: 'var-cloud-black-s', adjustment: -(originalVariant.inventoryQuantity + 1), reason: 'Invalid shrinkage' },
    });
    expect(negative.status()).toBe(409);
    expect((await negative.json() as { ok: false; error: { code: string } }).error.code).toBe('NEGATIVE_INVENTORY');
    await api.dispose();

    const unchanged = await product('prod-cloud-tee');
    expect(unchanged.title).toBe(original.title);
    expect(unchanged.variants.find((variant) => variant.id === 'var-cloud-black-s')?.inventoryQuantity).toBe(originalVariant.inventoryQuantity);
  });

  test('remains accessible at 390px with intentional reflow and visual evidence', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${ADMIN}/conformance/catalog-inventory`);
    await expect(page.getByTestId('catalog-product-list')).toBeVisible();
    await expect(page.getByTestId('catalog-product-editor')).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
    await attachFullPage(page, testInfo, 'catalog-inventory-center-mobile');
  });

  test('produces desktop product-quality evidence', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${ADMIN}/conformance/catalog-inventory`);
    await expect(page.getByTestId('inventory-editor')).toBeVisible();
    await attachFullPage(page, testInfo, 'catalog-inventory-center-desktop');
  });
});
