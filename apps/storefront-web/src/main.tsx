import './global.css';

import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeRoot } from './ThemeRoot';

const container = document.getElementById('root');
if (!container) throw new Error('Root container #root was not found.');

createRoot(container).render(
  <React.StrictMode>
    <ThemeRoot />
  </React.StrictMode>,
);