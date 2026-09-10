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

async function welcomePromotion(): Promise<{ startsAt: string; endsAt: string }> {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.get('/api/v1/promotions');
  expect(response.ok()).toBeTruthy();
  const body = await response.json() as {
    ok: true;
    data: Array<{ code: string; startsAt: string; endsAt: string }>;
  };
  await api.dispose();
  const promotion = body.data.find((item) => item.code === 'WELCOME10');
  if (!promotion) throw new Error('WELCOME10 must exist in the healthy scenario.');
  return promotion;
}

test.describe('BeeUI calendar and date/time contracts in persisted promotion scheduling', () => {
  test.beforeEach(async () => {
    await resetHealthy();
  });

  test('Calendar exposes the controlled selected day and updates BeeECOM start-date state', async ({ page }) => {
    await page.goto(`${ADMIN}/conformance/datetime`);
    await expect(page.getByText('Promotion date & time acceptance')).toBeVisible();

    const grid = page.getByRole('grid', { name: 'Campaign start preview calendar' });
    await expect(grid).toBeVisible();

    const january1 = page.getByTestId('campaign-calendar-day-2026-01-01');
    const january2 = page.getByTestId('campaign-calendar-day-2026-01-02');
    await expect(january1).toHaveAttribute('aria-selected', 'true');
    await expect(january2).toHaveAttribute('aria-selected', 'false');

    await january2.click();
    await expect(january1).toHaveAttribute('aria-selected', 'false');
    await expect(january2).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('campaign-start-picker-value')).toContainText('Jan 2, 2026');
  });

  test('DatePicker opens a calendar overlay, commits a date and restores trigger focus', async ({ page }) => {
    await page.goto(`${ADMIN}/conformance/datetime`);
    await expect(page.getByText('Welcome 10%')).toBeVisible();

    const trigger = page.getByRole('button', { name: 'Campaign start date' });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('campaign-start-picker-calendar-grid')).toBeVisible();

    await page.getByTestId('campaign-start-picker-calendar-day-2026-01-03').click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused();
    await expect(page.getByTestId('campaign-start-picker-value')).toContainText('Jan 3, 2026');
  });

  test('DateTimePicker and Calendar persist a changed campaign window through the canonical API', async ({ page }) => {
    await page.goto(`${ADMIN}/conformance/datetime`);
    await expect(page.getByText('Welcome 10%')).toBeVisible();

    await page.getByTestId('campaign-calendar-day-2026-01-02').click();

    const endTrigger = page.getByRole('button', { name: 'Campaign end date and time' });
    await expect(endTrigger).toHaveAttribute('aria-expanded', 'false');
    await endTrigger.click();
    await expect(endTrigger).toHaveAttribute('aria-expanded', 'true');

    await page.getByTestId('campaign-end-picker-calendar-day-2026-12-30').click();
    const hour = page.getByRole('textbox', { name: 'Hour' });
    const minute = page.getByRole('textbox', { name: 'Minute' });
    await hour.fill('18');
    await minute.fill('30');
    await minute.press('Tab');
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(endTrigger).toHaveAttribute('aria-expanded', 'false');

    await page.getByRole('button', { name: 'Save campaign schedule' }).click();
    await expect(page.getByTestId('campaign-save-notice')).toHaveText('Promotion schedule persisted.');

    const persisted = await welcomePromotion();
    expect(persisted.startsAt).toBe('2026-01-02T00:00:00.000Z');
    expect(persisted.endsAt).toBe('2026-12-30T18:30:00.000Z');
  });

  test('Datetime scheduling reflows at 360px with no serious or critical axe violations', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(`${ADMIN}/conformance/datetime`);
    await expect(page.getByText('Welcome 10%')).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    const violations = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
  });
});
