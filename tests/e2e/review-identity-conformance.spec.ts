import AxeBuilder from '@axe-core/playwright';
import { expect, request as playwrightRequest, test } from '@playwright/test';

const API = 'http://127.0.0.1:8787';
const ADMIN = 'http://127.0.0.1:5174';
const RESET_TOKEN = 'qa-reset-token';
const REVIEW_ID = 'review-cloud-1';

async function resetHealthy() {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.post('/api/v1/demo/reset', {
    headers: { 'x-demo-reset-token': RESET_TOKEN },
    data: { scenario: 'healthy' },
  });
  expect(response.ok()).toBeTruthy();
  await api.dispose();
}

async function reviewStatus(): Promise<string> {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.get('/api/v1/admin/reviews');
  expect(response.ok()).toBeTruthy();
  const body = await response.json() as {
    ok: true;
    data: Array<{ id: string; status: string }>;
  };
  await api.dispose();
  const review = body.data.find((item) => item.id === REVIEW_ID);
  if (!review) throw new Error(`${REVIEW_ID} must exist in the healthy scenario.`);
  return review.status;
}

test.describe('BeeUI review identity and moderation contracts', () => {
  test.beforeEach(async () => {
    await resetHealthy();
  });

  test('Breadcrumb exposes an interactive ancestor and a non-interactive current page', async ({ page }) => {
    await page.goto(`${ADMIN}/conformance/review-identity`);
    await expect(page.getByText('Review moderation acceptance')).toBeVisible();

    await expect(page.getByRole('link', { name: 'Reviews' })).toBeVisible();
    const current = page.getByTestId('review-breadcrumb-current');
    await expect(current).toContainText('Great everyday tee');
    await expect(current).toHaveAttribute('aria-label', 'Great everyday tee');

    // WAI-ARIA APG allows aria-current to be omitted when the element representing
    // the current page is not a link. BeeUI deliberately renders `current` as
    // non-interactive text, so the consumer contract is that it must not masquerade
    // as another actionable breadcrumb item.
    await expect(page.getByRole('link', { name: 'Great everyday tee' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Great everyday tee' })).toHaveCount(0);
  });

  test('ChipGroup exposes a single checked moderation decision and persists it through D1', async ({ page }) => {
    expect(await reviewStatus()).toBe('published');

    await page.goto(`${ADMIN}/conformance/review-identity`);
    await expect(page.getByText('Ava Nguyen')).toBeVisible();

    const group = page.getByRole('radiogroup', { name: 'Review moderation decision' });
    await expect(group).toBeVisible();
    const published = page.getByRole('radio', { name: 'Published' });
    const rejected = page.getByRole('radio', { name: 'Rejected' });
    await expect(published).toBeChecked();
    await expect(rejected).not.toBeChecked();

    await rejected.click();
    await expect(published).not.toBeChecked();
    await expect(rejected).toBeChecked();
    await page.getByRole('button', { name: 'Save moderation' }).click();
    await expect(page.getByTestId('review-moderation-notice')).toHaveText('Review moderation persisted.');
    expect(await reviewStatus()).toBe('rejected');
  });

  test('Avatar fallback and canonical review metadata reflow cleanly at 360px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(`${ADMIN}/conformance/review-identity`);
    await expect(page.getByText('Ava Nguyen')).toBeVisible();

    await expect(page.getByTestId('reviewer-avatar')).toContainText('AN');
    await expect(page.getByTestId('review-canonical-details')).toContainText('Cloud Tee');
    await expect(page.getByTestId('review-canonical-details')).toContainText('5 / 5');
    await expect(page.getByTestId('review-canonical-details')).toContainText('published');

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    const violations = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
  });
});
