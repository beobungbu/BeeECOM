import { createBeeEcomClient } from '@beeecom/api-client';
import type { Promotion, PromotionKind } from '@beeecom/domain';
import type { CalendarDate, ClockTime } from '@beemvp/beeui-core';
import {
  AppHeader,
  Badge,
  Box,
  Button,
  Card,
  DatePicker,
  DateTimePicker,
  Field,
  FormGroup,
  FormMessage,
  IconButton,
  Input,
  ListGroup,
  ListGroupHeader,
  ListItem,
  Radio,
  RadioGroup,
  Screen,
  Text,
  Textarea,
} from '@beemvp/beeui-ui';
import * as React from 'react';

const api = createBeeEcomClient({ baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8787' });

type DateTimeValue = { date: CalendarDate; time: ClockTime };
type CampaignStatus = 'Active' | 'Scheduled' | 'Expired' | 'Inactive';

function navigate(path: string) { window.location.assign(path); }
function utcDate(value: string): CalendarDate {
  const date = new Date(value);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}
function utcDateTime(value: string): DateTimeValue {
  const date = new Date(value);
  return { date: utcDate(value), time: { hour: date.getUTCHours(), minute: date.getUTCMinutes() } };
}
function toUtcIso(value: DateTimeValue): string {
  return new Date(Date.UTC(value.date.year, value.date.month - 1, value.date.day, value.time.hour, value.time.minute)).toISOString();
}
function expiryIso(value: CalendarDate): string {
  return new Date(Date.UTC(value.year, value.month - 1, value.day, 23, 59, 59)).toISOString();
}
function fromOffset(days: number, hour = 9): DateTimeValue {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hour, 0, 0, 0);
  return utcDateTime(date.toISOString());
}
function dateFromOffset(days: number): CalendarDate {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return utcDate(date.toISOString());
}
function campaignStatus(promotion: Promotion, now = Date.now()): CampaignStatus {
  if (!promotion.active) return 'Inactive';
  if (now < Date.parse(promotion.startsAt)) return 'Scheduled';
  if (now > Date.parse(promotion.endsAt)) return 'Expired';
  return 'Active';
}
function discountLabel(promotion: Pick<Promotion, 'kind' | 'value'>): string {
  return promotion.kind === 'percentage' ? `${promotion.value}% off` : `$${(promotion.value / 100).toFixed(2)} off`;
}
function dateLabel(value: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(value));
}

