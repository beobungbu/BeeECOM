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

test.describe('BeeUI modal overlay contracts from a real Admin flow', () => {
  test.beforeEach(async () => {
    await resetHealthy();
  });

  test('Dialog traps focus, dismisses on Escape/backdrop and restores trigger focus', async ({ page }) => {
    await page.goto(ADMIN);
    await expect(page.getByText('Order lifecycle')).toBeVisible();

    const trigger = page.getByRole('button', { name: 'View order details' });
    await trigger.click();

    const dialog = page.getByRole('dialog').filter({ hasText: 'Order #1001 details' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Order #1001 details', { exact: true })).toBeVisible();

    const close = dialog.getByRole('button', { name: 'Close details' });
    await expect(close).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(dialog).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('AlertDialog ignores Escape/backdrop and only explicit Cancel or Action dismisses it', async ({ page }) => {
    await page.goto(ADMIN);
    await expect(page.getByLabel('Active order #1001')).toBeVisible();

    const refundTrigger = page.getByRole('button', { name: 'Refund', exact: true });
    await refundTrigger.click();

    const alert = page.getByRole('dialog').filter({ hasText: 'Refund order #1001?' });
    await expect(alert).toBeVisible();
    const cancel = alert.getByRole('button', { name: 'Keep payment' });
    await expect(cancel).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(alert).toBeVisible();

    await page.mouse.click(5, 5);
    await expect(alert).toBeVisible();

    await cancel.click();
    await expect(alert).toBeHidden();
    await expect(refundTrigger).toBeFocused();

    await refundTrigger.click();
    await expect(alert).toBeVisible();
    await alert.getByRole('button', { name: 'Refund order' }).click();
    await expect(alert).toBeHidden();

    const liveRegion = page.locator('[aria-live]').filter({ hasText: 'Admin operation complete' });
    await expect(liveRegion).toContainText('Order payment refunded.');
    await expect(page.getByText('refunded', { exact: true }).first()).toBeVisible();
  });
});
