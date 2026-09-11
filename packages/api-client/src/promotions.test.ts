import { describe, expect, it } from 'vitest';

import { createBeeEcomClient } from './index';

function success(data: unknown, status = 200) {
  return new Response(JSON.stringify({
    ok: true,
    data,
    meta: { requestId: 'req-promotion', scenario: 'healthy' },
  }), { status, headers: { 'content-type': 'application/json' } });
}

describe('BeeEcom admin promotions client', () => {
  it('sends create and full edit payloads to promotion endpoints', async () => {
    const calls: Array<{ url: string; method: string; body: string | null }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? init.body : null });
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
      return success({
        id: 'promo-spring', code: 'SPRING20', title: body.title ?? 'Spring', description: body.description ?? 'Spring offer',
        kind: body.kind ?? 'percentage', value: body.value ?? 20, active: body.active ?? false,
        startsAt: body.startsAt ?? '2035-03-01T09:00:00.000Z', endsAt: body.endsAt ?? '2035-03-31T23:59:59.000Z',
      }, init?.method === 'POST' ? 201 : 200);
    };
    const api = createBeeEcomClient({ baseUrl: 'https://demo.example/', fetchImpl });
    const create = {
      code: 'SPRING20', title: 'Spring 20%', description: 'Spring campaign', kind: 'percentage' as const,
      value: 20, startsAt: '2035-03-01T09:00:00.000Z', endsAt: '2035-03-31T23:59:59.000Z',
    };
    const update = { title: 'Spring launch', kind: 'fixed' as const, value: 1500, active: true };

    await api.admin.promotions.create(create);
    await api.admin.promotions.update('promo-spring', update);

    expect(calls).toEqual([
      { url: 'https://demo.example/api/v1/admin/promotions', method: 'POST', body: JSON.stringify(create) },
      { url: 'https://demo.example/api/v1/admin/promotions/promo-spring', method: 'PATCH', body: JSON.stringify(update) },
    ]);
  });
});
