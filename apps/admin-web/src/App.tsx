import { createBeeEcomClient, type ChatRealtimeStatus } from '@beeecom/api-client';
import { formatMoney } from '@beeecom/app-ui';
import type { ChatMessage, ChatThread, Order, Product, Promotion } from '@beeecom/domain';
import {
  Badge,
  BeeUIProvider,
  Box,
  Button,
  Card,
  Input,
  Screen,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@beemvp/beeui-ui';
import * as React from 'react';

import { OperationsPanels } from './OperationsPanels';

const api = createBeeEcomClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8787',
});

function appendMessage(messages: ChatMessage[], message: ChatMessage): ChatMessage[] {
  return messages.some((item) => item.id === message.id) ? messages : [...messages, message];
}

export function App() {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [promotions, setPromotions] = React.useState<Promotion[]>([]);
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [threads, setThreads] = React.useState<ChatThread[]>([]);
  const [threadId, setThreadId] = React.useState<string | undefined>();
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [chatStatus, setChatStatus] = React.useState<ChatRealtimeStatus>('closed');
  const [agentDraft, setAgentDraft] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const replaceThread = React.useCallback((updated: ChatThread) => {
    setThreads((current) => current.map((thread) => thread.id === updated.id ? updated : thread));
  }, []);

  const loadMessages = React.useCallback(async (selectedThreadId: string) => {
    const [history, readThread] = await Promise.all([
      api.chat.listMessages(selectedThreadId),
      api.chat.markRead(selectedThreadId, { readerRole: 'support-agent' }),
    ]);
    setMessages(history);
    replaceThread(readThread);
  }, [replaceThread]);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [catalog, promoList, orderPage, threadPage] = await Promise.all([
        api.catalog.listProducts({ pageSize: 100, sort: 'featured' }),
        api.promotions.list(),
        api.orders.list({ pageSize: 100 }),
        api.chat.listThreads({ status: 'open', pageSize: 100 }),
      ]);
      setProducts(catalog.items);
      setPromotions(promoList);
      setOrders(orderPage.items);
      setThreads(threadPage.items);
      const nextThreadId = threadId && threadPage.items.some((thread) => thread.id === threadId)
        ? threadId
        : threadPage.items[0]?.id;
      setThreadId(nextThreadId);
      if (nextThreadId) await loadMessages(nextThreadId);
      else setMessages([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load Admin state.');
    } finally {
      setLoading(false);
    }
  }, [loadMessages, threadId]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  React.useEffect(() => {
    if (!threadId) {
      setChatStatus('closed');
      return undefined;
    }
    const activeThreadId = threadId;
    const subscription = api.chat.subscribe(activeThreadId, {
      onEvent(event) {
        setMessages((current) => appendMessage(current, event.message));
        if (event.message.senderRole === 'customer') {
          void api.chat.markRead(activeThreadId, { readerRole: 'support-agent' })
            .then(replaceThread)
            .catch((cause) => console.warn('Unable to persist support-agent read state', cause));
        }
      },
      onStatus: setChatStatus,
      onResync: () => loadMessages(activeThreadId),
      onError(cause) { console.warn('Support inbox realtime transport error', cause); },
    });
    return () => subscription.close();
  }, [loadMessages, replaceThread, threadId]);

  const showNotice = React.useCallback((message: string) => {
    setError(null);
    setNotice(message);
  }, []);
  const showError = React.useCallback((message: string) => setError(message), []);

  async function changeThread(nextThreadId: string | undefined) {
    setThreadId(nextThreadId);
    if (!nextThreadId) { setMessages([]); return; }
    setBusy(true);
    setError(null);
    try { await loadMessages(nextThreadId); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load support history.'); }
    finally { setBusy(false); }
  }

  async function reply() {
    const body = agentDraft.trim();
    if (!threadId || !body) return;
    setBusy(true);
    setError(null);
    try {
      const message = await api.chat.sendMessage(threadId, {
        threadId,
        senderId: 'agent-sam',
        senderRole: 'support-agent',
        body,
        clientMessageId: `web-agent-${Date.now()}`,
      });
      setMessages((current) => appendMessage(current, message));
      setAgentDraft('');
      setNotice('Reply persisted to D1 and published to connected customer clients.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to persist support reply.');
    } finally { setBusy(false); }
  }

  const lowStock = products.flatMap((product) => product.variants).filter((variant) => variant.inventoryState === 'low-stock').length;
  const outOfStock = products.flatMap((product) => product.variants).filter((variant) => variant.inventoryState === 'out-of-stock').length;
  const activePromotions = promotions.filter((promotion) => promotion.active).length;
  const exceptionOrders = orders.filter((order) => order.paymentState === 'failed' || order.fulfillmentState === 'cancelled').length;
  const selectedThread = threadId ? threads.find((thread) => thread.id === threadId) : undefined;
  const customerOrders = selectedThread ? orders.filter((order) => order.customerId === selectedThread.customerId) : [];

  return (
    <BeeUIProvider>
      <Screen>
        <Box className="mx-auto w-full max-w-screen-2xl gap-6 p-4 md:p-8">
          <Box className="flex-row flex-wrap items-center justify-between gap-4">
            <Box className="gap-1">
              <Box className="flex-row flex-wrap items-center gap-3">
                <Text variant="title">BeeECOM Admin</Text>
                <Badge>Shared D1 operations</Badge>
              </Box>
              <Text variant="body">Persisted catalog, inventory, promotions, orders, customers, returns, reviews and support operations.</Text>
            </Box>
            <Button onPress={() => void refresh()}>Refresh canonical state</Button>
          </Box>

          {notice ? <Card className="p-4"><Text variant="body">{notice}</Text></Card> : null}
          {error ? (
            <Card className="gap-3 p-5">
              <Text variant="title">Operation failed</Text><Text variant="body">{error}</Text>
              <Button onPress={() => void refresh()}>Reload state</Button>
            </Card>
          ) : null}

          <Box className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Card className="gap-1 p-5"><Text variant="body">Products</Text><Text variant="title">{products.length}</Text></Card>
            <Card className="gap-1 p-5"><Text variant="body">Low stock</Text><Text variant="title">{lowStock}</Text></Card>
            <Card className="gap-1 p-5"><Text variant="body">Out of stock</Text><Text variant="title">{outOfStock}</Text></Card>
            <Card className="gap-1 p-5"><Text variant="body">Active campaigns</Text><Text variant="title">{activePromotions}</Text></Card>
            <Card className="gap-1 p-5"><Text variant="body">Order exceptions</Text><Text variant="title">{exceptionOrders}</Text></Card>
          </Box>

          {loading ? <Card className="p-6"><Text variant="body">Loading operations state…</Text></Card> : null}

          {!loading ? (
            <OperationsPanels
              api={api}
              products={products}
              promotions={promotions}
              orders={orders}
              onCanonicalRefresh={refresh}
              onNotice={showNotice}
              onError={showError}
            />
          ) : null}

          {!loading ? (
            <Card className="gap-4 p-4 md:p-6">
              <Box className="gap-1"><Text variant="title">Dense inventory view</Text><Text variant="body">The narrow-width strategy keeps the operations table within an explicit scrollable page composition.</Text></Box>
              <Table accessibilityLabel="Product catalog inventory table">
                <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>SKU</TableHead><TableHead>Price</TableHead><TableHead>Stock</TableHead><TableHead>State</TableHead></TableRow></TableHeader>
                <TableBody>{products.flatMap((product) => product.variants.map((variant) => (
                  <TableRow key={variant.id}><TableCell>{product.title}</TableCell><TableCell>{variant.sku}</TableCell><TableCell>{formatMoney(variant.price)}</TableCell><TableCell>{variant.inventoryQuantity}</TableCell><TableCell>{variant.inventoryState}</TableCell></TableRow>
                )))}</TableBody>
              </Table>
            </Card>
          ) : null}

          {!loading ? (
            <Card className="gap-4 p-4 md:p-6">
              <Box className="gap-1">
                <Box className="flex-row flex-wrap items-center gap-2"><Text variant="title">Support inbox</Text><Badge>{chatStatus}</Badge></Box>
                <Text variant="body">D1 history is canonical; Durable Objects fan out persisted messages and reconnect resyncs history.</Text>
              </Box>
              {threadId ? (
                <>
                  <Select value={threadId} onValueChange={(value) => void changeThread(value)}>
                    <SelectTrigger accessibilityLabel="Support thread"><SelectValue placeholder="Choose conversation" /></SelectTrigger>
                    <SelectContent>{threads.map((thread) => <SelectItem key={thread.id} value={thread.id}>{thread.subject} · {thread.unreadByAgent} unread</SelectItem>)}</SelectContent>
                  </Select>
                  {selectedThread ? (
                    <Box className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <Card className="p-4"><Text variant="body">Customer</Text><Text variant="body">{selectedThread.customerId}</Text></Card>
                      <Card className="p-4"><Text variant="body">Assigned</Text><Text variant="body">{selectedThread.assignedAgentId ?? 'Unassigned'}</Text></Card>
                      <Card className="p-4"><Text variant="body">Orders</Text><Text variant="body">{customerOrders.length}</Text></Card>
                    </Box>
                  ) : null}
                  <Box className="gap-2">{messages.map((message) => (
                    <Box key={message.id} className="rounded-md border border-border p-3"><Text variant="body">{message.senderRole === 'support-agent' ? 'Support' : 'Customer'}: {message.body}</Text><Text variant="body">{message.sentAt}</Text></Box>
                  ))}</Box>
                  <Box className="flex-row flex-wrap gap-2">
                    <Box className="min-w-64 flex-1"><Input accessibilityLabel="Agent reply" value={agentDraft} onChangeText={setAgentDraft} placeholder="Reply to customer" /></Box>
                    <Button disabled={busy || !agentDraft.trim()} onPress={() => void reply()}>Reply</Button>
                  </Box>
                </>
              ) : <Text variant="body">No open support conversations.</Text>}
            </Card>
          ) : null}
        </Box>
      </Screen>
    </BeeUIProvider>
  );
}
