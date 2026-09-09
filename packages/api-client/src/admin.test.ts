import { describe, expect, it } from 'vitest';

import { createBeeEcomClient } from './index';

function success(data: unknown) {
  return new Response(JSON.stringify({
    ok: true,
    data,
    meta: { requestId: 'req-admin', scenario: 'healthy' },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

describe('BeeEcom Admin API contracts', () => {
  it('uses exact product, inventory and promotion mutation routes', async () => {
    const calls: Array<{ url: string; method: string; body: string | null }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? init.body : null });
      return success({});
    };
    const api = createBeeEcomClient({ baseUrl: 'https://demo.example', fetchImpl });

    await api.admin.products.update('prod-1', { title: 'Updated', featured: true });
    await api.admin.products.adjustInventory('prod-1', { variantId: 'var-1', adjustment: -2, reason: 'Cycle count' });
    await api.admin.promotions.update('promo-1', { active: false });

    expect(calls).toEqual([
      { url: 'https://demo.example/api/v1/admin/products/prod-1', method: 'PATCH', body: JSON.stringify({ title: 'Updated', featured: true }) },
      { url: 'https://demo.example/api/v1/admin/products/prod-1/inventory-adjustments', method: 'POST', body: JSON.stringify({ variantId: 'var-1', adjustment: -2, reason: 'Cycle count' }) },
      { url: 'https://demo.example/api/v1/admin/promotions/promo-1', method: 'PATCH', body: JSON.stringify({ active: false }) },
    ]);
  });

  it('uses exact order, return and review operation routes', async () => {
    const calls: Array<{ url: string; method: string; body: string | null }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? init.body : null });
      return success({});
    };
    const api = createBeeEcomClient({ baseUrl: 'https://demo.example/', fetchImpl });

    await api.admin.orders.transition('order-1', { action: 'ship' });
    await api.admin.returns.transition('return-1', { action: 'approve' });
    await api.admin.reviews.moderate('review-1', { status: 'published' });
    await api.admin.customers.list();
    await api.admin.returns.list();
    await api.admin.reviews.list();

    expect(calls).toEqual([
      { url: 'https://demo.example/api/v1/admin/orders/order-1', method: 'PATCH', body: JSON.stringify({ action: 'ship' }) },
      { url: 'https://demo.example/api/v1/admin/returns/return-1', method: 'PATCH', body: JSON.stringify({ action: 'approve' }) },
      { url: 'https://demo.example/api/v1/admin/reviews/review-1', method: 'PATCH', body: JSON.stringify({ status: 'published' }) },
      { url: 'https://demo.example/api/v1/admin/customers', method: 'GET', body: null },
      { url: 'https://demo.example/api/v1/admin/returns', method: 'GET', body: null },
      { url: 'https://demo.example/api/v1/admin/reviews', method: 'GET', body: null },
    ]);
  });
});
