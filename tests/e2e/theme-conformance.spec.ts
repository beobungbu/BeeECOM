import { expect, test, type Page, type TestInfo } from '@playwright/test';

const storefrontUrl = 'http://127.0.0.1:5173/conformance/theme-preference';
const adminUrl = 'http://127.0.0.1:5174/conformance/theme-preference';
const storageKey = 'beeecom.theme.preference';

async function themeLabelColor(page: Page): Promise<string> {
  const label = page.getByText(/^Theme preference:/).first();
  await expect(label).toBeVisible();
  return label.evaluate((element) => getComputedStyle(element).color);
}

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
}

async function clearThemePreference(page: Page) {
  await page.addInitScript((key) => {
    const marker = '__beeecomThemeConformanceInitialized';
    if (window.sessionStorage.getItem(marker) === '1') return;
    window.localStorage.removeItem(key);
    window.sessionStorage.setItem(marker, '1');
  }, storageKey);
}

test.describe('BeeUI theme preference conformance', () => {
  test('Storefront supports System → Light/Dark overrides → System restore', async ({ page }, testInfo) => {
    await clearThemePreference(page);
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(storefrontUrl);

    await expect(page.getByText('Theme preference: System')).toBeVisible();
    const systemLightColor = await themeLabelColor(page);
    await attachScreenshot(page, testInfo, 'storefront-system-light');

    await page.emulateMedia({ colorScheme: 'dark' });
    await expect.poll(() => themeLabelColor(page)).not.toBe(systemLightColor);
    const systemDarkColor = await themeLabelColor(page);
    await attachScreenshot(page, testInfo, 'storefront-system-dark');

    await page.getByRole('button', { name: 'Use Light theme' }).click();
    await expect(page.getByText('Theme preference: Light')).toBeVisible();
    await expect.poll(() => themeLabelColor(page)).toBe(systemLightColor);

    await page.emulateMedia({ colorScheme: 'dark' });
    await expect.poll(() => themeLabelColor(page)).toBe(systemLightColor);

    await page.getByRole('button', { name: 'Use Dark theme' }).click();
    await expect(page.getByText('Theme preference: Dark')).toBeVisible();
    await expect.poll(() => themeLabelColor(page)).toBe(systemDarkColor);

    await page.emulateMedia({ colorScheme: 'light' });
    await expect.poll(() => themeLabelColor(page)).toBe(systemDarkColor);

    await page.getByRole('button', { name: 'Use System theme' }).click();
    await expect(page.getByText('Theme preference: System')).toBeVisible();
    await expect.poll(() => themeLabelColor(page)).toBe(systemLightColor);

    await page.emulateMedia({ colorScheme: 'dark' });
    await expect.poll(() => themeLabelColor(page)).toBe(systemDarkColor);
  });

  test('Storefront persists the app-owned preference and can persist System again', async ({ page }) => {
    await clearThemePreference(page);
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(storefrontUrl);

    await page.getByRole('button', { name: 'Use Dark theme' }).click();
    await expect(page.getByText('Theme preference: Dark')).toBeVisible();
    await page.reload();
    await expect(page.getByText('Theme preference: Dark')).toBeVisible();

    await page.getByRole('button', { name: 'Use System theme' }).click();
    await expect(page.getByText('Theme preference: System')).toBeVisible();
    await page.reload();
    await expect(page.getByText('Theme preference: System')).toBeVisible();
  });

  test('Admin uses the same public System/Light/Dark path', async ({ page }, testInfo) => {
    await clearThemePreference(page);
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(adminUrl);

    await expect(page.getByText('Theme preference: System')).toBeVisible();
    const lightColor = await themeLabelColor(page);

    await page.getByRole('button', { name: 'Use Dark theme' }).click();
    await expect(page.getByText('Theme preference: Dark')).toBeVisible();
    await expect.poll(() => themeLabelColor(page)).not.toBe(lightColor);
    await attachScreenshot(page, testInfo, 'admin-dark');

    await page.getByRole('button', { name: 'Use System theme' }).click();
    await expect(page.getByText('Theme preference: System')).toBeVisible();
  });
});
