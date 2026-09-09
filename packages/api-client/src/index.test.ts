import { describe, expect, it } from 'vitest';

import { BeeEcomApiError, createBeeEcomClient } from './index';

function success(data: unknown) {
  return new Response(JSON.stringify({
    ok: true,
    data,
    meta: { requestId: 'req-test', scenario: 'healthy' },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

describe('BeeEcom API client golden-commerce contracts', () => {
  it('sends cart mutation methods, paths and bodies exactly', async () => {
    const calls: Array<{ url: string; method: string; body: string | null }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({
        url: String(input),
        method: init?.method ?? 'GET',
        body: typeof init?.body === 'string' ? init.body : null,
      });
      return success({ id: 'cart-ava', customerId: 'cust-ava', lines: [], updatedAt: '2026-09-09T00:00:00.000Z' });
    };
    const api = createBeeEcomClient({ baseUrl: 'https://demo.example/', fetchImpl });

    await api.carts.addLine('cart-ava', { variantId: 'var-cloud-black-m', quantity: 2 });
    await api.carts.applyCoupon('cart-ava', { code: 'WELCOME10' });

    expect(calls).toEqual([
      {
        url: 'https://demo.example/api/v1/cart/cart-ava/lines',
        method: 'POST',
        body: JSON.stringify({ variantId: 'var-cloud-black-m', quantity: 2 }),
      },
      {
        url: 'https://demo.example/api/v1/cart/cart-ava/coupon',
        method: 'PATCH',
        body: JSON.stringify({ code: 'WELCOME10' }),
      },
    ]);
  });

  it('encodes order and support-inbox filters', async () => {
    const urls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      urls.push(String(input));
      return success({ items: [], page: 2, pageSize: 25, total: 0, hasNextPage: false });
    };
    const api = createBeeEcomClient({ baseUrl: 'https://demo.example', fetchImpl });

    await api.orders.list({ customerId: 'cust-ava', page: 2, pageSize: 25 });
    await api.chat.listThreads({ customerId: 'cust-ava', status: 'open', page: 2, pageSize: 25 });

    expect(urls).toEqual([
      'https://demo.example/api/v1/orders?customerId=cust-ava&page=2&pageSize=25',
      'https://demo.example/api/v1/chat/threads?customerId=cust-ava&status=open&page=2&pageSize=25',
    ]);
  });

  it('preserves API error code and request id', async () => {
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({
      ok: false,
      error: { code: 'COUPON_INVALID', message: 'Coupon could not be applied.' },
      meta: { requestId: 'req-404', scenario: 'healthy' },
    }), { status: 409, headers: { 'content-type': 'application/json' } });
    const api = createBeeEcomClient({ baseUrl: 'https://demo.example', fetchImpl });

    await expect(api.carts.applyCoupon('cart-ava', { code: 'NOPE' })).rejects.toMatchObject<BeeEcomApiError>({
      name: 'BeeEcomApiError',
      code: 'COUPON_INVALID',
      requestId: 'req-404',
    });
  });
});
