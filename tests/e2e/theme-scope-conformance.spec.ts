import { expect, test, type Page } from '@playwright/test';

const STOREFRONT = 'http://127.0.0.1:5173';
const STORAGE_KEY = 'beeecom.theme.preference';

async function startWithLightGlobalTheme(page: Page) {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.addInitScript((key) => {
    window.localStorage.setItem(key, 'light');
  }, STORAGE_KEY);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(`${STOREFRONT}/conformance/theme-scope`);

  try {
    await expect(page.getByText('Theme preference: Light')).toBeVisible();
  } catch (cause) {
    const body = await page.locator('body').innerText().catch(() => '<body unavailable>');
    throw new Error(
      [
        'Theme-scope acceptance route failed to render.',
        `pageErrors=${JSON.stringify(pageErrors)}`,
        `consoleErrors=${JSON.stringify(consoleErrors)}`,
        `body=${JSON.stringify(body)}`,
        `original=${cause instanceof Error ? cause.message : String(cause)}`,
      ].join('\n'),
    );
  }
}

async function token(page: Page, id: string): Promise<string> {
  const text = await page.getByTestId(id).textContent();
  if (!text) throw new Error(`Missing token text for ${id}`);
  const separator = text.indexOf('=');
  return separator >= 0 ? text.slice(separator + 1).trim() : text.trim();
}

test.describe('BeeUI scoped theme + runtime token conformance', () => {
  test('isolates global, scoped, nested and sibling token reads', async ({ page }) => {
    await startWithLightGlobalTheme(page);

    const globalBackground = await token(page, 'global-background');
    const globalPrimary = await token(page, 'global-primary');
    const siblingBackground = await token(page, 'sibling-background');
    const siblingPrimary = await token(page, 'sibling-primary');
    const scopedBackground = await token(page, 'scoped-background');
    const scopedPrimary = await token(page, 'scoped-primary');
    const nestedPrimary = await token(page, 'nested-primary');

    expect(siblingBackground).toBe(globalBackground);
    expect(siblingPrimary).toBe(globalPrimary);
    expect(scopedBackground).not.toBe(globalBackground);
    expect(scopedPrimary).not.toBe(globalPrimary);
    expect(nestedPrimary).not.toBe(scopedPrimary);

    // `getBeeToken` is an imperative snapshot API. Exercise it only after the
    // theme runtime has initialized, exactly as BeeUI's public contract requires.
    await page.getByRole('button', { name: 'Read imperative global primary' }).click();
    expect(await token(page, 'scoped-imperative-global-primary')).toBe(globalPrimary);

    await expect(page.getByTestId('scoped-radius')).toHaveText(/^radius=\d+(?:\.\d+)?$/);
    await expect(page.getByTestId('scoped-motion')).toHaveText(/^motion=\d+(?:\.\d+)?$/);
  });

  test('preserves the scoped theme through a Web Popover portal and scope updates', async ({ page }) => {
    await startWithLightGlobalTheme(page);

    await page.getByRole('button', { name: 'Increment scoped state' }).click();
    await expect(page.getByRole('button', { name: 'Increment scoped state' })).toHaveText('Scoped count 1');

    const trigger = page.getByRole('button', { name: 'Open scoped Popover' });
    await trigger.click();
    const portal = page.getByRole('dialog', { name: 'Scoped portal' });
    await expect(portal).toBeVisible();

    const darkScopedBackground = await token(page, 'scoped-background');
    const darkScopedPrimary = await token(page, 'scoped-primary');
    expect(await token(page, 'portal-background')).toBe(darkScopedBackground);
    expect(await token(page, 'portal-primary')).toBe(darkScopedPrimary);

    // BeeThemeScope forwards only a new ScopedTheme value, so local component
    // state and open overlay state must survive an appearance change.
    await page.getByRole('button', { name: 'Toggle Violet scoped appearance' }).click();
    await expect(page.getByText('Violet light scope')).toBeVisible();
    await expect(portal).toBeVisible();
    await expect(page.getByRole('button', { name: 'Increment scoped state' })).toHaveText('Scoped count 1');

    const lightScopedBackground = await token(page, 'scoped-background');
    const lightScopedPrimary = await token(page, 'scoped-primary');
    expect(lightScopedBackground).not.toBe(darkScopedBackground);
    expect(await token(page, 'portal-background')).toBe(lightScopedBackground);
    expect(await token(page, 'portal-primary')).toBe(lightScopedPrimary);

    // Changing the unrelated global theme must update global/sibling consumers
    // without overriding the explicit Violet light subtree or its portaled content.
    const scopedBeforeGlobalChange = await token(page, 'scoped-background');
    const globalBefore = await token(page, 'global-background');
    await page.getByRole('button', { name: 'Use Dark theme' }).click();
    await expect(page.getByText('Theme preference: Dark')).toBeVisible();
    await expect.poll(() => token(page, 'global-background')).not.toBe(globalBefore);
    await expect.poll(() => token(page, 'sibling-background')).toBe(await token(page, 'global-background'));
    await expect.poll(() => token(page, 'scoped-background')).toBe(scopedBeforeGlobalChange);
    await expect.poll(() => token(page, 'portal-background')).toBe(scopedBeforeGlobalChange);

    await page.keyboard.press('Escape');
    await expect(portal).toBeHidden();
  });
});
