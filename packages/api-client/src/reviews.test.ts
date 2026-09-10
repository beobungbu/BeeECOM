import { describe, expect, it } from 'vitest';

import { createBeeEcomClient } from './index';

function success(data: unknown, status = 200) {
  return new Response(JSON.stringify({
    ok: true,
    data,
    meta: { requestId: 'req-review-test', scenario: 'healthy' },
  }), { status, headers: { 'content-type': 'application/json' } });
}

describe('BeeEcom review client', () => {
  it('encodes customer/product review filters and submits the exact review body', async () => {
    const calls: Array<{ url: string; method: string; body: string | null }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({
        url: String(input),
        method: init?.method ?? 'GET',
        body: typeof init?.body === 'string' ? init.body : null,
      });
      if ((init?.method ?? 'GET') === 'POST') {
        return success({
          id: 'review-new',
          productId: 'prod-field-pack',
          customerId: 'cust-ava',
          rating: 4,
          title: 'Perfect daily carry',
          body: 'Compact, comfortable, and easy to organize for a full day out.',
          status: 'pending',
          createdAt: '2026-09-10T00:00:00.000Z',
        }, 201);
      }
      return success([]);
    };
    const api = createBeeEcomClient({ baseUrl: 'https://demo.example/', fetchImpl });
    const input = {
      productId: 'prod-field-pack',
      customerId: 'cust-ava',
      rating: 4 as const,
      title: 'Perfect daily carry',
      body: 'Compact, comfortable, and easy to organize for a full day out.',
    };

    await api.reviews.list({ productId: input.productId, customerId: input.customerId });
    await api.reviews.create(input);

    expect(calls).toEqual([
      {
        url: 'https://demo.example/api/v1/reviews?productId=prod-field-pack&customerId=cust-ava',
        method: 'GET',
        body: null,
      },
      {
        url: 'https://demo.example/api/v1/reviews',
        method: 'POST',
        body: JSON.stringify(input),
      },
    ]);
  });
});
