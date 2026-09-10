import {
  applyThemePreference,
  isThemePreference,
  ThemePreferenceControl,
  type ThemePreference,
} from '@beeecom/app-ui';
import { BeeUIProvider } from '@beemvp/beeui-ui';
import * as React from 'react';
import { App } from './App';
import { CampaignSchedulingConformance } from './CampaignSchedulingConformance';
import { CatalogFormConformance } from './CatalogFormConformance';
import { CustomerSegmentationConformance } from './CustomerSegmentationConformance';
import { InventoryHealthConformance } from './InventoryHealthConformance';
import { ReturnOperationsConformance } from './ReturnOperationsConformance';
import { ReviewIdentityConformance } from './ReviewIdentityConformance';

const STORAGE_KEY = 'beeecom.theme.preference';

function readStoredPreference(): ThemePreference {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isThemePreference(stored) ? stored : 'system';
}

const initialPreference = readStoredPreference();
applyThemePreference(initialPreference);

function CurrentSurface() {
  if (window.location.pathname === '/conformance/forms') {
    return <CatalogFormConformance />;
  }
  if (window.location.pathname === '/conformance/review-identity') {
    return <ReviewIdentityConformance />;
  }
  if (window.location.pathname === '/conformance/customer-segmentation') {
    return <CustomerSegmentationConformance />;
  }
  if (window.location.pathname === '/conformance/return-operations') {
    return <ReturnOperationsConformance />;
  }
  if (window.location.pathname === '/conformance/inventory-health') {
    return <InventoryHealthConformance />;
  }
  if (window.location.pathname === '/conformance/campaign-scheduling') {
    return <CampaignSchedulingConformance />;
  }
  return <App />;
}

export function ThemeRoot() {
  const [preference, setPreference] = React.useState<ThemePreference>(initialPreference);
  const showThemeHarness = window.location.pathname === '/';

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
