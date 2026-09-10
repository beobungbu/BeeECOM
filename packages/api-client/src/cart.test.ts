import { describe, expect, it } from 'vitest';

import { createBeeEcomClient } from './index';

function success(data: unknown) {
  return new Response(JSON.stringify({
    ok: true,
    data,
    meta: { requestId: 'req-cart-test', scenario: 'healthy' },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

describe('BeeEcom cart line client', () => {
  it('uses exact encoded paths and bodies for update and remove', async () => {
    const calls: Array<{ url: string; method: string; body: string | null }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({
        url: String(input),
        method: init?.method ?? 'GET',
        body: typeof init?.body === 'string' ? init.body : null,
      });
      return success({
        id: 'cart-ava',
        customerId: 'cust-ava',
        lines: [],
        updatedAt: '2026-09-10T00:00:00.000Z',
      });
    };
    const api = createBeeEcomClient({ baseUrl: 'https://demo.example/', fetchImpl });

    await api.carts.updateLine('cart ava', 'line/one', { quantity: 3 });
    await api.carts.removeLine('cart ava', 'line/one');

    expect(calls).toEqual([
      {
        url: 'https://demo.example/api/v1/cart/cart%20ava/lines/line%2Fone',
        method: 'PATCH',
        body: JSON.stringify({ quantity: 3 }),
      },
      {
        url: 'https://demo.example/api/v1/cart/cart%20ava/lines/line%2Fone',
        method: 'DELETE',
        body: null,
      },
    ]);
  });
});
