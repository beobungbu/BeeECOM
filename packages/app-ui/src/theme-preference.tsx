import { BeeUIProvider, Box, Button, Card, Text } from '@beemvp/beeui-ui';
import * as React from 'react';
import { Uniwind } from 'uniwind';

export const themePreferences = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof themePreferences)[number];

export function isThemePreference(value: string | null | undefined): value is ThemePreference {
  return themePreferences.some((preference) => preference === value);
}

/**
 * BeeECOM intentionally delegates global theme selection to the public runtime
 * path documented by BeeUI. Product-level persistence remains an app concern.
 */
export function applyThemePreference(preference: ThemePreference): void {
  Uniwind.setTheme(preference);
}

export interface ThemePreferenceControlProps {
  preference: ThemePreference;
  onPreferenceChange: (preference: ThemePreference) => void;
}

const labels: Record<ThemePreference, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

export function ThemePreferenceControl({
  preference,
  onPreferenceChange,
}: ThemePreferenceControlProps) {
  return (
    <BeeUIProvider>
      <Card className="m-3 gap-2 p-3">
        <Box className="gap-1">
          <Text variant="body">Theme preference: {labels[preference]}</Text>
          <Text variant="caption">System follows the OS/browser color scheme.</Text>
        </Box>
        <Box className="flex-row flex-wrap gap-2">
          {themePreferences.map((option) =>
            option === preference ? (
              <Button
                key={option}
                accessibilityLabel={`Use ${labels[option]} theme`}
                onPress={() => onPreferenceChange(option)}
              >
                {labels[option]}
              </Button>
            ) : (
              <Button
                key={option}
                accessibilityLabel={`Use ${labels[option]} theme`}
                variant="outline"
                onPress={() => onPreferenceChange(option)}
              >
                {labels[option]}
              </Button>
            ),
          )}
        </Box>
      </Card>
    </BeeUIProvider>
  );
}
