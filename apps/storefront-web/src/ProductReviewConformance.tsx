import { createBeeEcomClient } from '@beeecom/api-client';
import type { Customer, Order, Product, Review } from '@beeecom/domain';
import {
  AppHeader,
  Badge,
  Box,
  Button,
  Card,
  Field,
  FormGroup,
  FormMessage,
  HStack,
  IconButton,
  Input,
  Radio,
  RadioGroup,
  Screen,
  Text,
  Textarea,
  VStack,
} from '@beemvp/beeui-ui';
import * as React from 'react';

const api = createBeeEcomClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8787',
});

const CUSTOMER_ID = 'cust-ava';

type RatingValue = '1' | '2' | '3' | '4' | '5';
const ratingOptions: Array<{ value: RatingValue; label: string }> = [
  { value: '5', label: '5 stars' },
  { value: '4', label: '4 stars' },
  { value: '3', label: '3 stars' },
  { value: '2', label: '2 stars' },
  { value: '1', label: '1 star' },
];

function navigate(path: string) {
  window.location.assign(path);
}

function reviewContextFromLocation() {
  const params = new URLSearchParams(window.location.search);
  return {
    orderId: params.get('orderId')?.trim() ?? '',
    productId: params.get('productId')?.trim() ?? '',
  };
}

function reviewStatusLabel(status: Review['status']): string {
  if (status === 'published') return 'Published';
  if (status === 'rejected') return 'Needs attention';
  return 'Pending review';
}

