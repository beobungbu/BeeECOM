import type { ApiResponse } from '@beeecom/contracts';
import type { ChatMessage } from '@beeecom/domain';

import { handleCatalogExtra } from './catalog-extra';
import { handleChatLifecycle } from './chat-lifecycle';
import coreWorker from './index';
import {
  ChatRoom,
  broadcastPersistedChatMessage,
  proxyChatWebSocket,
  type DurableObjectNamespaceLike,
} from './realtime';

export { ChatRoom };

type CoreEnv = Parameters<typeof coreWorker.fetch>[1];
interface RealtimeEnv extends CoreEnv {
  CHAT_ROOMS: DurableObjectNamespaceLike;
}

function chatThreadId(pathname: string): string | null {
  const match = pathname.replace(/\/$/, '').match(/^\/ws\/chat\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]!) : null;
}

function persistedMessageRoute(pathname: string): boolean {
  return /^\/api\/v1\/chat\/threads\/[^/]+\/messages\/?$/.test(pathname);
}

async function threadExists(request: Request, env: RealtimeEnv, threadId: string): Promise<boolean> {
  const url = new URL(request.url);
  url.pathname = `/api/v1/chat/threads/${encodeURIComponent(threadId)}`;
  url.search = '';
  const response = await coreWorker.fetch(new Request(url, { method: 'GET', headers: request.headers }), env);
  return response.ok;
}

async function broadcastIfPersisted(response: Response, env: RealtimeEnv): Promise<void> {
  if (!response.ok) return;
  const payload = await response.clone().json().catch(() => null) as ApiResponse<ChatMessage> | null;
  if (!payload?.ok) return;
  try {
    await broadcastPersistedChatMessage(env.CHAT_ROOMS, payload.data);
  } catch (error) {
    // D1 is canonical. A transient realtime failure must not turn a persisted
    // customer message into a failed HTTP mutation. Reconnect will resync D1.
    console.error('Realtime chat broadcast failed after persistence', {
      threadId: payload.data.threadId,
      messageId: payload.data.id,
      error,
    });
  }
}

export default {
  async fetch(request: Request, env: RealtimeEnv): Promise<Response> {
    const url = new URL(request.url);
    const threadId = chatThreadId(url.pathname);

    if (threadId) {
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
        return new Response(JSON.stringify({ ok: false, error: 'WEBSOCKET_UPGRADE_REQUIRED' }), {
          status: 426,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        });
      }
      if (!(await threadExists(request, env, threadId))) {
        return new Response(JSON.stringify({ ok: false, error: 'THREAD_NOT_FOUND' }), {
          status: 404,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        });
      }
      return proxyChatWebSocket(env.CHAT_ROOMS, threadId, request);
    }

    const catalogResponse = await handleCatalogExtra(request, env);
    if (catalogResponse) return catalogResponse;

    const lifecycleResponse = await handleChatLifecycle(request, env);
    if (lifecycleResponse) return lifecycleResponse;

    const response = await coreWorker.fetch(request, env);
    if (request.method === 'POST' && persistedMessageRoute(url.pathname)) {
      await broadcastIfPersisted(response, env);
    }
    return response;
  },
};
