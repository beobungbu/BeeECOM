import { expect, request as playwrightRequest, test } from '@playwright/test';

const API = 'http://127.0.0.1:8787';
const STOREFRONT = 'http://127.0.0.1:5173';
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

const internalMarkers = [
  'BeeUI 0.86.2-rc.1',
  'Golden commerce slice',
  'D1',
  'Durable Objects',
  'deterministic fixtures',
  'canonical state',
  'Simulate checkout',
  'Theme preference:',
] as const;

test.describe('Product-facing root shells', () => {
  test.beforeEach(async () => {
    await resetHealthy();
  });

  test('Storefront root reads as a customer product, not a conformance harness', async ({ page }) => {
    await page.goto(STOREFRONT);
    await expect(page.getByText('Catalog', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Shop collections' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'My account' })).toBeVisible();

    const visibleText = await page.locator('body').innerText();
    for (const marker of internalMarkers) expect(visibleText).not.toContain(marker);
  });

  test('Admin root reads as an operations product, not an implementation console', async ({ page }) => {
    await page.goto(ADMIN);
    await expect(page.getByText('BeeECOM Admin', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Refresh dashboard' })).toBeVisible();
    await expect(page.getByText('Operations workspace', { exact: true })).toBeVisible();

    const visibleText = await page.locator('body').innerText();
    for (const marker of internalMarkers) expect(visibleText).not.toContain(marker);
  });
});