export function PromotionsCenter() {
  const [promotions, setPromotions] = React.useState<Promotion[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [code, setCode] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [kind, setKind] = React.useState<PromotionKind>('percentage');
  const [valueText, setValueText] = React.useState('20');
  const [launch, setLaunch] = React.useState<DateTimeValue>(() => fromOffset(7));
  const [expiry, setExpiry] = React.useState<CalendarDate>(() => dateFromOffset(37));
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [attempted, setAttempted] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const selected = selectedId ? promotions.find((item) => item.id === selectedId) ?? null : null;

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await api.promotions.list();
      setPromotions(next);
      setSelectedId((current) => current && next.some((item) => item.id === current) ? current : next[0]?.id ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load campaigns.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  React.useEffect(() => {
    if (!selected || creating) return;
    setCode(selected.code);
    setTitle(selected.title);
    setDescription(selected.description);
    setKind(selected.kind);
    setValueText(selected.kind === 'percentage' ? String(selected.value) : (selected.value / 100).toFixed(2));
    setLaunch(utcDateTime(selected.startsAt));
    setExpiry(utcDate(selected.endsAt));
    setAttempted(false);
    setError(null);
  }, [creating, selected]);

  function startCreate() {
    setCreating(true);
    setSelectedId(null);
    setCode('');
    setTitle('');
    setDescription('');
    setKind('percentage');
    setValueText('20');
    setLaunch(fromOffset(7));
    setExpiry(dateFromOffset(37));
    setAttempted(false);
    setNotice(null);
    setError(null);
  }

  function chooseCampaign(id: string) {
    setCreating(false);
    setSelectedId(id);
    setNotice(null);
  }

  function changeKind(next: string) {
    const nextKind = next as PromotionKind;
    setKind(nextKind);
    setValueText(nextKind === 'percentage' ? '20' : '15.00');
  }

  const numeric = Number(valueText);
  const storedValue = kind === 'percentage' ? numeric : Math.round(numeric * 100);
  const launchIso = toUtcIso(launch);
  const endIso = expiryIso(expiry);
  const codeInvalid = attempted && creating && !/^[A-Z0-9_-]{3,32}$/.test(code.trim().toUpperCase());
  const titleInvalid = attempted && !title.trim();
  const descriptionInvalid = attempted && !description.trim();
  const valueInvalid = attempted && (!Number.isFinite(numeric) || numeric <= 0 || (kind === 'percentage' && (!Number.isInteger(numeric) || numeric > 100)) || (kind === 'fixed' && storedValue <= 0));
  const windowInvalid = attempted && Date.parse(launchIso) >= Date.parse(endIso);
  const valid = !codeInvalid && !titleInvalid && !descriptionInvalid && !valueInvalid && !windowInvalid
    && (!creating || /^[A-Z0-9_-]{3,32}$/.test(code.trim().toUpperCase()))
    && Boolean(title.trim() && description.trim())
    && Number.isFinite(numeric) && numeric > 0
    && (kind !== 'percentage' || (Number.isInteger(numeric) && numeric <= 100))
    && Date.parse(launchIso) < Date.parse(endIso);

  async function save() {
    setAttempted(true);
    setNotice(null);
    setError(null);
    if (!valid) return;
    setBusy(true);
    try {
      if (creating) {
        const created = await api.admin.promotions.create({
          code: code.trim().toUpperCase(), title: title.trim(), description: description.trim(), kind,
          value: storedValue, active: false, startsAt: launchIso, endsAt: endIso,
        });
        setPromotions((current) => [created, ...current]);
        setSelectedId(created.id);
        setCreating(false);
        setNotice(`Campaign ${created.code} created as inactive.`);
      } else if (selected) {
        const updated = await api.admin.promotions.update(selected.id, {
          title: title.trim(), description: description.trim(), kind, value: storedValue,
          startsAt: launchIso, endsAt: endIso,
        });
        setPromotions((current) => current.map((item) => item.id === updated.id ? updated : item));
        setNotice(`Campaign ${updated.code} saved.`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save campaign.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive() {
    if (!selected) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const updated = await api.admin.promotions.update(selected.id, { active: !selected.active });
      setPromotions((current) => current.map((item) => item.id === updated.id ? updated : item));
      setNotice(updated.active ? `Campaign ${updated.code} activated.` : `Campaign ${updated.code} deactivated.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update campaign status.');
    } finally {
      setBusy(false);
    }
  }

  const statuses = promotions.reduce<Record<CampaignStatus, number>>((acc, item) => {
    acc[campaignStatus(item)] += 1;
    return acc;
  }, { Active: 0, Scheduled: 0, Expired: 0, Inactive: 0 });

  return (
    <Screen>
      <AppHeader
        title="Promotions"
        description="Create, schedule and manage discount campaigns across the storefront."
        leading={<IconButton accessibilityLabel="Back to operations" variant="ghost" onPress={() => navigate('/')}><Text aria-hidden variant="heading">‹</Text></IconButton>}
        trailing={<Button onPress={startCreate}>New campaign</Button>}
      />

      <Box className="mx-auto w-full max-w-6xl gap-6 p-4 md:p-8">
        <Box className="grid grid-cols-2 gap-3 md:grid-cols-4" testID="promotion-status-summary">
          {(['Active', 'Scheduled', 'Inactive', 'Expired'] as const).map((status) => (
            <Card key={status} className="gap-1 p-4"><Text variant="body">{status}</Text><Text variant="title">{statuses[status]}</Text></Card>
          ))}
        </Box>

        {notice ? <Card className="p-4" testID="promotion-notice"><Text variant="body">{notice}</Text></Card> : null}
        {error ? <Card className="gap-2 p-4" testID="promotion-error"><Text variant="heading">Campaign update failed</Text><FormMessage>{error}</FormMessage></Card> : null}
        {loading ? <Card className="p-6"><Text variant="body">Loading campaigns…</Text></Card> : null}

        {!loading ? (
          <Box className="grid grid-cols-1 gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
            <ListGroup accessibilityLabel="Promotion campaigns" testID="promotion-list">
              <ListGroupHeader title="Campaigns" description={`${promotions.length} campaign${promotions.length === 1 ? '' : 's'}`} />
              {promotions.map((promotion) => (
                <ListItem
                  key={promotion.id}
                  accessibilityLabel={`Edit campaign ${promotion.code}`}
                  title={promotion.code}
                  description={`${discountLabel(promotion)} · ${dateLabel(promotion.startsAt)} – ${dateLabel(promotion.endsAt)}`}
                  trailing={campaignStatus(promotion)}
                  onPress={() => chooseCampaign(promotion.id)}
                />
              ))}
            </ListGroup>

            {(creating || selected) ? (
              <Card className="gap-5 p-5 md:p-6" testID="promotion-editor">
                <Box className="flex-row flex-wrap items-start justify-between gap-3">
                  <Box className="min-w-0 flex-1 gap-1">
                    <Text variant="title">{creating ? 'New campaign' : selected?.title}</Text>
                    <Text variant="body">{creating ? 'Build the offer first, then activate it when it is ready.' : selected?.code}</Text>
                  </Box>
                  {!creating && selected ? <Badge>{campaignStatus(selected)}</Badge> : <Badge>Draft</Badge>}
                </Box>

                {creating ? (
                  <Field label="Campaign code" required invalid={codeInvalid} error="Use 3–32 letters, numbers, underscore or hyphen.">
                    <Input value={code} onChangeText={(value) => setCode(value.toUpperCase())} placeholder="SPRING20" maxLength={32} />
                  </Field>
                ) : null}
                <Field label="Campaign title" required invalid={titleInvalid} error="Campaign title is required.">
                  <Input value={title} onChangeText={setTitle} placeholder="Spring 20%" maxLength={120} />
                </Field>
                <Field label="Customer message" required invalid={descriptionInvalid} error="Customer message is required.">
                  <Textarea value={description} onChangeText={setDescription} placeholder="Save on selected products this spring." maxLength={500} />
                </Field>

                <FormGroup legend="Discount type" required>
                  <RadioGroup value={kind} onValueChange={changeKind} accessibilityLabel="Discount type">
                    <Radio value="percentage" label="Percentage off" />
                    <Radio value="fixed" label="Fixed amount off" />
                  </RadioGroup>
                </FormGroup>
                <Field
                  label={kind === 'percentage' ? 'Discount percentage' : 'Discount amount (USD)'}
                  required
                  invalid={valueInvalid}
                  error={kind === 'percentage' ? 'Enter a whole percentage from 1 to 100.' : 'Enter an amount greater than zero.'}
                >
                  <Input inputMode="decimal" value={valueText} onChangeText={setValueText} placeholder={kind === 'percentage' ? '20' : '15.00'} />
                </Field>

                <Box className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <Card className="gap-2 p-4">
                    <Text variant="heading">Launch</Text>
                    <DateTimePicker accessibilityLabel="Campaign launch date and time" hour12={false} locale="en-US" value={launch} onValueChange={(value) => value && setLaunch(value)} testID="promotion-launch" />
                  </Card>
                  <Card className="gap-2 p-4">
                    <Text variant="heading">Expiry</Text>
                    <DatePicker accessibilityLabel="Campaign expiry date" locale="en-US" min={launch.date} value={expiry} onValueChange={(value) => value && setExpiry(value)} testID="promotion-expiry" />
                  </Card>
                </Box>
                {windowInvalid ? <FormMessage>Expiry must be after campaign launch.</FormMessage> : null}

                <Box className="flex-row flex-wrap justify-end gap-2">
                  {!creating && selected ? (
                    <Button variant="outline" disabled={busy} onPress={() => void toggleActive()}>
                      {selected.active ? 'Deactivate campaign' : 'Activate campaign'}
                    </Button>
                  ) : null}
                  <Button disabled={busy} onPress={() => void save()}>{busy ? 'Saving…' : creating ? 'Create campaign' : 'Save campaign'}</Button>
                </Box>
              </Card>
            ) : (
              <Card className="p-6"><Text variant="body">Select a campaign or create a new one.</Text></Card>
            )}
          </Box>
        ) : null}
      </Box>
    </Screen>
  );
}
