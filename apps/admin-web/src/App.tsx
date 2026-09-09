import { createBeeEcomClient } from '@beeecom/api-client';
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

const api = createBeeEcomClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8787',
});

export function App() {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [promotions, setPromotions] = React.useState<Promotion[]>([]);
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [threads, setThreads] = React.useState<ChatThread[]>([]);
  const [threadId, setThreadId] = React.useState<string | undefined>();
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [agentDraft, setAgentDraft] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const loadMessages = React.useCallback(async (selectedThreadId: string) => {
    setMessages(await api.chat.listMessages(selectedThreadId));
  }, []);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [catalog, promoList, orderPage, threadPage] = await Promise.all([
        api.catalog.listProducts({ pageSize: 48, sort: 'featured' }),
        api.promotions.list(),
        api.orders.list({ pageSize: 100 }),
        api.chat.listThreads({ status: 'open', pageSize: 100 }),
      ]);
      setProducts(catalog.items);
      setPromotions(promoList);
      setOrders(orderPage.items);
      setThreads(threadPage.items);
      const nextThreadId = threadId ?? threadPage.items[0]?.id;
      setThreadId(nextThreadId);
      if (nextThreadId) await loadMessages(nextThreadId);
      else setMessages([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load admin data.');
    } finally {
      setLoading(false);
    }
  }, [loadMessages, threadId]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  async function changeThread(nextThreadId: string | undefined) {
    setThreadId(nextThreadId);
    if (!nextThreadId) {
      setMessages([]);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await loadMessages(nextThreadId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load support history.');
    } finally {
      setBusy(false);
    }
  }

  async function reply() {
    const body = agentDraft.trim();
    if (!threadId || !body) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api.chat.sendMessage(threadId, {
        threadId,
        senderId: 'agent-sam',
        senderRole: 'support-agent',
        body,
        clientMessageId: `web-agent-${Date.now()}`,
      });
      await loadMessages(threadId);
      setAgentDraft('');
      setNotice('Reply persisted. The customer storefront will see it after refresh.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to persist support reply.');
    } finally {
      setBusy(false);
    }
  }

  const lowStock = products.reduce(
    (count, product) => count + product.variants.filter((variant) => variant.inventoryState === 'low-stock').length,
    0,
  );
  const outOfStock = products.reduce(
    (count, product) => count + product.variants.filter((variant) => variant.inventoryState === 'out-of-stock').length,
    0,
  );
  const activePromotions = promotions.filter((promotion) => promotion.active).length;
  const paidOrders = orders.filter((order) => order.paymentState === 'paid').length;

  return (
    <BeeUIProvider>
      <Screen>
        <Box className="mx-auto w-full max-w-screen-2xl gap-6 p-4 md:p-8">
          <Box className="flex-row flex-wrap items-center justify-between gap-4">
            <Box className="gap-1">
              <Box className="flex-row flex-wrap items-center gap-3">
                <Text variant="title">BeeECOM Admin</Text>
                <Badge>Shared D1 state</Badge>
              </Box>
              <Text variant="body">Orders and support replies are the same records created by the customer storefront.</Text>
            </Box>
            <Button onPress={() => void refresh()}>Refresh server state</Button>
          </Box>

          {notice ? (
            <Card className="p-4">
              <Text variant="body">{notice}</Text>
            </Card>
          ) : null}

          <Box className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Card className="gap-1 p-5">
              <Text variant="body">Products</Text>
              <Text variant="title">{products.length}</Text>
            </Card>
            <Card className="gap-1 p-5">
              <Text variant="body">Low-stock variants</Text>
              <Text variant="title">{lowStock}</Text>
            </Card>
            <Card className="gap-1 p-5">
              <Text variant="body">Out-of-stock variants</Text>
              <Text variant="title">{outOfStock}</Text>
            </Card>
            <Card className="gap-1 p-5">
              <Text variant="body">Active promotions</Text>
              <Text variant="title">{activePromotions}</Text>
            </Card>
            <Card className="gap-1 p-5">
              <Text variant="body">Paid orders</Text>
              <Text variant="title">{paidOrders}</Text>
            </Card>
          </Box>

          {loading ? (
            <Card className="p-6">
              <Text variant="body">Loading operations state…</Text>
            </Card>
          ) : null}

          {error ? (
            <Card className="gap-3 p-6">
              <Text variant="title">Admin request failed</Text>
              <Text variant="body">{error}</Text>
              <Button onPress={() => void refresh()}>Try again</Button>
            </Card>
          ) : null}

          {!loading ? (
            <Card className="gap-4 p-4 md:p-6">
              <Box className="gap-1">
                <Text variant="title">Orders</Text>
                <Text variant="body">Checkout writes are visible here without duplicating mock state.</Text>
              </Box>
              <Table accessibilityLabel="Orders table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Fulfillment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>{order.number}</TableCell>
                      <TableCell>{order.customerId}</TableCell>
                      <TableCell>{formatMoney(order.total)}</TableCell>
                      <TableCell>{order.paymentState}</TableCell>
                      <TableCell>{order.fulfillmentState}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {orders.length === 0 ? <Text variant="body">No orders in the current scenario.</Text> : null}
            </Card>
          ) : null}

          {!loading ? (
            <Card className="gap-4 p-4 md:p-6">
              <Box className="gap-1">
                <Text variant="title">Support inbox</Text>
                <Text variant="body">History is read from D1; duplicate sends are guarded by `clientMessageId`.</Text>
              </Box>
              {threadId ? (
                <>
                  <Select value={threadId} onValueChange={(value) => void changeThread(value)}>
                    <SelectTrigger accessibilityLabel="Support thread">
                      <SelectValue placeholder="Choose a conversation" />
                    </SelectTrigger>
                    <SelectContent>
                      {threads.map((thread) => (
                        <SelectItem key={thread.id} value={thread.id}>
                          {thread.subject} · {thread.unreadByAgent} unread
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Box className="gap-2">
                    {messages.map((message) => (
                      <Box key={message.id} className="rounded-md border border-border p-3">
                        <Text variant="body">{message.senderRole === 'support-agent' ? 'Support' : 'Customer'}: {message.body}</Text>
                        <Text variant="body">{message.sentAt}</Text>
                      </Box>
                    ))}
                  </Box>

                  <Box className="flex-row flex-wrap gap-2">
                    <Box className="min-w-64 flex-1">
                      <Input
                        accessibilityLabel="Agent reply"
                        value={agentDraft}
                        onChangeText={setAgentDraft}
                        placeholder="Reply to customer"
                      />
                    </Box>
                    <Button disabled={busy || !agentDraft.trim()} onPress={() => void reply()}>Reply</Button>
                  </Box>
                </>
              ) : (
                <Text variant="body">No open support conversations.</Text>
              )}
            </Card>
          ) : null}

          {!loading ? (
            <Card className="gap-4 p-4 md:p-6">
              <Box className="gap-1">
                <Text variant="title">Catalog & inventory</Text>
                <Text variant="body">Dense table composition exercises BeeUI's caller-owned Table primitive.</Text>
              </Box>
              <Table accessibilityLabel="Product catalog inventory table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>State</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.flatMap((product) =>
                    product.variants.map((variant) => (
                      <TableRow key={variant.id}>
                        <TableCell>{product.title}</TableCell>
                        <TableCell>{variant.sku}</TableCell>
                        <TableCell>{formatMoney(variant.price)}</TableCell>
                        <TableCell>{variant.inventoryQuantity}</TableCell>
                        <TableCell>{variant.inventoryState}</TableCell>
                      </TableRow>
                    )),
                  )}
                </TableBody>
              </Table>
            </Card>
          ) : null}
        </Box>
      </Screen>
    </BeeUIProvider>
  );
}
