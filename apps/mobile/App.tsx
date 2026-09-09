import './global.css';

import { createBeeEcomClient, type ChatRealtimeStatus } from '@beeecom/api-client';
import { ProductCard } from '@beeecom/app-ui';
import type { ChatMessage, Product } from '@beeecom/domain';
import { Badge, BeeUIProvider, Box, Button, Card, Input, SafeArea, Screen, Text } from '@beemvp/beeui-ui';
import * as React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, useWindowDimensions } from 'react-native';

const localApiBaseUrl = Platform.select({
  android: 'http://10.0.2.2:8787',
  default: 'http://127.0.0.1:8787',
});

const api = createBeeEcomClient({
  baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? localApiBaseUrl ?? 'http://127.0.0.1:8787',
});

const CUSTOMER_ID = 'cust-ava';
const THREAD_ID = 'thread-ava-1';

function appendMessage(messages: ChatMessage[], message: ChatMessage): ChatMessage[] {
  return messages.some((item) => item.id === message.id) ? messages : [...messages, message];
}

export default function App() {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [chatStatus, setChatStatus] = React.useState<ChatRealtimeStatus>('connecting');
  const [chatDraft, setChatDraft] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Product | null>(null);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const loadChatHistory = React.useCallback(async () => {
    setMessages(await api.chat.listMessages(THREAD_ID));
  }, []);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [page, history] = await Promise.all([
        api.catalog.listProducts({ sort: 'featured', pageSize: 12 }),
        api.chat.listMessages(THREAD_ID),
      ]);
      setProducts(page.items);
      setMessages(history);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load the mobile demo.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    const subscription = api.chat.subscribe(THREAD_ID, {
      onEvent(event) {
        setMessages((current) => appendMessage(current, event.message));
      },
      onStatus: setChatStatus,
      onResync: loadChatHistory,
      onError(cause) {
        console.warn('Native support realtime transport error', cause);
      },
    });
    return () => subscription.close();
  }, [loadChatHistory]);

  async function sendSupportMessage() {
    const body = chatDraft.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    try {
      const message = await api.chat.sendMessage(THREAD_ID, {
        threadId: THREAD_ID,
        senderId: CUSTOMER_ID,
        senderRole: 'customer',
        body,
        clientMessageId: `native-${Platform.OS}-${Date.now()}`,
      });
      setMessages((current) => appendMessage(current, message));
      setChatDraft('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to send support message.');
    } finally {
      setSending(false);
    }
  }

  return (
    <BeeUIProvider>
      <Screen>
        <SafeArea className="flex-1" edges={['top', 'left', 'right']}>
          <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                alignSelf: 'center',
                gap: 20,
                maxWidth: isTablet ? 760 : undefined,
                padding: 16,
                width: '100%',
              }}
            >
              <Box className="gap-2 py-4">
                <Text variant="title">BeeECOM Mobile</Text>
                <Text variant="body">
                  Native iOS/Android storefront consuming the same Worker API and BeeUI package as the Web showcase.
                </Text>
                <Text variant="body">Layout: {isTablet ? 'tablet' : 'phone'} · Platform: {Platform.OS}</Text>
                <Button onPress={() => void refresh()}>Refresh server state</Button>
              </Box>

              {loading ? (
                <Card className="gap-2 p-5">
                  <Text variant="title">Loading demo…</Text>
                  <Text variant="body">Reading deterministic catalog and persistent support history.</Text>
                </Card>
              ) : null}

              {error ? (
                <Card className="gap-3 p-5">
                  <Text variant="title">Request failed</Text>
                  <Text variant="body">{error}</Text>
                  <Button onPress={() => void refresh()}>Try again</Button>
                </Card>
              ) : null}

              {!loading && !error && products.length === 0 ? (
                <Card className="gap-2 p-5">
                  <Text variant="title">No products</Text>
                  <Text variant="body">The active dummy-data scenario intentionally has an empty catalog.</Text>
                </Card>
              ) : null}

              {!loading && !error
                ? products.map((product) => (
                    <ProductCard key={product.id} product={product} onPress={setSelected} />
                  ))
                : null}

              {selected ? (
                <Card className="gap-2 p-5">
                  <Text variant="title">Selected: {selected.title}</Text>
                  <Text variant="body">{selected.description}</Text>
                  <Button variant="outline" onPress={() => setSelected(null)}>Clear selection</Button>
                </Card>
              ) : null}

              <Card className="gap-4 p-5">
                <Box className="flex-row flex-wrap items-center gap-2">
                  <Text variant="title">Support conversation</Text>
                  <Badge>{chatStatus}</Badge>
                </Box>
                <Text variant="body">
                  History comes from D1; realtime delivery uses the same Durable Object room as Storefront Web and Admin.
                </Text>

                <Box className="gap-2">
                  {messages.map((message) => (
                    <Box key={message.id} className="gap-1 rounded-md border border-border p-3">
                      <Text variant="body">{message.senderRole === 'customer' ? 'You' : 'Support'}: {message.body}</Text>
                      <Text variant="body">{message.sentAt}</Text>
                    </Box>
                  ))}
                </Box>

                <Input
                  accessibilityLabel="Native support message"
                  value={chatDraft}
                  onChangeText={setChatDraft}
                  placeholder="Ask support about your order"
                />
                <Button disabled={sending || !chatDraft.trim()} onPress={() => void sendSupportMessage()}>
                  {sending ? 'Sending…' : 'Send message'}
                </Button>
              </Card>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeArea>
      </Screen>
    </BeeUIProvider>
  );
}
