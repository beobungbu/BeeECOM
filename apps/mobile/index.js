import '@expo/metro-runtime';
import { registerRootComponent } from 'expo';

import ThemeRoot from './src/ThemeRoot';
import { loadDemoSession } from './src/demo-session';

void loadDemoSession().catch((error) => {
  console.warn('Unable to restore BeeECOM demo session; deterministic defaults remain active.', error);
});

registerRootComponent(ThemeRoot);