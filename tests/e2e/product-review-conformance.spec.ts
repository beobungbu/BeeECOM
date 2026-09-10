import AxeBuilder from '@axe-core/playwright';
import { expect, request as playwrightRequest, test, type Page, type TestInfo } from '@playwright/test';

const API = 'http://127.0.0.1:8787';
const STOREFRONT = 'http://127.0.0.1:5173';
const RESET_TOKEN = 'qa-reset-token';
const CUSTOMER_ID = 'cust-ava';
const ORDER_ID = 'order-1001';
const PRODUCT_ID = 'prod-field-pack';
const REVIEW_PATH = `/conformance/product-review?orderId=${ORDER_ID}&productId=${PRODUCT_ID}`;

async function resetHealthy() {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.post('/api/v1/demo/reset', {
    headers: { 'x-demo-reset-token': RESET_TOKEN },
    data: { scenario: 'healthy' },
  });
  expect(response.ok()).toBeTruthy();
  await api.dispose();
}

async function deliverOrder() {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.patch(`/api/v1/admin/orders/${ORDER_ID}`, {
    data: { action: 'deliver' },
  });
  expect(response.ok()).toBeTruthy();
  await api.dispose();
}

async function adminReviews() {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.get('/api/v1/admin/reviews');
  expect(response.ok()).toBeTruthy();
  const body = await response.json() as {
    ok: true;
    data: Array<{
      id: string;
      productId: string;
      customerId: string;
      rating: number;
      title: string;
      body: string;
      status: string;
    }>;
  };
  await api.dispose();
  return body.data;
}

async function publicProductReviews() {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.get(`/api/v1/reviews?productId=${PRODUCT_ID}`);
  expect(response.ok()).toBeTruthy();
  const body = await response.json() as { ok: true; data: Array<{ productId: string; status: string }> };
  await api.dispose();
  return body.data;
}

async function attachFullPage(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' }),
    contentType: 'image/png',
  });
}

