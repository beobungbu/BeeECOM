import { expect, request as playwrightRequest, test, type Page, type TestInfo } from '@playwright/test';

const API = 'http://127.0.0.1:8787';
const STOREFRONT = 'http://127.0.0.1:5173';
const ADMIN = 'http://127.0.0.1:5174';
const RESET_TOKEN = 'qa-reset-token';

async function resetScenario(scenario: string) {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.post('/api/v1/demo/reset', {
    headers: { 'x-demo-reset-token': RESET_TOKEN },
    data: { scenario },
  });
  expect(response.ok(), `reset ${scenario}`).toBeTruthy();
  await api.dispose();
}

async function waitForStorefrontMedia(page: Page) {
  await expect(page.getByText('Catalog')).toBeVisible();
  const image = page.locator('img').first();
  await expect(image).toBeVisible({ timeout: 15_000 });
  await expect.poll(
    () => image.evaluate((element) => {
      const media = element as HTMLImageElement;
      return media.complete && media.naturalWidth > 0 && media.naturalHeight > 0;
    }),
    { timeout: 15_000, message: 'real storefront product media should load successfully' },
  ).toBe(true);
  await expect(page.getByText('Image unavailable')).toHaveCount(0);
}

async function attachFullPage(page: Page, testInfo: TestInfo, name: string) {
  const body = await page.screenshot({
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
  });
  await testInfo.attach(name, { body, contentType: 'image/png' });
}

test.describe('Release visual evidence matrix', () => {
  test('captures healthy Storefront desktop with real editorial media', async ({ page }, testInfo) => {
    await resetScenario('healthy');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(STOREFRONT);
    await waitForStorefrontMedia(page);
    await expect(page.getByRole('button', { name: 'Shop featured Cloud Tee' })).toBeVisible();
    await attachFullPage(page, testInfo, 'storefront-desktop-healthy');
  });

  test('captures healthy Storefront phone with real product media', async ({ page }, testInfo) => {
    await resetScenario('healthy');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(STOREFRONT);
    await waitForStorefrontMedia(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await attachFullPage(page, testInfo, 'storefront-phone-healthy');
  });

  test('captures Admin desktop operations console', async ({ page }, testInfo) => {
    await resetScenario('healthy');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(ADMIN);
    await expect(page.getByText('BeeECOM Admin')).toBeVisible();
    await expect(page.getByText('Order lifecycle')).toBeVisible();
    await attachFullPage(page, testInfo, 'admin-desktop-healthy');
  });

  test('captures Admin tablet operations console', async ({ page }, testInfo) => {
    await resetScenario('healthy');
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(ADMIN);
    await expect(page.getByText('BeeECOM Admin')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await attachFullPage(page, testInfo, 'admin-tablet-healthy');
  });

  test('captures empty-catalog customer state on phone', async ({ page }, testInfo) => {
    await resetScenario('empty-catalog');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(STOREFRONT);
    await expect(page.getByText('No products', { exact: true })).toBeVisible();
    await attachFullPage(page, testInfo, 'storefront-phone-empty-catalog');
  });

  test('captures sale campaign storefront with real media', async ({ page }, testInfo) => {
    await resetScenario('sale-campaign');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(STOREFRONT);
    await waitForStorefrontMedia(page);
    await expect(page.getByText('sale', { exact: true }).first()).toBeVisible();
    await attachFullPage(page, testInfo, 'storefront-desktop-sale-campaign');
  });

  test('captures large-catalog storefront stress composition', async ({ page }, testInfo) => {
    await resetScenario('large-catalog');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(STOREFRONT);
    await waitForStorefrontMedia(page);
    await expect(page.getByText('Stress Product 1', { exact: true }).first()).toBeVisible();
    await attachFullPage(page, testInfo, 'storefront-desktop-large-catalog');
  });
});
