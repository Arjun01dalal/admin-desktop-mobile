/** Push campaign (topic notification) helpers — shared desktop + mobile. */

export type PushCampaignStatus = 'active' | 'paused' | 'completed' | 'cancelled';

export type PushCampaign = {
  _id: string;
  title: string;
  body: string;
  topic?: string;
  startAt: string;
  endAt: string;
  intervalValue?: number;
  intervalUnit?: 'hours' | 'days';
  status: PushCampaignStatus;
  nextSendAt?: string;
  lastSentAt?: string;
  sendCount?: number;
  lastError?: string;
  createdByName?: string;
  screen?: string;
  sendOnce?: boolean;
  imageUrl?: string;
};

export type PushCampaignForm = {
  title: string;
  body: string;
  startAt: string;
  endAt: string;
  sendOnce: boolean;
  repeat: boolean;
  intervalValue: string;
  intervalUnit: 'hours' | 'days';
};

export const emptyPushCampaignForm = (): PushCampaignForm => ({
  title: '',
  body: '',
  startAt: '',
  endAt: '',
  sendOnce: true,
  repeat: false,
  intervalValue: '1',
  intervalUnit: 'hours',
});

/** datetime-local value in Asia/Kolkata from an ISO timestamp. */
export function toIstInputValue(iso?: string): string {
  if (!iso) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/** ISO from a datetime-local value interpreted as IST (+05:30). */
export function fromIstInputValue(local: string): string {
  if (!local) return '';
  return new Date(`${local}:00+05:30`).toISOString();
}

export function formatPushCampaignIst(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function pushCampaignIntervalLabel(item: Pick<PushCampaign, 'sendOnce' | 'intervalValue' | 'intervalUnit'>): string {
  if (item.sendOnce) return 'Send once';
  if (!item.intervalValue || !item.intervalUnit) return 'One-time';
  return `Every ${item.intervalValue} ${item.intervalUnit}`;
}

export function unpackUploadImagePath(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const obj = data as Record<string, unknown>;
  const payload =
    obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)
      ? (obj.payload as Record<string, unknown>)
      : obj;
  return String(payload.imagePath || obj.imagePath || '').trim();
}
