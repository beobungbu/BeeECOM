import { describe, expect, it } from 'vitest';
import { createDemoDataset, datasetCounts } from './index.js';

describe('deterministic demo datasets', () => {
  it('recreates the same healthy dataset byte-for-byte', () => {
    expect(JSON.stringify(createDemoDataset('healthy'))).toBe(JSON.stringify(createDemoDataset('healthy')));
  });

  it('provides explicit edge scenarios', () => {
    const lowStock = createDemoDataset('low-stock');
    expect(lowStock.products.some((product) => product.variants.some((item) => item.inventoryState === 'low-stock'))).toBe(true);

    const empty = createDemoDataset('empty-catalog');
    expect(empty.products).toHaveLength(0);

    const large = createDemoDataset('large-catalog');
    expect(large.products).toHaveLength(80);
  });

  it('keeps chat history in the reconnect scenario', () => {
    const dataset = createDemoDataset('chat-reconnect');
    expect(dataset.chatMessages.map((message) => message.id)).toContain('msg-reconnect-1');
    expect(datasetCounts(dataset).chatMessages).toBe(2);
  });
});
