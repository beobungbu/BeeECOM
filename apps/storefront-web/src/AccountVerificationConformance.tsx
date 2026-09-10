import { createBeeEcomClient } from '@beeecom/api-client';
import type { Customer } from '@beeecom/domain';
import {
  Badge,
  Box,
  Card,
  OTPInput,
  PasswordInput,
  Screen,
  Text,
} from '@beemvp/beeui-ui';
import * as React from 'react';

const api = createBeeEcomClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8787',
});

const CUSTOMER_ID = 'cust-ava';

export function AccountVerificationConformance() {
  const [customer, setCustomer] = React.useState<Customer | null>(null);
  const [password, setPassword] = React.useState('bee-demo-pass');
  const [passwordVisible, setPasswordVisible] = React.useState(false);
  const [otp, setOtp] = React.useState('');
  const [completedOtp, setCompletedOtp] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    setError(null);
    void api.customers
      .get(CUSTOMER_ID)
      .then((next) => {
        if (active) setCustomer(next);
      })
      .catch((cause) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Unable to load your account.');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Screen>
      <Box className="mx-auto w-full max-w-4xl gap-6 p-4 md:p-8">
        <Box className="gap-2 px-1">
          <Text variant="body">Account security</Text>
          <Text variant="title">Verify it’s you</Text>
          <Text variant="body">
            Confirm your password and enter a 6-digit code before changing protected account or checkout details.
          </Text>
        </Box>

        {error ? (
          <Card className="gap-2 p-5 md:p-6">
            <Text variant="heading">We couldn’t load your account</Text>
            <Text variant="body">{error}</Text>
          </Card>
        ) : null}

        {!customer && !error ? (
          <Card className="p-5 md:p-6">
            <Text variant="body">Loading account security…</Text>
          </Card>
        ) : null}

        {customer ? (
          <>
            <Card className="gap-4 p-5 md:p-6">
              <Box className="flex-row flex-wrap items-center justify-between gap-3">
                <Box className="min-w-0 flex-1 gap-1" testID="verification-account-identity">
                  <Text variant="body">Signed in as</Text>
                  <Text variant="heading">{customer.displayName}</Text>
                  <Text variant="body">{customer.email}</Text>
                </Box>
                <Badge>{customer.tier === 'vip' ? 'VIP customer' : 'Customer'}</Badge>
              </Box>
            </Card>

            <Box className="gap-5 md:flex-row">
              <Card className="min-w-0 flex-1 gap-4 p-5 md:p-6">
                <Box className="gap-1">
                  <Text variant="heading">Confirm your password</Text>
                  <Text variant="body">
                    Sensitive account changes require your current password.
                  </Text>
                </Box>
                <PasswordInput
                  accessibilityLabel="Account password"
                  onChangeText={setPassword}
                  onVisibleChange={setPasswordVisible}
                  testID="verification-password"
                  value={password}
                  visible={passwordVisible}
                />
                <Text testID="password-visibility-state" variant="body">
                  {passwordVisible ? 'Password visible' : 'Password hidden'}
                </Text>
              </Card>

              <Card className="min-w-0 flex-1 gap-4 p-5 md:p-6">
                <Box className="gap-1">
                  <Text variant="heading">Enter verification code</Text>
                  <Text variant="body">
                    Enter the 6-digit code associated with this account to continue.
                  </Text>
                </Box>
                <OTPInput
                  accessibilityLabel="Six digit verification code"
                  length={6}
                  mode="numeric"
                  onComplete={setCompletedOtp}
                  onValueChange={(next) => {
                    setOtp(next);
                    if (next.length < 6) setCompletedOtp(null);
                  }}
                  testID="verification-otp"
                  value={otp}
                />
                <Text testID="otp-value-state" variant="body">
                  {otp.length} of 6 digits entered
                </Text>
              </Card>
            </Box>

            {completedOtp ? (
              <Card className="gap-2 p-5 md:p-6" testID="verification-complete">
                <Box className="flex-row flex-wrap items-center gap-2">
                  <Text variant="heading">Identity verified</Text>
                  <Badge>Verified</Badge>
                </Box>
                <Text variant="body">
                  {customer.displayName} can continue to protected account settings and checkout details.
                </Text>
              </Card>
            ) : null}
          </>
        ) : null}
      </Box>
    </Screen>
  );
}
