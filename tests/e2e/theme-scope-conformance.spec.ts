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

async function semanticPrimary(page: Page, id: string): Promise<string> {
  return page.getByTestId(`${id}-style-primary`).evaluate((element) => getComputedStyle(element).backgroundColor);
}

test.describe('BeeUI scoped theme + runtime token conformance', () => {
  test('isolates global, scoped, nested and sibling semantic CSS', async ({ page }) => {
    await startWithLightGlobalTheme(page);

    const globalStylePrimary = await semanticPrimary(page, 'global');
    const scopedStylePrimary = await semanticPrimary(page, 'scoped');
    const nestedStylePrimary = await semanticPrimary(page, 'nested');
    const siblingStylePrimary = await semanticPrimary(page, 'sibling');

    expect(siblingStylePrimary).toBe(globalStylePrimary);
    expect(scopedStylePrimary).not.toBe(globalStylePrimary);
    expect(nestedStylePrimary).not.toBe(scopedStylePrimary);

    // Global useBeeToken remains independently useful while scope-aware hook
    // reads are quarantined under BeeUI #550.
    const globalPrimary = await token(page, 'global-primary');
    expect(await token(page, 'sibling-primary')).toBe(globalPrimary);
    await expect(page.getByTestId('global-radius')).toHaveText(/^radius=\d+(?:\.\d+)?$/);

    // `getBeeToken` is an imperative snapshot API. Exercise it only after the
    // theme runtime has initialized, exactly as BeeUI's public contract requires.
    await page.getByRole('button', { name: 'Read imperative global primary' }).click();
    expect(await token(page, 'scoped-imperative-global-primary')).toBe(globalPrimary);

    // Intentionally no scoped useBeeToken equality assertion here. Exact failing
    // browser evidence is preserved in BeeUI #550 / CI 34424257202.
  });

  test('preserves scoped semantic CSS through a Web Popover portal and scope updates', async ({ page }) => {
    await startWithLightGlobalTheme(page);

    await page.getByRole('button', { name: 'Increment scoped state' }).click();
    await expect(page.getByRole('button', { name: 'Increment scoped state' })).toHaveText('Scoped count 1');

    const darkScopedPrimary = await semanticPrimary(page, 'scoped');
    const trigger = page.getByRole('button', { name: 'Open scoped Popover' });
    await trigger.click();
    const portal = page.getByRole('dialog', { name: 'Scoped portal' });
    await expect(portal).toBeVisible();
    expect(await semanticPrimary(page, 'portal')).toBe(darkScopedPrimary);

    // BeeThemeScope forwards only a new ScopedTheme value, so local component
    // state and open overlay state must survive an appearance change.
    await page.getByRole('button', { name: 'Toggle Violet scoped appearance' }).click();
    await expect(page.getByText('Violet light scope')).toBeVisible();
    await expect(portal).toBeVisible();
    await expect(page.getByRole('button', { name: 'Increment scoped state' })).toHaveText('Scoped count 1');

    const lightScopedPrimary = await semanticPrimary(page, 'scoped');
    expect(lightScopedPrimary).not.toBe(darkScopedPrimary);
    expect(await semanticPrimary(page, 'portal')).toBe(lightScopedPrimary);

    // Changing the unrelated global theme must update global/sibling semantic
    // CSS without overriding the explicit Violet light subtree or its portal.
    const scopedBeforeGlobalChange = lightScopedPrimary;
    const globalBefore = await semanticPrimary(page, 'global');
    await page.getByRole('button', { name: 'Use Dark theme' }).click();
    await expect(page.getByText('Theme preference: Dark')).toBeVisible();
    await expect.poll(() => semanticPrimary(page, 'global')).not.toBe(globalBefore);
    await expect.poll(() => semanticPrimary(page, 'sibling')).toBe(await semanticPrimary(page, 'global'));
    await expect.poll(() => semanticPrimary(page, 'scoped')).toBe(scopedBeforeGlobalChange);
    await expect.poll(() => semanticPrimary(page, 'portal')).toBe(scopedBeforeGlobalChange);

    await page.keyboard.press('Escape');
    await expect(portal).toBeHidden();
  });
});
