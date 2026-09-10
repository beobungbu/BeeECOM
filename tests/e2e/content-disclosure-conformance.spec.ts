import AxeBuilder from '@axe-core/playwright';
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

test.describe('BeeUI content and disclosure contracts in a persisted Admin order', () => {
  test.beforeEach(async () => {
    await resetHealthy();
  });

  test('Accordion exposes expanded state while BeeECOM owns the selected order section', async ({ page }) => {
    await page.goto(`${ADMIN}/conformance/content-disclosure`);
    await expect(page.getByText('Order content & disclosure acceptance')).toBeVisible();
    await expect(page.getByText('Order #1001')).toBeVisible();

    const summary = page.getByRole('button', { name: 'Order summary' });
    const shipping = page.getByRole('button', { name: 'Shipping address' });

    await expect(summary).toHaveAttribute('aria-expanded', 'true');
    await expect(shipping).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('order-summary-region')).toBeVisible();
    await expect(page.getByTestId('shipping-region')).toHaveCount(0);

    await shipping.click();
    await expect(summary).toHaveAttribute('aria-expanded', 'false');
    await expect(shipping).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('order-summary-region')).toHaveCount(0);
    await expect(page.getByTestId('shipping-region')).toBeVisible();

    await shipping.click();
    await expect(shipping).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('shipping-region')).toHaveCount(0);
  });

  test('Collapsible and ListGroup expose disclosure/list semantics without owning order-line state', async ({ page }) => {
    await page.goto(`${ADMIN}/conformance/content-disclosure`);
    await expect(page.getByText('Order #1001')).toBeVisible();

    const trigger = page.getByRole('button', { name: 'Order lines' });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('order-lines-region')).toHaveCount(0);

    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('order-lines-region')).toBeVisible();

    const list = page.getByRole('list');
    await expect(list).toBeVisible();
    await expect(list.getByRole('listitem')).toHaveCount(1);

    const fieldPack = page.getByRole('button', { name: /Field Pack/ });
    await fieldPack.click();
    await expect(page.getByTestId('active-line-details')).toContainText('Field Pack');
    await expect(page.getByTestId('active-line-details')).toContainText('Default');
    await expect(page.getByTestId('active-line-details')).toContainText('$64.00');
  });

  test('Description/metadata/timeline content survives narrow layout and has no serious or critical axe violations', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(`${ADMIN}/conformance/content-disclosure`);
    await expect(page.getByText('Order #1001')).toBeVisible();

    await expect(page.getByTestId('order-description-list')).toContainText('Ava Nguyen');
    await expect(page.getByTestId('order-description-list')).toContainText('shipped');
    await expect(page.getByTestId('order-timeline')).toContainText('Order placed');
    await expect(page.getByTestId('order-timeline')).toContainText('Payment');
    await expect(page.getByTestId('order-timeline')).toContainText('Fulfillment');

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    const violations = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
  });
});
