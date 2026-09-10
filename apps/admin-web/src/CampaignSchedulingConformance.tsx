import { createBeeEcomClient } from '@beeecom/api-client';
import type { Promotion } from '@beeecom/domain';
import type { CalendarDate, ClockTime } from '@beemvp/beeui-core';
import {
  Badge,
  Box,
  Button,
  Card,
  DatePicker,
  DateTimePicker,
  DescriptionItem,
  DescriptionList,
  Screen,
  Text,
} from '@beemvp/beeui-ui';
import * as React from 'react';

const api = createBeeEcomClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8787',
});

const CAMPAIGN_CODE = 'WELCOME10';

type DateTimeValue = {
  date: CalendarDate;
  time: ClockTime;
};

function utcDate(value: string): CalendarDate {
  const date = new Date(value);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function utcDateTime(value: string): DateTimeValue {
  const date = new Date(value);
  return {
    date: utcDate(value),
    time: {
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
    },
  };
}

function toUtcIso(value: DateTimeValue): string {
  return new Date(Date.UTC(
    value.date.year,
    value.date.month - 1,
    value.date.day,
    value.time.hour,
    value.time.minute,
    0,
    0,
  )).toISOString();
}

function expiryIso(value: CalendarDate): string {
  return new Date(Date.UTC(value.year, value.month - 1, value.day, 23, 59, 59, 0)).toISOString();
}

function labelDate(date: CalendarDate): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(date.year, date.month - 1, date.day)));
}

function labelLaunch(value: DateTimeValue): string {
  return `${labelDate(value.date)} at ${String(value.time.hour).padStart(2, '0')}:${String(value.time.minute).padStart(2, '0')} UTC`;
}

export function CampaignSchedulingConformance() {
  const [campaign, setCampaign] = React.useState<Promotion | null>(null);
  const [launch, setLaunch] = React.useState<DateTimeValue | null>(null);
  const [expiry, setExpiry] = React.useState<CalendarDate | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const campaigns = await api.promotions.list();
      const next = campaigns.find((item) => item.code === CAMPAIGN_CODE);
      if (!next) throw new Error('Campaign could not be found.');
      setCampaign(next);
      setLaunch(utcDateTime(next.startsAt));
      setExpiry(utcDate(next.endsAt));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load campaign schedule.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const launchIso = launch ? toUtcIso(launch) : null;
  const endIso = expiry ? expiryIso(expiry) : null;
  const validWindow = launchIso !== null && endIso !== null && Date.parse(launchIso) < Date.parse(endIso);
  const dirty = campaign !== null && validWindow
    && (launchIso !== campaign.startsAt || endIso !== campaign.endsAt);

  async function saveSchedule() {
    if (!campaign || !launchIso || !endIso || !validWindow) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await api.admin.promotions.update(campaign.id, {
        startsAt: launchIso,
        endsAt: endIso,
      });
      setCampaign(updated);
      setLaunch(utcDateTime(updated.startsAt));
      setExpiry(utcDate(updated.endsAt));
      setNotice('Campaign schedule saved.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save campaign schedule.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Box className="mx-auto w-full max-w-5xl gap-6 p-4 md:p-8">
        <Box className="gap-4 py-2 md:flex-row md:flex-wrap md:items-end md:justify-between md:py-4">
          <Box className="min-w-0 w-full gap-2 md:max-w-2xl md:flex-1">
            <Text variant="title">Campaign schedule</Text>
            <Text variant="body">
              Choose when the offer goes live and when customers can no longer redeem it.
            </Text>
          </Box>
          {campaign ? (
            <Box className="flex-row flex-wrap items-center gap-2">
              <Badge>{campaign.active ? 'Active' : 'Inactive'}</Badge>
              <Badge>{campaign.code}</Badge>
            </Box>
          ) : null}
        </Box>

        {loading ? (
          <Card className="p-6">
            <Text variant="body">Loading campaign…</Text>
          </Card>
        ) : null}

        {error ? (
          <Card className="gap-3 p-5 md:p-6">
            <Text variant="heading">Schedule unavailable</Text>
            <Text variant="body">{error}</Text>
            <Box className="self-start">
              <Button variant="outline" onPress={() => void load()}>Try again</Button>
            </Box>
          </Card>
        ) : null}

        {notice ? (
          <Card testID="campaign-schedule-notice" className="p-4">
            <Text variant="body">{notice}</Text>
          </Card>
        ) : null}

        {campaign && launch && expiry ? (
          <>
            <Card className="gap-5 p-5 md:p-6">
              <Box className="gap-1">
                <Text variant="heading">{campaign.title}</Text>
                <Text variant="body">{campaign.description}</Text>
              </Box>

              <Box className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <Card className="gap-3 p-4 md:p-5">
                  <Box className="gap-1">
                    <Text variant="heading">Launch</Text>
                    <Text variant="body">Set the exact time customers can begin using this offer.</Text>
                  </Box>
                  <DateTimePicker
                    accessibilityLabel="Campaign launch date and time"
                    hour12={false}
                    locale="en-US"
                    onValueChange={(value) => value && setLaunch(value)}
                    testID="campaign-launch"
                    value={launch}
                  />
                  <Text testID="campaign-launch-summary" variant="body">{labelLaunch(launch)}</Text>
                </Card>

                <Card className="gap-3 p-4 md:p-5">
                  <Box className="gap-1">
                    <Text variant="heading">Expiry</Text>
                    <Text variant="body">The offer remains available through the end of this day.</Text>
                  </Box>
                  <DatePicker
                    accessibilityLabel="Campaign expiry date"
                    locale="en-US"
                    min={launch.date}
                    onValueChange={(value) => value && setExpiry(value)}
                    testID="campaign-expiry"
                    value={expiry}
                  />
                  <Text testID="campaign-expiry-summary" variant="body">Through {labelDate(expiry)}</Text>
                </Card>
              </Box>

              {!validWindow ? (
                <Text testID="campaign-window-error" variant="body">
                  Expiry must be after the campaign launch time.
                </Text>
              ) : null}

              <Box className="flex-row flex-wrap justify-end gap-2">
                <Button variant="outline" disabled={saving || !dirty} onPress={() => {
                  setLaunch(utcDateTime(campaign.startsAt));
                  setExpiry(utcDate(campaign.endsAt));
                  setNotice(null);
                  setError(null);
                }}>
                  Reset changes
                </Button>
                <Button disabled={saving || !dirty || !validWindow} onPress={() => void saveSchedule()}>
                  {saving ? 'Saving…' : 'Save schedule'}
                </Button>
              </Box>
            </Card>

            <Card className="gap-3 p-5 md:p-6">
              <Text variant="heading">Schedule summary</Text>
              <DescriptionList testID="campaign-schedule-summary">
                <DescriptionItem label="Campaign" value={campaign.code} />
                <DescriptionItem label="Status" value={campaign.active ? 'Active' : 'Inactive'} />
                <DescriptionItem label="Starts" value={labelLaunch(launch)} />
                <DescriptionItem label="Ends" value={`${labelDate(expiry)} at 23:59 UTC`} />
              </DescriptionList>
            </Card>
          </>
        ) : null}
      </Box>
    </Screen>
  );
}
