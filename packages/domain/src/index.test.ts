import { describe, expect, it } from 'vitest';
import { calculateCartTotals, inventoryState, money, type Cart, type Promotion } from './index.js';

describe('domain rules', () => {
  it('derives inventory state from quantity', () => {
    expect(inventoryState(10)).toBe('in-stock');
    expect(inventoryState(5)).toBe('low-stock');
    expect(inventoryState(0)).toBe('out-of-stock');
  });

  it('calculates deterministic cart totals in minor units', () => {
    const cart: Cart = {
      id: 'cart-1',
      customerId: 'customer-1',
      lines: [
        { id: 'line-1', productId: 'p1', variantId: 'v1', quantity: 2, unitPrice: money(2500) },
      ],
      updatedAt: '2026-09-01T00:00:00.000Z',
    };
    const promotion: Promotion = {
      id: 'promo-1',
      code: 'SAVE10',
      title: 'Save 10%',
      description: 'Fixture promotion',
      kind: 'percentage',
      value: 10,
      active: true,
      startsAt: '2026-01-01T00:00:00.000Z',
      endsAt: '2026-12-31T23:59:59.000Z',
    };

    expect(calculateCartTotals(cart, promotion, 900, 0.08)).toEqual({
      subtotal: money(5000),
      discount: money(500),
      shipping: money(900),
      tax: money(360),
      total: money(5760),
    });
  });
});
