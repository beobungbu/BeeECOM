import { describe, expect, it } from 'vitest';

import { createBeeEcomClient } from './index';

function success(data: unknown) {
  return new Response(JSON.stringify({
    ok: true,
    data,
    meta: { requestId: 'req-test', scenario: 'healthy' },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

describe('BeeEcom customer settings client', () => {
  it('uses the typed customer PATCH route with the exact body', async () => {
    const calls: Array<{ url: string; method: string; body: string | null }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({
        url: String(input),
        method: init?.method ?? 'GET',
        body: typeof init?.body === 'string' ? init.body : null,
      });
      return success({
        id: 'cust-ava',
        displayName: 'Ava N.',
        email: 'ava+shop@example.test',
        tier: 'standard',
        addresses: [],
        lifetimeValue: { amount: 0, currency: 'USD' },
        createdAt: '2026-01-01T00:00:00.000Z',
      });
    };
    const api = createBeeEcomClient({ baseUrl: 'https://demo.example/', fetchImpl });
    const input = {
      displayName: 'Ava N.',
      email: 'ava+shop@example.test',
      address: {
        id: 'addr-ava-home',
        label: 'Home',
        fullName: 'Ava N.',
        phone: '+1 555 0101',
        line1: '20 Market Street',
        city: 'San Francisco',
        region: 'CA',
        postalCode: '94105',
        countryCode: 'US',
        isDefault: true,
      },
    } as const;

    await api.customers.update('cust-ava', input);

    expect(calls).toEqual([{
      url: 'https://demo.example/api/v1/customers/cust-ava',
      method: 'PATCH',
      body: JSON.stringify(input),
    }]);
  });
});
