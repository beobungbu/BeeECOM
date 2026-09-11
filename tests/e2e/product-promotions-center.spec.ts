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

async function promotions() {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.get('/api/v1/promotions');
  expect(response.ok()).toBeTruthy();
  const payload = await response.json() as {
    ok: true;
    data: Array<{
      id: string;
      code: string;
      title: string;
      description: string;
      kind: string;
      value: number;
      active: boolean;
      startsAt: string;
      endsAt: string;
    }>;
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

test.describe('Promotions Center product flow', () => {
  test.beforeEach(async () => {
    await resetHealthy();
  });

  test('creates a real inactive campaign from the Admin editor and persists it', async ({ page }) => {
    await page.goto(`${ADMIN}/conformance/promotions`);
    await expect(page.getByText('Promotions', { exact: true }).first()).toBeVisible();

    await page.getByRole('button', { name: 'New campaign' }).click();
    await page.getByLabel('Campaign code').fill('FALL25');
    await page.getByLabel('Campaign title').fill('Fall 25%');
    await page.getByLabel('Customer message').fill('Save 25% on selected fall essentials.');
    await page.getByLabel('Discount percentage').fill('25');
    await page.getByRole('button', { name: 'Create campaign' }).click();

    await expect(page.getByTestId('promotion-notice')).toContainText('Campaign FALL25 created as inactive.');
    await expect(page.getByRole('button', { name: 'Activate campaign' })).toBeVisible();

    const created = (await promotions()).find((item) => item.code === 'FALL25');
    expect(created).toMatchObject({
      code: 'FALL25',
      title: 'Fall 25%',
      description: 'Save 25% on selected fall essentials.',
      kind: 'percentage',
      value: 25,
      active: false,
    });
    expect(Date.parse(created!.startsAt)).toBeLessThan(Date.parse(created!.endsAt));
  });

  test('activating a future campaign changes product status to Scheduled and survives reload', async ({ page }) => {
    await page.goto(`${ADMIN}/conformance/promotions`);
    await page.getByRole('button', { name: 'New campaign' }).click();
    await page.getByLabel('Campaign code').fill('NEXT20');
    await page.getByLabel('Campaign title').fill('Next 20%');
    await page.getByLabel('Customer message').fill('A scheduled offer for the next collection.');
    await page.getByRole('button', { name: 'Create campaign' }).click();
    await page.getByRole('button', { name: 'Activate campaign' }).click();

    await expect(page.getByTestId('promotion-notice')).toContainText('Campaign NEXT20 activated.');
    await expect(page.getByText('Scheduled', { exact: true }).last()).toBeVisible();

    const created = (await promotions()).find((item) => item.code === 'NEXT20');
    expect(created?.active).toBe(true);
    expect(Date.parse(created!.startsAt)).toBeGreaterThan(Date.now());

    await page.reload();
    await page.getByLabel('Edit campaign NEXT20').click();
    await expect(page.getByText('Scheduled', { exact: true }).last()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Deactivate campaign' })).toBeVisible();
  });

  test('editing an existing campaign persists business copy and fixed discount value', async ({ page }) => {
    await page.goto(`${ADMIN}/conformance/promotions`);
    await page.getByLabel('Edit campaign WELCOME10').click();
    await page.getByLabel('Campaign title').fill('Welcome credit');
    await page.getByLabel('Customer message').fill('A refreshed welcome offer for first-time customers.');
    await page.getByRole('radio', { name: 'Fixed amount off' }).click();
    await page.getByLabel('Discount amount (USD)').fill('12.50');
    await page.getByRole('button', { name: 'Save campaign' }).click();

    await expect(page.getByTestId('promotion-notice')).toContainText('Campaign WELCOME10 saved.');
    const updated = (await promotions()).find((item) => item.code === 'WELCOME10');
    expect(updated).toMatchObject({
      title: 'Welcome credit',
      description: 'A refreshed welcome offer for first-time customers.',
      kind: 'fixed',
      value: 1250,
    });
  });

  test('server rejects duplicate code and invalid windows without corrupting campaigns', async () => {
    const api = await playwrightRequest.newContext({ baseURL: API });
    const original = await promotions();

    const duplicate = await api.post('/api/v1/admin/promotions', {
      data: {
        code: 'WELCOME10',
        title: 'Duplicate welcome',
        description: 'This must not be inserted.',
        kind: 'percentage',
        value: 10,
        startsAt: '2035-01-01T09:00:00.000Z',
        endsAt: '2035-01-31T23:59:59.000Z',
      },
    });
    expect(duplicate.status()).toBe(409);
    expect((await duplicate.json() as { ok: false; error: { code: string } }).error.code).toBe('PROMOTION_CODE_IN_USE');

    const invalidWindow = await api.post('/api/v1/admin/promotions', {
      data: {
        code: 'BADWINDOW',
        title: 'Bad window',
        description: 'This must also be rejected.',
        kind: 'fixed',
        value: 1500,
        startsAt: '2035-02-02T09:00:00.000Z',
        endsAt: '2035-02-01T23:59:59.000Z',
      },
    });
    expect(invalidWindow.status()).toBe(400);
    expect((await invalidWindow.json() as { ok: false; error: { code: string } }).error.code).toBe('INVALID_PROMOTION_WINDOW');
    await api.dispose();

    expect((await promotions()).length).toBe(original.length);
  });

  test('Promotions Center remains accessible at 390px and produces visual evidence', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${ADMIN}/conformance/promotions`);
    await expect(page.getByTestId('promotion-list')).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
    await attachFullPage(page, testInfo, 'promotions-center-mobile');
  });

  test('desktop Promotions Center produces product-quality visual evidence', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${ADMIN}/conformance/promotions`);
    await expect(page.getByTestId('promotion-editor')).toBeVisible();
    await attachFullPage(page, testInfo, 'promotions-center-desktop');
  });
});
