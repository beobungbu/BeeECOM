import {
  BeeThemeScope,
  Box,
  Button,
  Card,
  getBeeToken,
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
  Screen,
  Text,
  useBeeToken,
} from '@beemvp/beeui-ui';
import * as React from 'react';

type ProbeProps = {
  id: string;
  label: string;
};

function TokenProbe({ id, label }: ProbeProps) {
  const background = useBeeToken('colors.background');
  const primary = useBeeToken('colors.primary');
  const radius = useBeeToken('radius.md');
  const motion = useBeeToken('motion.normal');
  const imperativeGlobalPrimary = getBeeToken('colors.primary');

  return (
    <Card testID={`${id}-probe`} className="gap-1 p-3">
      <Text variant="caption">{label}</Text>
      <Text testID={`${id}-background`} variant="body">background={background}</Text>
      <Text testID={`${id}-primary`} variant="body">primary={primary}</Text>
      <Text testID={`${id}-radius`} variant="body">radius={radius}</Text>
      <Text testID={`${id}-motion`} variant="body">motion={motion}</Text>
      <Text testID={`${id}-imperative-global-primary`} variant="body">
        imperative-global-primary={imperativeGlobalPrimary}
      </Text>
    </Card>
  );
}

function StatefulScopedContent({ appearance }: { appearance: 'light' | 'dark' }) {
  const [count, setCount] = React.useState(0);
  const [popoverOpen, setPopoverOpen] = React.useState(false);

  return (
    <BeeThemeScope brand="violet" appearance={appearance}>
      <Box testID="violet-scope" className="gap-3 rounded-xl border border-border bg-background p-4">
        <Text variant="title">Violet {appearance} scope</Text>
        <TokenProbe id="scoped" label="Scoped hook + imperative token reads" />

        <Box className="flex-row flex-wrap gap-2">
          <Button accessibilityLabel="Increment scoped state" onPress={() => setCount((value) => value + 1)}>
            Scoped count {count}
          </Button>
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger>Open scoped Popover</PopoverTrigger>
            <PopoverContent
              closeOnOutsidePress={false}
              outsidePressTestID="scoped-popover-outside"
              placement="bottom"
              align="start"
            >
              <PopoverTitle>Scoped portal</PopoverTitle>
              <PopoverDescription>
                This content is portaled by BeeUI but must retain the Violet scope on Web.
              </PopoverDescription>
              <TokenProbe id="portal" label="Token reads inside portaled content" />
              <PopoverClose variant="outline">Close scoped Popover</PopoverClose>
            </PopoverContent>
          </Popover>
        </Box>

        <BeeThemeScope brand="bee" appearance="dark">
          <Box testID="nested-bee-dark" className="rounded-lg border border-border bg-background p-3">
            <TokenProbe id="nested" label="Nested Bee dark scope" />
          </Box>
        </BeeThemeScope>
      </Box>
    </BeeThemeScope>
  );
}

export function ThemeScopeConformance() {
  const [appearance, setAppearance] = React.useState<'light' | 'dark'>('dark');

  return (
    <Screen>
      <Box className="mx-auto w-full max-w-4xl gap-5 p-4 md:p-8">
        <Card className="gap-3 p-5 md:p-6">
          <Text variant="title">BeeThemeScope consumer acceptance</Text>
          <Text variant="body">
            External-package validation for scoped brand/appearance selection, token reads and Web portal context preservation.
          </Text>
          <Button
            accessibilityLabel="Toggle Violet scoped appearance"
            variant="outline"
            onPress={() => setAppearance((value) => (value === 'dark' ? 'light' : 'dark'))}
          >
            Toggle Violet scope to {appearance === 'dark' ? 'light' : 'dark'}
          </Button>
        </Card>

        <Box className="grid gap-4 md:grid-cols-2">
          <Box testID="global-before" className="rounded-xl border border-border bg-background p-4">
            <TokenProbe id="global" label="Global theme" />
          </Box>
          <StatefulScopedContent appearance={appearance} />
        </Box>

        <Box testID="global-after" className="rounded-xl border border-border bg-background p-4">
          <TokenProbe id="sibling" label="Sibling outside scoped theme" />
        </Box>
      </Box>
    </Screen>
  );
}