export function ProductReviewConformance() {
  const [{ orderId, productId }] = React.useState(reviewContextFromLocation);
  const [customer, setCustomer] = React.useState<Customer | null>(null);
  const [order, setOrder] = React.useState<Order | null>(null);
  const [product, setProduct] = React.useState<Product | null>(null);
  const [review, setReview] = React.useState<Review | null>(null);
  const [rating, setRating] = React.useState<RatingValue>('5');
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [attempted, setAttempted] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    if (!orderId || !productId) {
      setError('Choose a delivered product from your order history to write a review.');
      setLoading(false);
      return;
    }
    try {
      const [nextCustomer, nextOrder, nextProduct, reviews] = await Promise.all([
        api.customers.get(CUSTOMER_ID),
        api.orders.get(orderId),
        api.catalog.getProduct(productId),
        api.reviews.list({ productId, customerId: CUSTOMER_ID }),
      ]);
      setCustomer(nextCustomer);
      setOrder(nextOrder);
      setProduct(nextProduct);
      setReview(reviews[0] ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load your review details.');
    } finally {
      setLoading(false);
    }
  }, [orderId, productId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const eligible = Boolean(
    customer
      && order
      && product
      && order.customerId === customer.id
      && order.paymentState === 'paid'
      && order.fulfillmentState === 'delivered'
      && order.lines.some((line) => line.productId === product.id),
  );
  const titleInvalid = attempted && (title.trim().length < 3 || title.trim().length > 120);
  const bodyInvalid = attempted && (body.trim().length < 10 || body.trim().length > 2000);

  async function submitReview() {
    setAttempted(true);
    setError(null);
    if (!customer || !product || !eligible || titleInvalid || bodyInvalid || title.trim().length < 3 || body.trim().length < 10) return;

    setBusy(true);
    try {
      const created = await api.reviews.create({
        productId: product.id,
        customerId: customer.id,
        rating: Number(rating) as Review['rating'],
        title: title.trim(),
        body: body.trim(),
      });
      setReview(created);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to submit your review.');
    } finally {
      setBusy(false);
    }
  }

  const backPath = orderId ? `/conformance/orders/${encodeURIComponent(orderId)}` : '/conformance/orders';

  return (
    <Screen>
      <AppHeader
        title="Review your purchase"
        description="Share feedback to help other shoppers make a confident choice."
        leading={(
          <IconButton accessibilityLabel="Back to order" variant="ghost" onPress={() => navigate(backPath)}>
            <Text aria-hidden variant="heading">‹</Text>
          </IconButton>
        )}
      />

      <Box className="mx-auto w-full max-w-4xl gap-5 p-4 md:p-8">
        {loading ? (
          <Card className="p-6"><Text variant="body">Loading your purchase…</Text></Card>
        ) : null}

        {error ? (
          <Card className="gap-3 p-5 md:p-6">
            <Text variant="heading">We couldn’t complete that review action</Text>
            <FormMessage>{error}</FormMessage>
            <Box className="self-start"><Button variant="outline" onPress={() => void load()}>Try again</Button></Box>
          </Card>
        ) : null}

        {!loading && customer && order && product ? (
          <>
            <Card className="gap-4 p-5 md:p-6" testID="review-purchase-summary">
              <HStack align="start" justify="between" gap="lg" wrap>
                <VStack className="min-w-0 flex-1" gap="xs">
                  <Text variant="heading">{product.title}</Text>
                  {product.subtitle ? <Text variant="body">{product.subtitle}</Text> : null}
                  <Text variant="body">Order {order.number} · purchased by {customer.displayName}</Text>
                </VStack>
                {eligible ? <Badge>Verified delivery</Badge> : <Badge>Not eligible</Badge>}
              </HStack>
            </Card>

            {!eligible ? (
              <Card className="gap-2 p-5 md:p-6" testID="review-not-eligible">
                <Text variant="heading">This purchase can’t be reviewed yet</Text>
                <Text variant="body">Reviews become available after a paid order containing this product is delivered.</Text>
              </Card>
            ) : review ? (
              <Card className="gap-4 p-5 md:p-6" testID="submitted-review">
                <HStack align="center" justify="between" gap="lg" wrap>
                  <VStack className="min-w-0 flex-1" gap="xs">
                    <Text variant="heading">Thanks for sharing your feedback</Text>
                    <Text variant="body">Your review is saved and will appear after moderation.</Text>
                  </VStack>
                  <Badge>{reviewStatusLabel(review.status)}</Badge>
                </HStack>
                <Text testID="submitted-review-rating" variant="label">{review.rating} / 5 stars</Text>
                <VStack gap="xs">
                  <Text variant="heading">{review.title}</Text>
                  <Text variant="body">{review.body}</Text>
                </VStack>
                <Box className="self-start">
                  <Button variant="outline" onPress={() => navigate(backPath)}>Back to order</Button>
                </Box>
              </Card>
            ) : (
              <Card className="gap-5 p-5 md:p-6" testID="product-review-form">
                <VStack gap="xs">
                  <Text variant="heading">Write your review</Text>
                  <Text variant="body">Tell us what worked well and what other shoppers should know.</Text>
                </VStack>

                <FormGroup legend="Rating" description="Choose one to five stars." required>
                  <RadioGroup value={rating} onValueChange={(value) => setRating(value as RatingValue)}>
                    {ratingOptions.map((option) => (
                      <Radio key={option.value} value={option.value} label={option.label} />
                    ))}
                  </RadioGroup>
                </FormGroup>

                <Field
                  label="Review title"
                  description="Summarize your experience in a few words."
                  required
                  invalid={titleInvalid}
                  error="Review title must be between 3 and 120 characters."
                >
                  <Input value={title} onChangeText={setTitle} maxLength={120} placeholder="Great everyday bag" />
                </Field>

                <Field
                  label="Your review"
                  description="Share at least 10 characters."
                  required
                  invalid={bodyInvalid}
                  error="Review body must be between 10 and 2000 characters."
                >
                  <Textarea value={body} onChangeText={setBody} maxLength={2000} placeholder="What did you like about this product?" />
                </Field>

                <HStack justify="end" gap="sm" wrap>
                  <Button variant="outline" disabled={busy} onPress={() => navigate(backPath)}>Cancel</Button>
                  <Button disabled={busy} onPress={() => void submitReview()}>{busy ? 'Submitting…' : 'Submit review'}</Button>
                </HStack>
              </Card>
            )}
          </>
        ) : null}
      </Box>
    </Screen>
  );
}
