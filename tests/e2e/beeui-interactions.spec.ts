import { expect, request as playwrightRequest, test } from '@playwright/test';

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

test.describe('BeeUI external-consumer interaction contracts', () => {
  test.beforeEach(async () => {
    await resetHealthy();
  });

  test('Select supports keyboard open, typeahead selection and Escape dismissal', async ({ page }) => {
    await page.goto(ADMIN);
    await expect(page.getByText('BeeECOM Admin')).toBeVisible();

    const trigger = page.getByLabel('Admin product');
    await trigger.focus();
    await page.keyboard.press('ArrowDown');

    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible();

    await page.keyboard.press('t');
    await page.keyboard.press('Enter');
    await expect(listbox).toBeHidden();
    await expect(trigger).toContainText('Trail Runner');

    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await expect(listbox).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(listbox).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('Select collision handling keeps the listbox inside a constrained viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 300 });
    await page.goto(ADMIN);

    const trigger = page.getByLabel('Admin product');
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();

    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible();
    const box = await listbox.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    expect(box!.y + box!.height).toBeLessThanOrEqual(300);
  });

  test('Table renders real HTML table/header/body semantics for dense Admin data', async ({ page }) => {
    await page.goto(ADMIN);
    await expect(page.getByText('Dense inventory view')).toBeVisible();

    const tables = page.locator('table');
    expect(await tables.count()).toBeGreaterThanOrEqual(2);

    const inventory = tables.filter({ hasText: 'Cloud Tee' }).first();
    await expect(inventory).toBeVisible();
    await expect(inventory.locator('thead')).toHaveCount(1);
    await expect(inventory.locator('tbody')).toHaveCount(1);
    await expect(inventory.locator('th[scope="col"]')).toHaveCount(5);
    expect(await inventory.locator('tbody tr').count()).toBeGreaterThan(0);
    expect(await inventory.locator('tbody td').count()).toBeGreaterThan(0);
  });

  test('Toast announces a real successful Admin mutation through the provider runtime', async ({ page }) => {
    await page.goto(ADMIN);
    await expect(page.getByText('Catalog operations')).toBeVisible();

    const featureAction = page.getByRole('button', { name: /^(Feature|Unfeature)$/ }).first();
    await featureAction.click();

    await expect(page.getByText('Admin operation complete', { exact: true })).toBeVisible();
    await expect(page.getByText(/featured merchandising/i)).toBeVisible();

    const liveRegion = page.locator('[aria-live]').filter({ hasText: 'Admin operation complete' });
    await expect(liveRegion).toBeVisible();
  });
});
