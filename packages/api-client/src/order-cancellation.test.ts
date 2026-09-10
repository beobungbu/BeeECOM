import { describe, expect, it } from 'vitest';

import { createBeeEcomClient } from './index';

function success(data: unknown) {
  return new Response(JSON.stringify({
    ok: true,
    data,
    meta: { requestId: 'req-order-cancel', scenario: 'cancellation-eligible' },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

describe('BeeEcom customer order cancellation client', () => {
  it('submits the exact encoded order path and body', async () => {
    const calls: Array<{ url: string; method: string; body: string | null }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({
        url: String(input),
        method: init?.method ?? 'GET',
        body: typeof init?.body === 'string' ? init.body : null,
      });
      return success({
        id: 'order/1001',
        number: '#1001',
        customerId: 'cust-ava',
        lines: [],
        subtotal: { amount: 6400, currency: 'USD' },
        discount: { amount: 0, currency: 'USD' },
        shipping: { amount: 900, currency: 'USD' },
        tax: { amount: 512, currency: 'USD' },
        total: { amount: 7812, currency: 'USD' },
        state: 'cancelled',
        paymentState: 'refunded',
        fulfillmentState: 'cancelled',
        shippingAddress: {},
        placedAt: '2026-08-30T12:00:00.000Z',
        updatedAt: '2026-09-10T00:00:00.000Z',
      });
    };
    const api = createBeeEcomClient({ baseUrl: 'https://demo.example/', fetchImpl });
    const input = { customerId: 'cust-ava', reason: 'Ordered by mistake' };

    await api.orders.cancel('order/1001', input);

    expect(calls).toEqual([{
      url: 'https://demo.example/api/v1/orders/order%2F1001/cancel',
      method: 'POST',
      body: JSON.stringify(input),
    }]);
  });
});
