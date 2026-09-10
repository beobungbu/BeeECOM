import { describe, expect, it } from 'vitest';

import { createBeeEcomClient } from './index';

function success(data: unknown, status = 200) {
  return new Response(JSON.stringify({
    ok: true,
    data,
    meta: { requestId: 'req-return-test', scenario: 'healthy' },
  }), { status, headers: { 'content-type': 'application/json' } });
}

describe('BeeEcom customer returns client', () => {
  it('encodes customer/order filters and submits the exact return body', async () => {
    const calls: Array<{ url: string; method: string; body: string | null }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({
        url: String(input),
        method: init?.method ?? 'GET',
        body: typeof init?.body === 'string' ? init.body : null,
      });
      if ((init?.method ?? 'GET') === 'POST') {
        return success({
          id: 'return-new',
          orderId: 'order-1001',
          customerId: 'cust-ava',
          reason: 'Damaged or defective — Strap stitching came loose after one use.',
          state: 'requested',
          requestedAt: '2026-09-10T00:00:00.000Z',
          updatedAt: '2026-09-10T00:00:00.000Z',
        }, 201);
      }
      return success([]);
    };
    const api = createBeeEcomClient({ baseUrl: 'https://demo.example/', fetchImpl });
    const input = {
      orderId: 'order-1001',
      customerId: 'cust-ava',
      reason: 'Damaged or defective — Strap stitching came loose after one use.',
    };

    await api.returns.list({ customerId: input.customerId, orderId: input.orderId });
    await api.returns.create(input);

    expect(calls).toEqual([
      {
        url: 'https://demo.example/api/v1/returns?customerId=cust-ava&orderId=order-1001',
        method: 'GET',
        body: null,
      },
      {
        url: 'https://demo.example/api/v1/returns',
        method: 'POST',
        body: JSON.stringify(input),
      },
    ]);
  });
});
