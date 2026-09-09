import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@beeecom/demo-session/v1';

export interface DemoSession {
  customerId: string;
  cartId: string;
  threadId: string;
}

export const defaultDemoSession: DemoSession = {
  customerId: 'cust-ava',
  cartId: 'cart-ava',
  threadId: 'thread-ava-1',
};

function isDemoSession(value: unknown): value is DemoSession {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.customerId === 'string'
    && typeof record.cartId === 'string'
    && typeof record.threadId === 'string';
}

export async function loadDemoSession(): Promise<DemoSession> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(defaultDemoSession));
    return defaultDemoSession;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isDemoSession(parsed)) return parsed;
  } catch {
    // Corrupt demo-session storage falls back to the deterministic persona.
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(defaultDemoSession));
  return defaultDemoSession;
}

export async function saveDemoSession(session: DemoSession): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export async function resetDemoSession(): Promise<DemoSession> {
  await saveDemoSession(defaultDemoSession);
  return defaultDemoSession;
}
