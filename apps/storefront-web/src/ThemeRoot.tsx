import {
  applyThemePreference,
  isThemePreference,
  ThemePreferenceControl,
  type ThemePreference,
} from '@beeecom/app-ui';
import { BeeUIProvider } from '@beemvp/beeui-ui';
import * as React from 'react';
import { AccountHubConformance } from './AccountHubConformance';
import { AccountVerificationConformance } from './AccountVerificationConformance';
import { App } from './App';
import { CatalogDiscoveryConformance } from './CatalogDiscoveryConformance';
import { CollectionDiscoveryConformance } from './CollectionDiscoveryConformance';
import { LayoutActionsConformance } from './LayoutActionsConformance';
import { OrderHistoryConformance } from './OrderHistoryConformance';

const STORAGE_KEY = 'beeecom.theme.preference';

function readStoredPreference(): ThemePreference {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isThemePreference(stored) ? stored : 'system';
}

const initialPreference = readStoredPreference();
applyThemePreference(initialPreference);

function CurrentSurface() {
  if (window.location.pathname === '/conformance/layout-actions') {
    return <LayoutActionsConformance />;
  }
  if (window.location.pathname === '/conformance/catalog-discovery') {
    return <CatalogDiscoveryConformance />;
  }
  if (window.location.pathname === '/conformance/account-verification') {
    return <AccountVerificationConformance />;
  }
  if (window.location.pathname === '/conformance/collections') {
    return <CollectionDiscoveryConformance />;
  }
  if (window.location.pathname === '/conformance/orders' || window.location.pathname.startsWith('/conformance/orders/')) {
    return <OrderHistoryConformance />;
  }
  if (window.location.pathname === '/conformance/account') {
    return <AccountHubConformance />;
  }
  return <App />;
}

export function ThemeRoot() {
  const [preference, setPreference] = React.useState<ThemePreference>(initialPreference);
  const showThemeHarness = window.location.pathname === '/conformance/theme-preference';

  const changePreference = React.useCallback((next: ThemePreference) => {
    applyThemePreference(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    setPreference(next);
  }, []);

  return (
    <BeeUIProvider>
      <CurrentSurface />
      {showThemeHarness ? (
        <ThemePreferenceControl preference={preference} onPreferenceChange={changePreference} />
      ) : null}
    </BeeUIProvider>
  );
}
