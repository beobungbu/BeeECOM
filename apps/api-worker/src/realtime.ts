import type { ChatRealtimeEvent } from '@beeecom/contracts';
import type { ChatMessage } from '@beeecom/domain';

export interface DurableObjectIdLike {}

export interface DurableObjectStubLike {
  fetch(request: Request): Promise<Response>;
}

export interface DurableObjectNamespaceLike {
  idFromName(name: string): DurableObjectIdLike;
  get(id: DurableObjectIdLike): DurableObjectStubLike;
}

export interface DurableObjectStateLike {
  acceptWebSocket(socket: WebSocket): void;
  getWebSockets(): WebSocket[];
}

interface WebSocketPairLike {
  0: WebSocket;
  1: WebSocket;
}

declare const WebSocketPair: {
  new (): WebSocketPairLike;
};

function upgradeResponse(client: WebSocket): Response {
  return new Response(null, {
    status: 101,
    webSocket: client,
  } as ResponseInit & { webSocket: WebSocket });
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export class ChatRoom {
  constructor(private readonly state: DurableObjectStateLike) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/broadcast') {
      const event = await request.json().catch(() => null) as ChatRealtimeEvent | null;
      if (!event || event.type !== 'message.persisted') {
        return json({ ok: false, error: 'INVALID_REALTIME_EVENT' }, 400);
      }

      const payload = JSON.stringify(event);
      let delivered = 0;
      for (const socket of this.state.getWebSockets()) {
        try {
          socket.send(payload);
          delivered += 1;
        } catch {
          // A stale socket will be cleaned up by the runtime close/error path.
        }
      }
      return json({ ok: true, delivered });
    }

    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return json({ ok: false, error: 'WEBSOCKET_UPGRADE_REQUIRED' }, 426);
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.state.acceptWebSocket(server);
    return upgradeResponse(client);
  }

  webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message === 'string' && message === 'ping') {
      socket.send(JSON.stringify({ type: 'pong' }));
    }
  }

  webSocketClose(socket: WebSocket, code: number, reason: string): void {
    try {
      socket.close(code, reason);
    } catch {
      // The runtime may already have closed the socket.
    }
  }

  webSocketError(socket: WebSocket): void {
    try {
      socket.close(1011, 'WebSocket error');
    } catch {
      // The runtime may already have closed the socket.
    }
  }
}

function stubFor(namespace: DurableObjectNamespaceLike, threadId: string): DurableObjectStubLike {
  return namespace.get(namespace.idFromName(threadId));
}

export async function proxyChatWebSocket(
  namespace: DurableObjectNamespaceLike,
  threadId: string,
  request: Request,
): Promise<Response> {
  return stubFor(namespace, threadId).fetch(request);
}

export async function broadcastPersistedChatMessage(
  namespace: DurableObjectNamespaceLike,
  message: ChatMessage,
): Promise<void> {
  const event: ChatRealtimeEvent = {
    type: 'message.persisted',
    threadId: message.threadId,
    message,
  };
  await stubFor(namespace, message.threadId).fetch(new Request('https://chat-room.internal/broadcast', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(event),
  }));
}
