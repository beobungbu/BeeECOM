import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBeeEcomClient, toWebSocketUrl } from './index';

function success(data: unknown) {
  return new Response(JSON.stringify({
    ok: true,
    data,
    meta: { requestId: 'req-test', scenario: 'healthy' },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

class FakeWebSocket {
  readyState = 0;
  onopen: ((event: Event) => unknown) | null = null;
  onmessage: ((event: MessageEvent) => unknown) | null = null;
  onerror: ((event: Event) => unknown) | null = null;
  onclose: ((event: CloseEvent) => unknown) | null = null;

  open() {
    this.readyState = 1;
    this.onopen?.({ type: 'open' } as Event);
  }

  message(data: string) {
    this.onmessage?.({ data } as MessageEvent);
  }

  disconnect() {
    this.readyState = 3;
    this.onclose?.({ code: 1006, reason: 'test disconnect' } as CloseEvent);
  }

  close() {
    this.readyState = 3;
    this.onclose?.({ code: 1000, reason: 'closed' } as CloseEvent);
  }
}

afterEach(() => {
  vi.useRealTimers();
});

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

  it('uses exact persistent thread lifecycle routes', async () => {
    const calls: Array<{ url: string; method: string; body: string | null }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({
        url: String(input),
        method: init?.method ?? 'GET',
        body: typeof init?.body === 'string' ? init.body : null,
      });
      return success({
        id: 'thread-1',
        customerId: 'cust-ava',
        subject: 'Order help',
        status: 'open',
        unreadByCustomer: 0,
        unreadByAgent: 0,
        createdAt: '2026-09-09T00:00:00.000Z',
        updatedAt: '2026-09-09T00:00:00.000Z',
      });
    };
    const api = createBeeEcomClient({ baseUrl: 'https://demo.example', fetchImpl });

    await api.chat.createThread({ customerId: 'cust-ava', subject: 'Order help' });
    await api.chat.markRead('thread-1', { readerRole: 'support-agent' });

    expect(calls).toEqual([
      {
        url: 'https://demo.example/api/v1/chat/threads',
        method: 'POST',
        body: JSON.stringify({ customerId: 'cust-ava', subject: 'Order help' }),
      },
      {
        url: 'https://demo.example/api/v1/chat/threads/thread-1/read',
        method: 'PATCH',
        body: JSON.stringify({ readerRole: 'support-agent' }),
      },
    ]);
  });

  it('preserves API error code and request id', async () => {
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({
      ok: false,
      error: { code: 'COUPON_INVALID', message: 'Coupon could not be applied.' },
      meta: { requestId: 'req-404', scenario: 'healthy' },
    }), { status: 409, headers: { 'content-type': 'application/json' } });
    const api = createBeeEcomClient({ baseUrl: 'https://demo.example', fetchImpl });

    await expect(api.carts.applyCoupon('cart-ava', { code: 'NOPE' })).rejects.toMatchObject({
      name: 'BeeEcomApiError',
      code: 'COUPON_INVALID',
      requestId: 'req-404',
    });
  });
});

describe('BeeEcom realtime chat client', () => {
  it('converts HTTP API origins to WebSocket origins', () => {
    expect(toWebSocketUrl('http://127.0.0.1:8787', '/ws/chat/thread-1')).toBe('ws://127.0.0.1:8787/ws/chat/thread-1');
    expect(toWebSocketUrl('https://demo.example/', '/ws/chat/thread-1')).toBe('wss://demo.example/ws/chat/thread-1');
    expect(() => toWebSocketUrl('ftp://demo.example', '/ws/chat/thread-1')).toThrow('Unsupported API URL protocol');
  });

  it('delivers only valid matching persisted events and resyncs after reconnect', async () => {
    vi.useFakeTimers();
    const sockets: FakeWebSocket[] = [];
    const statuses: string[] = [];
    const messages: string[] = [];
    let resyncs = 0;

    const api = createBeeEcomClient({
      baseUrl: 'https://demo.example',
      webSocketFactory(url) {
        expect(url).toBe('wss://demo.example/ws/chat/thread-1');
        const socket = new FakeWebSocket();
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
    });

    const subscription = api.chat.subscribe('thread-1', {
      onStatus(status) {
        statuses.push(status);
      },
      onEvent(event) {
        messages.push(event.message.id);
      },
      onResync() {
        resyncs += 1;
      },
    });

    expect(sockets).toHaveLength(1);
    sockets[0]!.open();
    sockets[0]!.message(JSON.stringify({ type: 'unknown' }));
    sockets[0]!.message(JSON.stringify({
      type: 'message.persisted',
      threadId: 'other-thread',
      message: {
        id: 'msg-other',
        threadId: 'other-thread',
        senderId: 'agent-sam',
        senderRole: 'support-agent',
        body: 'Wrong room',
        sentAt: '2026-09-09T00:00:00.000Z',
      },
    }));
    sockets[0]!.message(JSON.stringify({
      type: 'message.persisted',
      threadId: 'thread-1',
      message: {
        id: 'msg-1',
        threadId: 'thread-1',
        senderId: 'agent-sam',
        senderRole: 'support-agent',
        body: 'Hello',
        sentAt: '2026-09-09T00:00:01.000Z',
      },
    }));

    expect(messages).toEqual(['msg-1']);
    expect(resyncs).toBe(0);

    sockets[0]!.disconnect();
    await vi.advanceTimersByTimeAsync(500);
    expect(sockets).toHaveLength(2);
    sockets[1]!.open();

    expect(resyncs).toBe(1);
    expect(statuses).toContain('connected');
    expect(statuses).toContain('reconnecting');

    subscription.close();
    expect(statuses.at(-1)).toBe('closed');
  });
});
