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

async function welcomeCampaign() {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.get('/api/v1/promotions');
  expect(response.ok()).toBeTruthy();
  const body = await response.json() as {
    ok: true;
    data: Array<{ code: string; startsAt: string; endsAt: string }>;
  };
  await api.dispose();
  const campaign = body.data.find((item) => item.code === 'WELCOME10');
  if (!campaign) throw new Error('WELCOME10 campaign must exist in healthy scenario.');
  return campaign;
}

async function setLaunchTime(page: import('@playwright/test').Page, hour: string, minute: string) {
  const trigger = page.getByTestId('campaign-launch-trigger');
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('campaign-launch-content')).toBeVisible();

  const focusedDay = page.locator('[data-testid^="campaign-launch-calendar-day-"][tabindex="0"]');
  await expect(focusedDay).toBeFocused();

  const hourInput = page.getByTestId('campaign-launch-time-hour');
  const minuteInput = page.getByTestId('campaign-launch-time-minute');
  await hourInput.fill(hour);
  await hourInput.press('Tab');
  await minuteInput.fill(minute);
  await minuteInput.press('Tab');
  await page.getByTestId('campaign-launch-content-done').click();

  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toBeFocused();
}

async function setExpiry(page: import('@playwright/test').Page, isoDate: string) {
  const trigger = page.getByTestId('campaign-expiry-trigger');
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await page.getByTestId(`campaign-expiry-calendar-day-${isoDate}`).click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toBeFocused();
}

test.describe('Campaign scheduling product flow', () => {
  test.beforeEach(async () => {
    await resetHealthy();
  });

  test('DateTimePicker exposes disclosure state, calendar focus and editable 24-hour time', async ({ page }) => {
    await page.goto(`${ADMIN}/conformance/campaign-scheduling`);
    await expect(page.getByText('Campaign schedule', { exact: true })).toBeVisible();
    await expect(page.getByText('WELCOME10', { exact: true })).toBeVisible();

    const trigger = page.getByTestId('campaign-launch-trigger');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await setLaunchTime(page, '9', '30');
    await expect(page.getByTestId('campaign-launch-summary')).toHaveText('Jan 1, 2026 at 09:30 UTC');
  });

  test('DatePicker changes the expiry date and restores focus to its trigger', async ({ page }) => {
    await page.goto(`${ADMIN}/conformance/campaign-scheduling`);
    await expect(page.getByText('WELCOME10', { exact: true })).toBeVisible();

    await setExpiry(page, '2026-12-30');
    await expect(page.getByTestId('campaign-expiry-summary')).toHaveText('Through Dec 30, 2026');
  });

  test('saving the schedule persists launch time and expiry to the canonical promotion', async ({ page }) => {
    await page.goto(`${ADMIN}/conformance/campaign-scheduling`);
    await expect(page.getByText('WELCOME10', { exact: true })).toBeVisible();

    await setLaunchTime(page, '9', '30');
    await setExpiry(page, '2026-12-30');
    await page.getByRole('button', { name: 'Save schedule' }).click();
    await expect(page.getByTestId('campaign-schedule-notice')).toHaveText('Campaign schedule saved.');

    const persisted = await welcomeCampaign();
    expect(persisted.startsAt).toBe('2026-01-01T09:30:00.000Z');
    expect(persisted.endsAt).toBe('2026-12-30T23:59:59.000Z');
    await expect(page.getByTestId('campaign-schedule-summary')).toContainText('Jan 1, 2026 at 09:30 UTC');
    await expect(page.getByTestId('campaign-schedule-summary')).toContainText('Dec 30, 2026 at 23:59 UTC');
  });

  test('campaign scheduling remains usable at 360px with no serious or critical axe findings', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(`${ADMIN}/conformance/campaign-scheduling`);
    await expect(page.getByText('Campaign schedule', { exact: true })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    const violations = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
  });
});
