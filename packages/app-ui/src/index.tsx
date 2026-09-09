import { Box, Button, Card, Text } from '@beemvp/beeui-ui';
import type { Money, Product } from '@beeecom/domain';
import * as React from 'react';
import { Image } from 'react-native';

export function formatMoney(value: Money): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: value.currency,
  }).format(value.amount / 100);
}

export interface ProductCardProps {
  product: Product;
  onPress?: ((product: Product) => void) | undefined;
}

export function ProductCard({ product, onPress }: ProductCardProps) {
  const firstVariant = product.variants[0];
  const firstImage = product.images[0];
  const available = product.variants.some((item) => item.inventoryQuantity > 0);

  return (
    <Card className="gap-3 overflow-hidden p-0">
      {firstImage ? (
        <Image
          accessibilityLabel={firstImage.alt}
          resizeMode="cover"
          source={{ uri: firstImage.url }}
          style={{ width: '100%', aspectRatio: 1 }}
        />
      ) : null}
      <Box className="gap-2 p-4">
        <Text variant="title">{product.title}</Text>
        {product.subtitle ? <Text variant="body">{product.subtitle}</Text> : null}
        <Text variant="body">
          {firstVariant ? formatMoney(firstVariant.price) : 'Unavailable'} · {available ? 'In stock' : 'Out of stock'}
        </Text>
        <Text variant="body">★ {product.rating.toFixed(1)} · {product.reviewCount} reviews</Text>
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
