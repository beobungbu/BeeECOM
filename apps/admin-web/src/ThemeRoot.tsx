import {
  applyThemePreference,
  isThemePreference,
  ThemePreferenceControl,
  type ThemePreference,
} from '@beeecom/app-ui';
import { BeeUIProvider } from '@beemvp/beeui-ui';
import * as React from 'react';
import { AdminShell } from './AdminShell';
import { App } from './App';
import { CampaignSchedulingConformance } from './CampaignSchedulingConformance';
import { CatalogFormConformance } from './CatalogFormConformance';
import { CatalogInventoryCenter } from './CatalogInventoryCenter';
import { CustomerSegmentationConformance } from './CustomerSegmentationConformance';
import { InventoryHealthConformance } from './InventoryHealthConformance';
import { PromotionsCenter } from './PromotionsCenter';
import { ReturnOperationsConformance } from './ReturnOperationsConformance';
import { ReviewIdentityConformance } from './ReviewIdentityConformance';

const STORAGE_KEY = 'beeecom.theme.preference';

function readStoredPreference(): ThemePreference {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isThemePreference(stored) ? stored : 'system';
}

const initialPreference = readStoredPreference();
applyThemePreference(initialPreference);

function normalizedPath(): string {
  const path = window.location.pathname.replace(/\/+$/, '');
  return path || '/';
}

function CurrentSurface() {
  const path = normalizedPath();

  if (path === '/') {
    return <AdminShell section="operations"><App /></AdminShell>;
  }
  if (path === '/catalog') {
    return <AdminShell section="catalog"><CatalogInventoryCenter /></AdminShell>;
  }
  if (path === '/promotions') {
    return <AdminShell section="promotions"><PromotionsCenter /></AdminShell>;
  }

  if (path === '/conformance/forms') {
    return <CatalogFormConformance />;
  }
  if (path === '/conformance/catalog-inventory') {
    return <CatalogInventoryCenter />;
  }
  if (path === '/conformance/review-identity') {
    return <ReviewIdentityConformance />;
  }
  if (path === '/conformance/customer-segmentation') {
    return <CustomerSegmentationConformance />;
  }
  if (path === '/conformance/return-operations') {
    return <ReturnOperationsConformance />;
  }
  if (path === '/conformance/inventory-health') {
    return <InventoryHealthConformance />;
  }
  if (path === '/conformance/campaign-scheduling') {
    return <CampaignSchedulingConformance />;
  }
  if (path === '/conformance/promotions') {
    return <PromotionsCenter />;
  }

  return <AdminShell section="operations"><App /></AdminShell>;
}

export function ThemeRoot() {
  const [preference, setPreference] = React.useState<ThemePreference>(initialPreference);
  const showThemeHarness = normalizedPath() === '/conformance/theme-preference';

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
