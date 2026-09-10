import {
  applyThemePreference,
  isThemePreference,
  ThemePreferenceControl,
  type ThemePreference,
} from '@beeecom/app-ui';
import { BeeUIProvider } from '@beemvp/beeui-ui';
import * as React from 'react';
import { App } from './App';
import { CatalogFormConformance } from './CatalogFormConformance';
import { ContentDisclosureConformance } from './ContentDisclosureConformance';

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
  if (window.location.pathname === '/conformance/content-disclosure') {
    return <ContentDisclosureConformance />;
  }
  return <App />;
}

export function ThemeRoot() {
  const [preference, setPreference] = React.useState<ThemePreference>(initialPreference);

  const changePreference = React.useCallback((next: ThemePreference) => {
    applyThemePreference(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    setPreference(next);
  }, []);

  return (
    <BeeUIProvider>
      <CurrentSurface />
      <ThemePreferenceControl preference={preference} onPreferenceChange={changePreference} />
    </BeeUIProvider>
  );
}
