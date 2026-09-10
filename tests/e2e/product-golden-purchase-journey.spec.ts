import AxeBuilder from '@axe-core/playwright';
import { expect, request as playwrightRequest, test, type Page, type TestInfo } from '@playwright/test';

const API = 'http://127.0.0.1:8787';
const STOREFRONT = 'http://127.0.0.1:5173';
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

async function latestCustomerOrder() {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.get('/api/v1/orders?customerId=cust-ava&pageSize=1');
  expect(response.ok()).toBeTruthy();
  const payload = await response.json() as {
    ok: true;
    data: { items: Array<{ id: string; number: string; paymentState: string; fulfillmentState: string }> };
  };
  await api.dispose();
  return payload.data.items[0] ?? null;
}

async function attachFullPage(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' }),
    contentType: 'image/png',
  });
}

test.describe('Unified storefront purchase journey', () => {
  test.beforeEach(async () => {
    await resetHealthy();
  });

  test('storefront cart has one checkout entry and never submits an order directly', async ({ page }) => {
    await page.goto(STOREFRONT);

    const checkout = page.getByTestId('storefront-checkout');
    await expect(checkout).toBeVisible();
    await expect(page.getByRole('button', { name: 'Place order' })).toHaveCount(0);

    await checkout.click();
    await expect(page).toHaveURL(`${STOREFRONT}/conformance/checkout`);
    await expect(page.getByTestId('checkout-order-review')).toBeVisible();
  });

  test('completed checkout becomes the persisted latest order and reopens from the storefront', async ({ page }) => {
    await page.goto(STOREFRONT);
    await page.getByTestId('storefront-checkout').click();
    await page.getByRole('radio', { name: 'Wallet' }).click();
    await page.getByRole('checkbox', { name: 'I confirm my delivery, payment and order details' }).click();
    await page.getByRole('button', { name: 'Place order' }).click();
    await expect(page.getByTestId('checkout-success')).toBeVisible();

    const created = await latestCustomerOrder();
    expect(created).toMatchObject({ paymentState: 'paid', fulfillmentState: 'unfulfilled' });
    expect(created?.id).toMatch(/^order-/);

    await page.goto(STOREFRONT);
    const latest = page.getByTestId('storefront-latest-order');
    await expect(latest).toContainText(created!.number);
    await expect(latest).toContainText('Payment: paid');
    await expect(latest).toContainText('Fulfillment: unfulfilled');

    await latest.getByRole('button', { name: 'View order' }).click();
    await expect(page).toHaveURL(`${STOREFRONT}/conformance/orders/${created!.id}`);
    await expect(page.getByText(created!.number, { exact: true }).first()).toBeVisible();
  });

  test('storefront journey stays readable at 390px with no serious or critical axe findings', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(STOREFRONT);
    await expect(page.getByTestId('storefront-checkout')).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    const violations = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
    await attachFullPage(page, testInfo, 'storefront-golden-journey-mobile');
  });

  test('desktop storefront exposes the coherent cart and latest-order surfaces', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(STOREFRONT);
    await expect(page.getByTestId('storefront-checkout')).toBeVisible();
    await expect(page.getByTestId('storefront-latest-order')).toBeVisible();
    await attachFullPage(page, testInfo, 'storefront-golden-journey-desktop');
  });
});
