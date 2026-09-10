import { describe, expect, it } from 'vitest';

import { createBeeEcomClient } from './index';

function success(data: unknown) {
  return new Response(JSON.stringify({
    ok: true,
    data,
    meta: { requestId: 'req-checkout', scenario: 'healthy' },
  }), { status: 201, headers: { 'content-type': 'application/json' } });
}

describe('BeeEcom checkout client', () => {
  it('sends delivery and payment choices in the checkout body', async () => {
    const calls: Array<{ url: string; method: string; body: string | null }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({
        url: String(input),
        method: init?.method ?? 'GET',
        body: typeof init?.body === 'string' ? init.body : null,
      });
      return success({
        id: 'order-checkout',
        number: '#D-CHECKOUT',
        customerId: 'cust-ava',
        lines: [],
        subtotal: { amount: 3200, currency: 'USD' },
        discount: { amount: 0, currency: 'USD' },
        shipping: { amount: 1800, currency: 'USD' },
        tax: { amount: 256, currency: 'USD' },
        total: { amount: 5256, currency: 'USD' },
        state: 'placed',
        paymentState: 'paid',
        fulfillmentState: 'unfulfilled',
        shippingAddress: {},
        shippingMethod: 'express',
        paymentMethod: 'wallet',
        placedAt: '2026-09-11T00:00:00.000Z',
        updatedAt: '2026-09-11T00:00:00.000Z',
      });
    };
    const api = createBeeEcomClient({ baseUrl: 'https://demo.example/', fetchImpl });
    const input = {
      cartId: 'cart-ava',
      addressId: 'addr-ava-home',
      shippingMethod: 'express' as const,
      paymentMethod: 'wallet' as const,
    };

    await api.checkout(input);

    expect(calls).toEqual([{
      url: 'https://demo.example/api/v1/checkout',
      method: 'POST',
      body: JSON.stringify(input),
    }]);
  });
});
