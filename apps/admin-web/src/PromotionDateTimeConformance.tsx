import { createBeeEcomClient } from '@beeecom/api-client';
import type { Promotion } from '@beeecom/domain';
import {
  Box,
  Button,
  Calendar,
  Card,
  DatePicker,
  DateTimePicker,
  DescriptionItem,
  DescriptionList,
  Screen,
  Text,
  type CalendarDate,
  type DateTimePickerValue,
} from '@beemvp/beeui-ui';
import * as React from 'react';

const api = createBeeEcomClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8787',
});

const PROMOTION_CODE = 'WELCOME10';

function parseCalendarDate(iso: string): CalendarDate {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) throw new Error(`Invalid promotion date: ${iso}`);
  return { year, month, day };
}

function parseDateTime(iso: string): DateTimePickerValue {
  const date = parseCalendarDate(iso);
  const [hour, minute] = iso.slice(11, 16).split(':').map(Number);
  if (hour === undefined || minute === undefined || Number.isNaN(hour) || Number.isNaN(minute)) {
    throw new Error(`Invalid promotion time: ${iso}`);
  }
  return { date, time: { hour, minute } };
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toIso(date: CalendarDate, hour = 0, minute = 0): string {
  return `${date.year}-${pad(date.month)}-${pad(date.day)}T${pad(hour)}:${pad(minute)}:00.000Z`;
}

export function PromotionDateTimeConformance() {
  const [promotion, setPromotion] = React.useState<Promotion | null>(null);
  const [startDate, setStartDate] = React.useState<CalendarDate | null>(null);
  const [endDateTime, setEndDateTime] = React.useState<DateTimePickerValue | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    void api.promotions.list()
      .then((items) => {
        const next = items.find((item) => item.code === PROMOTION_CODE);
        if (!next) throw new Error(`Promotion ${PROMOTION_CODE} is missing from the canonical scenario.`);
        if (!active) return;
        setPromotion(next);
        setStartDate(parseCalendarDate(next.startsAt));
        setEndDateTime(parseDateTime(next.endsAt));
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load promotion schedule.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function saveSchedule() {
    if (!promotion || !startDate || !endDateTime) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await api.admin.promotions.update(promotion.id, {
        startsAt: toIso(startDate),
        endsAt: toIso(endDateTime.date, endDateTime.time.hour, endDateTime.time.minute),
      });
      setPromotion(updated);
      setStartDate(parseCalendarDate(updated.startsAt));
      setEndDateTime(parseDateTime(updated.endsAt));
      setNotice('Promotion schedule persisted.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to persist promotion schedule.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Box className="mx-auto w-full max-w-5xl gap-5 p-4 md:p-8">
        <Card className="gap-2 p-5 md:p-6">
          <Text variant="title">Promotion date & time acceptance</Text>
          <Text variant="body">
            BeeECOM owns the persisted campaign schedule; BeeUI owns calendar and picker presentation/interaction contracts.
          </Text>
        </Card>

        {loading ? <Card className="p-5"><Text variant="body">Loading canonical promotion…</Text></Card> : null}
        {error ? <Card className="p-5"><Text variant="body">{error}</Text></Card> : null}

        {!loading && promotion && startDate && endDateTime ? (
          <>
            <Card className="gap-4 p-5 md:p-6">
              <Box className="gap-1">
                <Text variant="title">{promotion.title}</Text>
                <Text variant="body">Code {promotion.code}</Text>
              </Box>
              <DescriptionList testID="campaign-schedule-summary">
                <DescriptionItem label="Persisted start" value={promotion.startsAt} />
                <DescriptionItem label="Persisted end" value={promotion.endsAt} />
              </DescriptionList>
            </Card>

            <Card className="gap-4 p-5 md:p-6">
              <Box className="gap-1">
                <Text variant="title">Start date</Text>
                <Text variant="body">The standalone calendar and DatePicker control the same BeeECOM start-date state.</Text>
              </Box>
              <Calendar
                accessibilityLabel="Campaign start preview calendar"
                locale="en-US"
                onValueChange={setStartDate}
                testID="campaign-calendar"
                value={startDate}
              />
              <DatePicker
                accessibilityLabel="Campaign start date"
                locale="en-US"
                onValueChange={setStartDate}
                testID="campaign-start-picker"
                value={startDate}
              />
            </Card>

            <Card className="gap-4 p-5 md:p-6">
              <Box className="gap-1">
                <Text variant="title">End date & time</Text>
                <Text variant="body">The DateTimePicker keeps one controlled calendar-date and wall-clock-time value.</Text>
              </Box>
              <DateTimePicker
                accessibilityLabel="Campaign end date and time"
                hour12={false}
                locale="en-US"
                onValueChange={setEndDateTime}
                testID="campaign-end-picker"
                value={endDateTime}
              />
            </Card>

            <Button disabled={saving} onPress={() => void saveSchedule()}>
              {saving ? 'Saving schedule…' : 'Save campaign schedule'}
            </Button>
            {notice ? <Text testID="campaign-save-notice" variant="body">{notice}</Text> : null}
          </>
        ) : null}
      </Box>
    </Screen>
  );
}
