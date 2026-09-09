import { Badge, Box, Button, Card, Text } from '@beemvp/beeui-ui';
import type { Money, Product } from '@beeecom/domain';
import * as React from 'react';
import { Image } from 'react-native';

export function formatMoney(value: Money): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: value.currency,
  }).format(value.amount / 100);
}

export interface ProductMediaProps {
  product: Product;
  aspectRatio?: number;
}

export function ProductMedia({ product, aspectRatio = 1 }: ProductMediaProps) {
  const firstImage = product.images[0];
  const [failed, setFailed] = React.useState(false);

  if (!firstImage || failed) {
    return (
      <Box
        accessibilityLabel={`${product.title} image unavailable`}
        className="items-center justify-center bg-muted p-6"
        style={{ width: '100%', aspectRatio }}
      >
        <Text variant="body">Image unavailable</Text>
      </Box>
    );
  }

  return (
    <Image
      accessibilityLabel={firstImage.alt}
      onError={() => setFailed(true)}
      resizeMode="cover"
      source={{ uri: firstImage.url }}
      style={{ width: '100%', aspectRatio }}
    />
  );
}

export interface ProductCardProps {
  product: Product;
  onPress?: ((product: Product) => void) | undefined;
}

export function ProductCard({ product, onPress }: ProductCardProps) {
  const firstVariant = product.variants[0];
  const available = product.variants.some((item) => item.inventoryQuantity > 0);
  const primaryTag = product.tags.find((tag) => ['sale', 'bestseller', 'new'].includes(tag));

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <ProductMedia product={product} aspectRatio={1.05} />
      <Box className="gap-3 p-4">
        <Box className="flex-row flex-wrap items-center gap-2">
          {primaryTag ? <Badge>{primaryTag}</Badge> : null}
          <Text variant="body">★ {product.rating.toFixed(1)} · {product.reviewCount}</Text>
        </Box>

        <Box className="gap-1">
          <Text variant="title">{product.title}</Text>
          {product.subtitle ? <Text variant="body">{product.subtitle}</Text> : null}
        </Box>

        <Box className="flex-row flex-wrap items-center gap-2">
          <Text variant="title">{firstVariant ? formatMoney(firstVariant.price) : 'Unavailable'}</Text>
          {firstVariant?.compareAtPrice ? (
            <Text className="line-through opacity-60" variant="body">{formatMoney(firstVariant.compareAtPrice)}</Text>
          ) : null}
          <Badge>{available ? 'In stock' : 'Out of stock'}</Badge>
        </Box>

        <Button accessibilityLabel={`View ${product.title}`} onPress={() => onPress?.(product)}>
          View product
        </Button>
      </Box>
    </Card>
  );
}

export interface ProductGridProps {
  products: Product[];
  onProductPress?: ((product: Product) => void) | undefined;
}

export function ProductGrid({ products, onProductPress }: ProductGridProps) {
  return (
    <Box className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} onPress={onProductPress} />
      ))}
    </Box>
  );
}
