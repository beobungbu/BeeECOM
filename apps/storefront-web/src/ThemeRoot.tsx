import {
  applyThemePreference,
  isThemePreference,
  ThemePreferenceControl,
  type ThemePreference,
} from '@beeecom/app-ui';
import { BeeUIProvider } from '@beemvp/beeui-ui';
import * as React from 'react';
import { App } from './App';
import { CartSheetConformance } from './CartSheetConformance';

const STORAGE_KEY = 'beeecom.theme.preference';

function readStoredPreference(): ThemePreference {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isThemePreference(stored) ? stored : 'system';
}

const initialPreference = readStoredPreference();
applyThemePreference(initialPreference);

export function ThemeRoot() {
  const [preference, setPreference] = React.useState<ThemePreference>(initialPreference);

  const changePreference = React.useCallback((next: ThemePreference) => {
    applyThemePreference(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    setPreference(next);
  }, []);

  const content = window.location.pathname === '/conformance/cart-sheet'
    ? <CartSheetConformance />
    : <App />;

  return (
    <BeeUIProvider>
      {content}
      <ThemePreferenceControl preference={preference} onPreferenceChange={changePreference} />
    </BeeUIProvider>
  );
}
