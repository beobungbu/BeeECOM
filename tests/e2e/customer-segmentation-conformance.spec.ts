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

test.describe('BeeUI customer segmentation controls against canonical D1 customers', () => {
  test.beforeEach(async () => {
    await resetHealthy();
  });

  test('RadioGroup exposes canonical customer selection state', async ({ page }) => {
    await page.goto(`${ADMIN}/conformance/customer-segmentation`);
    await expect(page.getByText('Customer segmentation acceptance')).toBeVisible();

    const group = page.getByRole('radiogroup', { name: 'Customer selection' });
    await expect(group).toBeVisible();

    const ava = page.getByRole('radio', { name: 'Ava Nguyen — standard' });
    const minh = page.getByRole('radio', { name: 'Minh Tran — vip' });
    await expect(ava).toBeChecked();
    await expect(minh).not.toBeChecked();
    await expect(page.getByTestId('selected-customer-summary')).toContainText('Ava Nguyen');
    await expect(page.getByTestId('selected-customer-summary')).toContainText('$284.00');

    await minh.click();
    await expect(minh).toBeChecked();
    await expect(ava).not.toBeChecked();
    await expect(page.getByTestId('selected-customer-summary')).toContainText('Minh Tran');
    await expect(page.getByTestId('selected-customer-summary')).toContainText('$1,489.00');
  });

  test('Switch exposes state and filters to the persisted VIP segment', async ({ page }) => {
    await page.goto(`${ADMIN}/conformance/customer-segmentation`);
    await expect(page.getByTestId('customer-visible-count')).toHaveText('2 visible customers');

    const vipOnly = page.getByRole('switch', { name: 'VIP customers only' });
    await expect(vipOnly).not.toBeChecked();
    await vipOnly.click();
    await expect(vipOnly).toBeChecked();

    await expect(page.getByTestId('customer-visible-count')).toHaveText('1 visible customer');
    await expect(page.getByRole('radio', { name: 'Ava Nguyen — standard' })).toHaveCount(0);
    await expect(page.getByRole('radio', { name: 'Minh Tran — vip' })).toBeChecked();
    await expect(page.getByTestId('selected-customer-summary')).toContainText('Minh Tran');
  });

  test('Tooltip opens on focus, describes its trigger and dismisses with Escape', async ({ page }) => {
    await page.goto(`${ADMIN}/conformance/customer-segmentation`);

    const trigger = page.getByRole('button', { name: 'Explain lifetime value' });
    await trigger.focus();

    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveText('Lifetime value for Ava Nguyen is $284.00.');

    const describedBy = await trigger.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    await expect(tooltip).toHaveAttribute('id', describedBy!);

    await page.keyboard.press('Escape');
    await expect(tooltip).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(page.getByTestId('customer-segmentation-notice')).toHaveText('Reviewed lifetime value for Ava Nguyen.');
  });

  test('customer controls reflow at 360px without serious or critical axe findings', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(`${ADMIN}/conformance/customer-segmentation`);
    await expect(page.getByTestId('customer-visible-count')).toHaveText('2 visible customers');

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    const violations = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
  });
});
