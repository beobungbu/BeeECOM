import { createBeeEcomClient } from '@beeecom/api-client';
import type { Customer } from '@beeecom/domain';
import {
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
    void api.customers.get(CUSTOMER_ID)
      .then((next) => {
        if (active) setCustomer(next);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load account identity.');
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Screen>
      <Box className="mx-auto w-full max-w-2xl gap-5 p-4 md:p-8">
        <Card className="gap-2 p-5 md:p-6">
          <Text variant="title">Account verification acceptance</Text>
          <Text variant="body">
            BeeECOM loads the account identity from Worker + D1; password visibility and one-time-code interaction validate BeeUI consumer behavior without introducing a production authentication backend.
          </Text>
        </Card>

        {error ? <Card className="p-5"><Text variant="body">{error}</Text></Card> : null}

        {customer ? (
          <Card className="gap-5 p-5 md:p-6">
            <Box className="gap-1" testID="verification-account-identity">
              <Text variant="heading">{customer.displayName}</Text>
              <Text variant="body">{customer.email}</Text>
            </Box>

            <Box className="gap-2">
              <Text variant="heading">Account password</Text>
              <PasswordInput
                accessibilityLabel="Account password"
                onChangeText={setPassword}
                onVisibleChange={setPasswordVisible}
                testID="verification-password"
                value={password}
                visible={passwordVisible}
              />
              <Text testID="password-visibility-state" variant="body">
                {passwordVisible ? 'Password visible' : 'Password masked'}
              </Text>
            </Box>

            <Box className="gap-2">
              <Text variant="heading">One-time code</Text>
              <OTPInput
                accessibilityLabel="Six digit verification code"
                length={6}
                mode="numeric"
                onComplete={setCompletedOtp}
                onValueChange={setOtp}
                testID="verification-otp"
                value={otp}
              />
              <Text testID="otp-value-state" variant="body">
                {otp.length} of 6 digits entered
              </Text>
            </Box>

            {completedOtp ? (
              <Text testID="verification-complete" variant="body">
                Verification code {completedOtp} accepted for {customer.displayName}.
              </Text>
            ) : null}
          </Card>
        ) : null}
      </Box>
    </Screen>
  );
}