test.describe('Customer product review submission', () => {
  test.beforeEach(async () => {
    await resetHealthy();
    await deliverOrder();
  });

  test('verified recipient enters from delivered order detail and submits a pending review that persists', async ({ page }) => {
    await page.goto(`${STOREFRONT}/conformance/orders/${ORDER_ID}`);
    await expect(page.getByTestId('order-detail-items')).toContainText('Field Pack');
    await expect(page.getByTestId('order-progress-timeline')).toContainText('Delivered');
    await page.getByRole('button', { name: 'Review Field Pack' }).click();
    await expect(page).toHaveURL(`${STOREFRONT}${REVIEW_PATH}`);

    await expect(page.getByRole('heading', { name: 'Review your purchase' })).toBeVisible();
    await expect(page.getByTestId('review-purchase-summary')).toContainText('Field Pack');
    await expect(page.getByTestId('review-purchase-summary')).toContainText('Order #1001');
    await expect(page.getByText('Verified delivery')).toBeVisible();

    const group = page.getByRole('radiogroup');
    await expect(group).toBeVisible();
    const fourStars = page.getByRole('radio', { name: '4 stars' });
    await fourStars.click();
    await expect(fourStars).toBeChecked();

    await page.getByRole('button', { name: 'Submit review' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Review title must be between 3 and 120 characters.' })).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'Review body must be between 10 and 2000 characters.' })).toBeVisible();

    await page.getByRole('textbox', { name: 'Review title, required' }).fill('Perfect daily carry');
    await page.getByRole('textbox', { name: 'Your review, required' }).fill('Compact, comfortable, and easy to organize for a full day out.');
    await page.getByRole('button', { name: 'Submit review' }).click();

    const submitted = page.getByTestId('submitted-review');
    await expect(submitted).toBeVisible();
    await expect(submitted).toContainText('Pending review');
    await expect(page.getByTestId('submitted-review-rating')).toHaveText('4 / 5 stars');
    await expect(submitted).toContainText('Perfect daily carry');

    const reviews = await adminReviews();
    const persisted = reviews.find((review) => review.productId === PRODUCT_ID && review.customerId === CUSTOMER_ID);
    expect(persisted).toMatchObject({
      rating: 4,
      title: 'Perfect daily carry',
      body: 'Compact, comfortable, and easy to organize for a full day out.',
      status: 'pending',
    });

    expect((await publicProductReviews()).filter((review) => review.productId === PRODUCT_ID)).toHaveLength(0);

    await page.reload();
    await expect(page.getByTestId('submitted-review')).toContainText('Perfect daily carry');
    await expect(page.getByTestId('submitted-review')).toContainText('Pending review');
    await expect(page.getByRole('button', { name: 'Submit review' })).toHaveCount(0);
  });

  test('API rejects a second review from the same customer for the same product', async () => {
    const api = await playwrightRequest.newContext({ baseURL: API });
    const first = await api.post('/api/v1/reviews', {
      data: {
        productId: PRODUCT_ID,
        customerId: CUSTOMER_ID,
        rating: 5,
        title: 'Excellent pack',
        body: 'Exactly the size I wanted for a lightweight daily carry.',
      },
    });
    expect(first.status()).toBe(201);

    const duplicate = await api.post('/api/v1/reviews', {
      data: {
        productId: PRODUCT_ID,
        customerId: CUSTOMER_ID,
        rating: 3,
        title: 'Second review',
        body: 'This duplicate submission must never create another review.',
      },
    });
    expect(duplicate.status()).toBe(409);
    const body = await duplicate.json() as { ok: false; error: { code: string } };
    expect(body.error.code).toBe('REVIEW_ALREADY_EXISTS');
    await api.dispose();

    const persisted = (await adminReviews()).filter((review) => review.productId === PRODUCT_ID && review.customerId === CUSTOMER_ID);
    expect(persisted).toHaveLength(1);
  });

  test('API rejects review submission before a purchased product is delivered', async () => {
    await resetHealthy();
    const api = await playwrightRequest.newContext({ baseURL: API });
    const response = await api.post('/api/v1/reviews', {
      data: {
        productId: PRODUCT_ID,
        customerId: CUSTOMER_ID,
        rating: 5,
        title: 'Too early',
        body: 'This paid order has shipped but has not been delivered yet.',
      },
    });
    expect(response.status()).toBe(403);
    const body = await response.json() as { ok: false; error: { code: string } };
    expect(body.error.code).toBe('REVIEW_DELIVERY_REQUIRED');
    await api.dispose();
  });

  test('API rejects review submission when the customer has not purchased the product', async () => {
    const api = await playwrightRequest.newContext({ baseURL: API });
    const response = await api.post('/api/v1/reviews', {
      data: {
        productId: PRODUCT_ID,
        customerId: 'cust-minh',
        rating: 5,
        title: 'Not my purchase',
        body: 'This account has not purchased the Field Pack in the healthy scenario.',
      },
    });
    expect(response.status()).toBe(403);
    const body = await response.json() as { ok: false; error: { code: string } };
    expect(body.error.code).toBe('REVIEW_PURCHASE_REQUIRED');
    await api.dispose();

    const persisted = (await adminReviews()).filter((review) => review.productId === PRODUCT_ID && review.customerId === 'cust-minh');
    expect(persisted).toHaveLength(0);
  });

  test('review form reflows at 390px, passes serious/critical axe and produces visual evidence', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${STOREFRONT}${REVIEW_PATH}`);
    await expect(page.getByTestId('product-review-form')).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    const violations = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
    await attachFullPage(page, testInfo, 'product-review-mobile');
  });

  test('desktop review form produces product-quality visual evidence', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${STOREFRONT}${REVIEW_PATH}`);
    await expect(page.getByTestId('product-review-form')).toBeVisible();
    await attachFullPage(page, testInfo, 'product-review-desktop');
  });
});
