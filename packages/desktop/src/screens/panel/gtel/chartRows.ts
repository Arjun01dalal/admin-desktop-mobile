/** Shared metric parsers + chart row builder for Caller Dashboard. */

import type { GtelCallerDashRow } from '@astro/shared';

export type CallerDashChartRow = {
  name: string;
  fullName: string;
  empCode: string;
  answered: number;
  notAnswered: number;
  noWebhook: number;
  redials: number;
  total: number;
  campaignCalls: number;
  manualCalls: number;
  campaignActive: number;
  campaignInactive: number;
  validDisp: number;
  invalidDisp: number;
  notSetDisp: number;
  pendingCalls: number;
  allotTotal: number;
  allotTypes: Record<string, number>;
  exchPlayers: number;
  casinoPlayers: number;
  smPlayers: number;
  flagged: number;
  talkTime: string;
};

export function toMetricNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const n = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

export function metricNum(row: GtelCallerDashRow, keys: string[]): number {
  const wanted = new Set(keys.map((k) => k.toLowerCase().replace(/[^a-z0-9]/g, '')));
  for (const m of row.metrics) {
    const field = m.key.includes(':') ? m.key.split(':')[1] : m.key;
    const norm = field.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (wanted.has(norm)) return toMetricNumber(m.value);
  }
  return 0;
}

export function metricNumInGroup(
  row: GtelCallerDashRow,
  group: string,
  keys: string[],
): number {
  const g = group.toLowerCase().replace(/[^a-z0-9]/g, '');
  const wanted = new Set(keys.map((k) => k.toLowerCase().replace(/[^a-z0-9]/g, '')));
  for (const m of row.metrics) {
    if (!m.key.includes(':')) continue;
    const [grp, field] = m.key.split(':');
    if (grp.toLowerCase().replace(/[^a-z0-9]/g, '') !== g) continue;
    const norm = field.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (wanted.has(norm)) return toMetricNumber(m.value);
  }
  return 0;
}

export function metricText(row: GtelCallerDashRow, group: string, keys: string[]): string {
  const g = group.toLowerCase().replace(/[^a-z0-9]/g, '');
  const wanted = new Set(keys.map((k) => k.toLowerCase().replace(/[^a-z0-9]/g, '')));
  for (const m of row.metrics) {
    if (!m.key.includes(':')) continue;
    const [grp, field] = m.key.split(':');
    if (grp.toLowerCase().replace(/[^a-z0-9]/g, '') !== g) continue;
    const norm = field.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (wanted.has(norm)) return String(m.value || '—');
  }
  return '—';
}

function shortName(name: string): string {
  return name.length > 12 ? `${name.slice(0, 11)}…` : name;
}

export function buildCallerDashChartRows(rows: GtelCallerDashRow[]): CallerDashChartRow[] {
  return rows.map((row) => {
    const allotTypes: Record<string, number> = {};
    for (const m of row.metrics) {
      if (!m.key.startsWith('allotment:')) continue;
      const field = m.key.slice('allotment:'.length);
      if (!field || field === 'total' || field === 'allotted' || field === 'count') continue;
      allotTypes[field] = toMetricNumber(m.value);
    }
    const allotTotal =
      metricNumInGroup(row, 'allotment', ['total', 'allotted', 'count']) ||
      Object.values(allotTypes).reduce((s, n) => s + n, 0);

    const flagged =
      metricNumInGroup(row, 'personalConnectionCompliance', ['flagged', 'flaggedCount']) ||
      metricNumInGroup(row, 'connectionCompliance', ['flagged', 'flaggedCount']) ||
      metricNumInGroup(row, 'compliance', ['flagged', 'flaggedCount']) ||
      metricNum(row, ['flagged', 'flaggedCount']);

    return {
      name: shortName(row.name),
      fullName: row.empCode ? `${row.name} (${row.empCode})` : row.name,
      empCode: row.empCode || '',
      answered: toMetricNumber(row.answered) || metricNum(row, ['answered']),
      notAnswered: metricNum(row, ['notAnswered', 'not_answered', 'noAnswer']),
      noWebhook: metricNum(row, ['noWebhook', 'no_webhook']),
      redials: metricNum(row, ['redials', 'redial']),
      total: toMetricNumber(row.total) || metricNum(row, ['total', 'totalCalls']),
      campaignCalls:
        metricNumInGroup(row, 'callmode', ['campaign']) ||
        metricNum(row, ['campaign', 'campaignCalls']),
      manualCalls:
        metricNumInGroup(row, 'callmode', ['manual']) ||
        metricNum(row, ['manual', 'manualCalls']),
      campaignActive: metricNumInGroup(row, 'campaign', ['active']),
      campaignInactive: metricNumInGroup(row, 'campaign', ['inactive']),
      validDisp: metricNumInGroup(row, 'dispositions', ['valid', 'validDisposition']),
      invalidDisp: metricNumInGroup(row, 'dispositions', ['invalid', 'invalidDisposition']),
      notSetDisp: metricNumInGroup(row, 'dispositions', [
        'notSet',
        'dispositionNotSet',
        'notset',
      ]),
      pendingCalls: metricNum(row, [
        'pending',
        'pendingCalls',
        'pendingInCampaigns',
        'pendingincampaigns',
      ]),
      allotTotal,
      allotTypes,
      exchPlayers:
        metricNumInGroup(row, 'playercompositionbyvertical', ['e', 'exch', 'exchange']) ||
        metricNumInGroup(row, 'byvertical', ['e', 'exch']) ||
        metricNum(row, ['exchPlayers', 'exch', 'e']),
      casinoPlayers:
        metricNumInGroup(row, 'playercompositionbyvertical', ['c', 'casino']) ||
        metricNumInGroup(row, 'byvertical', ['c', 'casino']) ||
        metricNum(row, ['casinoPlayers', 'casino', 'c']),
      smPlayers:
        metricNumInGroup(row, 'playercompositionbyvertical', ['s', 'sm', 'satta']) ||
        metricNumInGroup(row, 'byvertical', ['s', 'sm']) ||
        metricNum(row, ['smPlayers', 'sm', 's']),
      flagged,
      talkTime: row.talkTime || '—',
    };
  });
}
