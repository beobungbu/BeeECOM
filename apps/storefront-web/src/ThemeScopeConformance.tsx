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

  return (
    <Card testID={`${id}-probe`} className="gap-1 p-3">
      <Text variant="caption">{label}</Text>
      <Text testID={`${id}-background`} variant="body">background={background}</Text>
      <Text testID={`${id}-primary`} variant="body">primary={primary}</Text>
      <Text testID={`${id}-radius`} variant="body">radius={radius}</Text>
    </Card>
  );
}

function SemanticStyleProbe({ id, label }: ProbeProps) {
  return (
    <Box className="gap-1">
      <Text variant="caption">{label}</Text>
      <Box
        testID={`${id}-style-primary`}
        className="h-8 w-full rounded-md border border-border bg-primary"
      />
    </Box>
  );
}

function ImperativeGlobalProbe() {
  const [primary, setPrimary] = React.useState<string | null>(null);

  return (
    <Card className="gap-2 p-3">
      <Text variant="caption">Imperative global-only token read</Text>
      <Text testID="scoped-imperative-global-primary" variant="body">
        imperative-global-primary={primary ?? 'unread'}
      </Text>
      <Button
        accessibilityLabel="Read imperative global primary"
        variant="outline"
        onPress={() => setPrimary(getBeeToken('colors.primary'))}
      >
        Read global token
      </Button>
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
        <SemanticStyleProbe id="scoped" label="Scoped semantic CSS primary" />
        <TokenProbe id="scoped" label="Scoped hook token reads (tracked by BeeUI #550)" />
        <ImperativeGlobalProbe />

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
              <SemanticStyleProbe id="portal" label="Portaled semantic CSS primary" />
              <TokenProbe id="portal" label="Portaled hook token reads (tracked by BeeUI #550)" />
              <PopoverClose variant="outline">Close scoped Popover</PopoverClose>
            </PopoverContent>
          </Popover>
        </Box>

        <BeeThemeScope brand="bee" appearance="dark">
          <Box testID="nested-bee-dark" className="gap-2 rounded-lg border border-border bg-background p-3">
            <SemanticStyleProbe id="nested" label="Nested Bee dark semantic CSS primary" />
            <TokenProbe id="nested" label="Nested hook token reads (tracked by BeeUI #550)" />
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
            External-package validation for scoped brand/appearance selection, semantic CSS and Web portal context preservation.
          </Text>
          <Text variant="caption">
            Motion token runtime coverage is quarantined under BeeUI #549. Scope-aware useBeeToken assertions are quarantined under BeeUI #550; semantic CSS scope/portal acceptance remains active.
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
          <Box testID="global-before" className="gap-2 rounded-xl border border-border bg-background p-4">
            <SemanticStyleProbe id="global" label="Global semantic CSS primary" />
            <TokenProbe id="global" label="Global hook token reads" />
          </Box>
          <StatefulScopedContent appearance={appearance} />
        </Box>

        <Box testID="global-after" className="gap-2 rounded-xl border border-border bg-background p-4">
          <SemanticStyleProbe id="sibling" label="Sibling semantic CSS primary" />
          <TokenProbe id="sibling" label="Sibling hook token reads" />
        </Box>
      </Box>
    </Screen>
  );
}
