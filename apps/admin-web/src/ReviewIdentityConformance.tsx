import { createBeeEcomClient } from '@beeecom/api-client';
import type { Customer, Product, Review } from '@beeecom/domain';
import {
  Avatar,
  Badge,
  Box,
  Breadcrumb,
  BreadcrumbItem,
  Button,
  Card,
  Chip,
  ChipGroup,
  DescriptionItem,
  DescriptionList,
  Screen,
  Text,
  type ChipGroupValue,
} from '@beemvp/beeui-ui';
import * as React from 'react';

const api = createBeeEcomClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8787',
});

type ModerationDecision = 'published' | 'rejected';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function ReviewIdentityConformance() {
  const [review, setReview] = React.useState<Review | null>(null);
  const [customer, setCustomer] = React.useState<Customer | null>(null);
  const [product, setProduct] = React.useState<Product | null>(null);
  const [decision, setDecision] = React.useState<ModerationDecision>('published');
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const reviews = await api.admin.reviews.list();
        const nextReview = reviews[0];
        if (!nextReview) throw new Error('The current demo scenario has no review to moderate.');
        const [customers, nextProduct] = await Promise.all([
          api.admin.customers.list(),
          api.catalog.getProduct(nextReview.productId),
        ]);
        const nextCustomer = customers.find((item) => item.id === nextReview.customerId);
        if (!nextCustomer) throw new Error('The review customer is missing from canonical customer data.');
        if (!active) return;
        setReview(nextReview);
        setCustomer(nextCustomer);
        setProduct(nextProduct);
        setDecision(nextReview.status === 'rejected' ? 'rejected' : 'published');
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load review moderation state.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  function changeDecision(value: ChipGroupValue) {
    if (value === 'published' || value === 'rejected') setDecision(value);
  }

  async function saveModeration() {
    if (!review) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await api.admin.reviews.moderate(review.id, { status: decision });
      setReview(updated);
      setNotice('Review moderation persisted.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to persist review moderation.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Box className="mx-auto w-full max-w-4xl gap-5 p-4 md:p-8">
        <Card className="gap-3 p-5 md:p-6">
          <Breadcrumb>
            <BreadcrumbItem onPress={() => setNotice('Reviews index action invoked.')}>Reviews</BreadcrumbItem>
            <BreadcrumbItem current testID="review-breadcrumb-current">
              {review?.title ?? 'Review detail'}
            </BreadcrumbItem>
          </Breadcrumb>
          <Text variant="title">Review moderation acceptance</Text>
          <Text variant="body">
            BeeECOM owns review/customer/product state and moderation persistence; BeeUI owns identity, breadcrumb and choice semantics.
          </Text>
        </Card>

        {loading ? <Card className="p-5"><Text variant="body">Loading canonical review…</Text></Card> : null}
        {error ? <Card className="p-5"><Text variant="body">{error}</Text></Card> : null}

        {!loading && review && customer && product ? (
          <>
            <Card className="gap-4 p-5 md:p-6">
              <Box className="flex-row flex-wrap items-center gap-3">
                <Avatar fallback={initials(customer.displayName)} size="lg" testID="reviewer-avatar" />
                <Box className="min-w-0 flex-1 gap-1">
                  <Text variant="heading">{customer.displayName}</Text>
                  <Text variant="body">{customer.email}</Text>
                </Box>
                <Badge>{customer.tier}</Badge>
              </Box>

              <DescriptionList testID="review-canonical-details">
                <DescriptionItem label="Product" value={product.title} />
                <DescriptionItem label="Rating" value={`${review.rating} / 5`} />
                <DescriptionItem label="Current status" value={review.status} />
                <DescriptionItem label="Created" value={review.createdAt} />
              </DescriptionList>

              <Box className="gap-1">
                <Text variant="heading">{review.title}</Text>
                <Text variant="body">{review.body}</Text>
              </Box>
            </Card>

            <Card className="gap-4 p-5 md:p-6">
              <Box className="gap-1">
                <Text variant="title">Moderation decision</Text>
                <Text variant="body">Choose the persisted public state for this canonical review.</Text>
              </Box>
              <ChipGroup
                accessibilityLabel="Review moderation decision"
                onValueChange={changeDecision}
                selectionMode="single"
                value={decision}
              >
                <Chip value="published">Published</Chip>
                <Chip value="rejected">Rejected</Chip>
              </ChipGroup>
              <Button disabled={saving} onPress={() => void saveModeration()}>
                {saving ? 'Saving moderation…' : 'Save moderation'}
              </Button>
              {notice ? <Text testID="review-moderation-notice" variant="body">{notice}</Text> : null}
            </Card>
          </>
        ) : null}
      </Box>
    </Screen>
  );
}
