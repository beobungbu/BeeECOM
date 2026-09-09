# BeeECOM support chat realtime architecture

## Invariants

1. D1 is the canonical history for threads and messages.
2. Message creation is an HTTP mutation with `clientMessageId` idempotency.
3. A persisted HTTP response is successful even if realtime fan-out fails afterward.
4. Durable Object `ChatRoom` instances coordinate connected WebSocket subscribers only.
5. WebSocket clients reconnect with bounded backoff and re-read D1 history after reconnect, so missed fan-out events cannot become permanent history gaps.
6. Web, iOS/Android and Admin consume the same `@beeecom/api-client` realtime subscription contract.

## Cloudflare model

`apps/api-worker/wrangler.jsonc` uses the current declarative Durable Object `exports` lifecycle and SQLite storage for the `ChatRoom` namespace. The Worker entry validates a thread through the persistent API before allowing a WebSocket upgrade.

## Send path

```text
Customer / Agent
  -> POST /api/v1/chat/threads/:threadId/messages
  -> D1 insert-or-ignore by (thread_id, client_message_id)
  -> D1 thread unread/update timestamp mutation
  -> HTTP success with canonical persisted message
  -> Worker entry broadcasts message.persisted to ChatRoom
  -> connected clients append if message id is new
```

If broadcast fails after persistence, the HTTP mutation remains successful. The next reconnect triggers history resync.

## Reconnect path

```text
socket closes
  -> shared API client enters reconnecting state
  -> bounded delay (0.5s, 1s, 2s, max 5s)
  -> reconnect to /ws/chat/:threadId
  -> on reconnect success call onResync
  -> GET canonical D1 message history
```

## Thread lifecycle

- `POST /api/v1/chat/threads` creates a persistent thread for a valid customer.
- `GET /api/v1/chat/threads` lists/filter threads.
- `GET /api/v1/chat/threads/:id` returns persistent detail.
- `PATCH /api/v1/chat/threads/:id/read` clears the unread counter for customer or support-agent.
- `GET/POST /api/v1/chat/threads/:id/messages` reads/writes canonical messages.

## Demo identity

The current deterministic fixtures use:

- customer: `cust-ava`
- support agent: `agent-sam`
- seeded thread: `thread-ava-1`

These are demo identities, not production IAM.
