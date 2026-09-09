import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  applyThemePreference,
  isThemePreference,
  ThemePreferenceControl,
  type ThemePreference,
} from '@beeecom/app-ui';
import { BeeUIProvider } from '@beemvp/beeui-ui';
import * as React from 'react';
import App from '../App';

const STORAGE_KEY = 'beeecom.theme.preference';

export default function ThemeRoot() {
  const [preference, setPreference] = React.useState<ThemePreference>('system');

  React.useEffect(() => {
    let active = true;
    applyThemePreference('system');

    void AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!active || !isThemePreference(stored)) return;
        applyThemePreference(stored);
        setPreference(stored);
      })
      .catch((error) => {
        console.warn('Unable to restore BeeECOM theme preference; System remains active.', error);
      });

    return () => {
      active = false;
    };
  }, []);

  const changePreference = React.useCallback((next: ThemePreference) => {
    applyThemePreference(next);
    setPreference(next);
    void AsyncStorage.setItem(STORAGE_KEY, next).catch((error) => {
      console.warn('Unable to persist BeeECOM theme preference.', error);
    });
  }, []);

  return (
    <BeeUIProvider>
      <App
        themeControl={(
          <ThemePreferenceControl
            preference={preference}
            onPreferenceChange={changePreference}
          />
        )}
      />
    </BeeUIProvider>
  );
}
