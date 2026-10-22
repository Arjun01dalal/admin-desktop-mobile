/**
 * Gtel Caller Dashboard — normalize GET /dialer/caller-dashboard payload
 * for mobile/desktop list UIs (admin-panel-domains CallerDashboardPage).
 */

import { CALLER_HEAD_ROLE_IDS, CALLER_ROLE_IDS } from './callerRoles';

/** Matches admin CallerDashboardPage `statToneClass` buckets. */
export type GtelCallerDashTone =
  | 'ok'
  | 'bad'
  | 'warn'
  | 'time'
  | 'allot'
  | 'caller'
  | 'calls'
  | 'neutral';

export type GtelCallerDashCard = {
  key: string;
  label: string;
  value: string;
  tone: GtelCallerDashTone;
};

export type GtelCallerDashMetric = {
  key: string;
  label: string;
  value: string;
  tone: GtelCallerDashTone;
};

export type GtelCallerDashRow = {
  name: string;
  empCode: string;
  total: string;
  answered: string;
  talkTime: string;
  metrics: GtelCallerDashMetric[];
  /** disposition name → count (admin byDisposition modal). */
  byDisposition: Record<string, number>;
  campaignActive: string[];
  campaignInactive: string[];
  byAllotmentType: Record<string, number>;
  allottedCx: string[];
  allottedCxDetails: GtelAllottedCxDetail[];
};

/** Allotted CX row from caller dashboard (`dp_id` / `name` / `source` / `allotedAt`). */
export type GtelAllottedCxDetail = {
  dp_id?: string;
  name?: string;
  source?: string;
  allotedAt?: string;
  _id?: string;
  [key: string]: unknown;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const FIELD_LABELS: Record<string, string> = {
  total: 'Total',
  totals: 'Totals',
  callers: 'Callers',
  caller: 'Callers',
  totalcallers: 'Callers',
  callercount: 'Callers',
  allotted: 'Allotted',
  assigned: 'Assigned',
  answered: 'Answered',
  redials: 'Redials',
  redial: 'Redials',
  notanswered: 'Not Answered',
  not_answered: 'Not Answered',
  nowebhook: 'No Webhook',
  no_webhook: 'No Webhook',
  correct: 'Correct',
  incorrect: 'Incorrect',
  dispositioncorrect: 'Correct',
  dispositionincorrect: 'Incorrect',
  valid: 'Valid Disposition',
  invalid: 'Invalid Disposition',
  notset: 'Disposition Not Set',
  not_set: 'Disposition Not Set',
  validdispositions: 'Valid Disposition',
  invaliddispositions: 'Invalid Disposition',
  dispositionnotset: 'Disposition Not Set',
  dispositionsnotset: 'Disposition Not Set',
  active: 'Active Campaign',
  inactive: 'Inactive Campaign',
  cxactive: 'CX Active',
  activecx: 'CX Active',
  activated: 'Activated',
  talkseconds: 'Talk Time',
  talk_seconds: 'Talk Time',
  talktime: 'Talk Time',
  talk_time: 'Talk Time',
  pending: 'Pending Calls',
  pendingtotal: 'Pending Calls',
  pending_total: 'Pending Calls',
  pendingcalls: 'Pending Calls',
  pending_calls: 'Pending Calls',
  pendingincampaigns: 'Pending Calls',
  pending_in_campaigns: 'Pending Calls',
  pendingcampaign: 'Pending Calls',
  pendingcampaigns: 'Pending Calls',
  campaign: 'Campaign',
  manual: 'Manual',
  calls: 'Total Calls',
  call: 'Total Calls',
  allotment: 'CX Allotments',
  allotments: 'CX Allotments',
  allot: 'CX Allotments',
  e: 'Exch Players',
  c: 'Casino Players',
  s: 'SM Players',
  flagged: 'Flagged words',
  flaggedcount: 'Flagged words',
  playercompositionbyvertical: 'Player Composition By Vertical',
  compositionbyvertical: 'Player Composition By Vertical',
  verticalcomposition: 'Player Composition By Vertical',
  byvertical: 'Player Composition By Vertical',
  personalconnectioncompliance: 'Personal Connection Compliance',
  connectioncompliance: 'Personal Connection Compliance',
  compliance: 'Personal Connection Compliance',
};

/** Preferred Totals card order — matches admin CallerDashboardPage. */
const TOTALS_CARD_ORDER = [
  'callers',
  'caller',
  'totalcallers',
  'callercount',
  'calls',
  'call',
  'total',
  'totalcalls',
  'answered',
  'redials',
  'redial',
  'talkseconds',
  'talktime',
  'talk_time',
  'talk_seconds',
  'valid',
  'validdispositions',
  'invalid',
  'invaliddispositions',
  'notset',
  'not_set',
  'dispositionnotset',
  'dispositionsnotset',
  'pending',
  'pendingcalls',
  'pendingtotal',
  'pending_calls',
  'pending_total',
  'pendingincampaigns',
  'allotment',
  'allotments',
  'allot',
  'e',
  'c',
  's',
  'flagged',
  'flaggedcount',
];

/** Player composition vertical codes (admin CallerDashboardPage). */
const VERTICAL_FIELDS = ['E', 'C', 'S'] as const;

function isVerticalCompositionGroup(normGroup: string): boolean {
  return (
    normGroup === 'playercompositionbyvertical' ||
    normGroup === 'compositionbyvertical' ||
    normGroup === 'verticalcomposition' ||
    normGroup === 'byvertical'
  );
}

function isComplianceGroup(normGroup: string): boolean {
  return (
    normGroup === 'personalconnectioncompliance' ||
    normGroup === 'connectioncompliance' ||
    normGroup === 'compliance'
  );
}

function labelizeKey(key: string): string {
  const n = normalizeKey(key);
  if (FIELD_LABELS[n]) return FIELD_LABELS[n];
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function metricLabel(groupKey: string, fieldKey: string): string {
  const field = labelizeKey(fieldKey);
  const ng = normalizeKey(groupKey);
  const nf = normalizeKey(fieldKey);
  // Call mode counts (Campaign / Manual dial) — plain labels like web.
  if (ng === 'callmode' || ng === 'dialtype') return field;
  if (!ng || ng === 'calls' || ng === 'call') {
    if (nf === 'campaign' || nf === 'manual') return field;
    return field;
  }
  if (ng === 'campaign' || ng === 'campaigns') {
    if (nf === 'active') return 'Active Campaign';
    if (nf === 'inactive') return 'Inactive Campaign';
    return `Campaign · ${field}`;
  }
  if (ng === 'allotment' || ng === 'allotments' || ng === 'allot') {
    if (nf === 'total' || nf === 'allotted') return 'CX Allotment';
    return `CX Allotment · ${field}`;
  }
  if (ng === 'dispositions' || ng === 'disposition') return field;
  // Exch / Casino / Satta + Flagged — short labels (admin E/C/S + flagged).
  if (isVerticalCompositionGroup(ng)) return field;
  if (isComplianceGroup(ng)) return field;
  return `${labelizeKey(groupKey)} · ${field}`;
}

function pushMetric(
  metrics: GtelCallerDashMetric[],
  seen: Set<string>,
  groupKey: string,
  fieldKey: string,
  value: unknown,
) {
  if (value == null || value === '') return;
  if (typeof value === 'object') return;
  const id = `${normalizeKey(groupKey)}:${normalizeKey(fieldKey)}`;
  if (seen.has(id)) return;
  seen.add(id);
  const label = metricLabel(groupKey, fieldKey);
  metrics.push({
    key: id,
    label,
    value: formatMetric(fieldKey, value),
    tone: gtelCallerDashStatTone(fieldKey),
  });
}

function countOrValue(raw: unknown, labels: string[]): string | number | undefined {
  if (raw == null) return undefined;
  if (Array.isArray(raw)) return raw.length || labels.length || 0;
  if (typeof raw === 'number' || typeof raw === 'string') return raw;
  if (typeof raw === 'boolean') return raw ? 1 : 0;
  return labels.length || undefined;
}

function extractListLabels(value: unknown): string[] {
  return extractListRecords(value)
    .map((item) => {
      if (typeof item === 'string') return item;
      return String(
        item.name ||
          item.campaignName ||
          item.title ||
          item.label ||
          item.dp_id ||
          item._id ||
          '',
      ).trim();
    })
    .filter(Boolean);
}

function looksLikeAllottedCxArray(value: unknown): boolean {
  if (!Array.isArray(value) || !value.length) return false;
  return value.some(
    (item) =>
      isPlainObject(item) &&
      (item.dp_id != null ||
        item.dpId != null ||
        item.source != null ||
        item.allotedAt != null ||
        item.allottedAt != null),
  );
}

function extractListRecords(value: unknown): Array<string | GtelAllottedCxDetail> {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item == null) return null;
        if (typeof item === 'string' || typeof item === 'number') {
          const text = String(item).trim();
          return text || null;
        }
        if (isPlainObject(item)) {
          const dpId =
            item.dp_id != null
              ? String(item.dp_id)
              : item.dpId != null
                ? String(item.dpId)
                : item._id != null
                  ? String(item._id)
                  : undefined;
          const name = item.name != null ? String(item.name) : undefined;
          // Prefer allotted-CX shape (dp_id / source / allotedAt).
          if (
            item.dp_id != null ||
            item.dpId != null ||
            item.source != null ||
            item.allotedAt != null ||
            item.allottedAt != null
          ) {
            return {
              ...item,
              dp_id: dpId,
              _id: dpId,
              name,
              source: item.source != null ? String(item.source) : undefined,
              allotedAt:
                item.allotedAt != null
                  ? String(item.allotedAt)
                  : item.allottedAt != null
                    ? String(item.allottedAt)
                    : undefined,
            } satisfies GtelAllottedCxDetail;
          }
          return {
            ...item,
            dp_id: dpId,
            _id: dpId,
            name:
              name ||
              (item.campaignName != null ? String(item.campaignName) : undefined) ||
              (item.title != null ? String(item.title) : undefined) ||
              (item.label != null ? String(item.label) : undefined),
            source: item.source != null ? String(item.source) : undefined,
            allotedAt:
              item.allotedAt != null
                ? String(item.allotedAt)
                : item.allottedAt != null
                  ? String(item.allottedAt)
                  : undefined,
          } satisfies GtelAllottedCxDetail;
        }
        return null;
      })
      .filter((item): item is string | GtelAllottedCxDetail => item != null);
  }
  if (typeof value === 'string') {
    const text = value.trim();
    return text ? [text] : [];
  }
  return [];
}

function parseByDisposition(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (value == null) return out;

  if (Array.isArray(value)) {
    for (const item of value) {
      if (item == null) continue;
      if (typeof item === 'string') {
        out[item] = (out[item] || 0) + 1;
        continue;
      }
      if (!isPlainObject(item)) continue;
      const name = String(
        item.disposition || item.name || item.label || item.key || item.type || '',
      ).trim();
      if (!name) continue;
      const count = Number(item.count ?? item.total ?? item.value ?? item.qty ?? 1);
      out[name] = (out[name] || 0) + (Number.isFinite(count) ? count : 1);
    }
    return out;
  }

  if (isPlainObject(value)) {
    for (const [key, raw] of Object.entries(value)) {
      const name = String(key).trim();
      if (!name) continue;
      if (isPlainObject(raw) || Array.isArray(raw)) {
        const nestedCount = Number(
          (raw as { count?: unknown; total?: unknown; value?: unknown }).count ??
            (raw as { total?: unknown }).total ??
            (raw as { value?: unknown }).value,
        );
        if (Number.isFinite(nestedCount)) out[name] = nestedCount;
        continue;
      }
      const n = Number(raw);
      if (Number.isFinite(n)) out[name] = n;
    }
  }

  return out;
}

/** Preferred order for card preview — matches web group prominence. */
const METRIC_PRIORITY = [
  'playercompositionbyvertical:e',
  'playercompositionbyvertical:c',
  'playercompositionbyvertical:s',
  'personalconnectioncompliance:flagged',
  'allotment:total',
  'allotment:allotted',
  'allotment:pending',
  'campaign:active',
  'campaign:inactive',
  'callmode:campaign',
  'callmode:manual',
  'calls:campaign',
  'calls:manual',
  'dispositions:valid',
  'dispositions:invalid',
  'dispositions:notset',
  'dispositions:not_set',
  'calls:pending',
  'calls:pendingtotal',
  'calls:pendingcalls',
  'calls:pendingincampaigns',
  'calls:notanswered',
  'calls:nowebhook',
];

const CALL_MODE_FIELDS = new Set(['campaign', 'manual']);
const DISP_STATUS_FIELDS = new Set(['valid', 'invalid', 'notset', 'not_set']);

function sortMetrics(metrics: GtelCallerDashMetric[]): GtelCallerDashMetric[] {
  return [...metrics].sort((a, b) => {
    const ai = METRIC_PRIORITY.indexOf(a.key);
    const bi = METRIC_PRIORITY.indexOf(b.key);
    const aRank = ai >= 0 ? ai : METRIC_PRIORITY.length + 1;
    const bRank = bi >= 0 ? bi : METRIC_PRIORITY.length + 1;
    if (aRank !== bRank) return aRank - bRank;
    return a.label.localeCompare(b.label);
  });
}

function formatTalkTime(value: unknown): string {
  if (value == null || value === '' || value === '—') return '—';
  const total = Number(value);
  if (!Number.isFinite(total) || total < 0) return '—';
  const secs = Math.floor(total);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${h} Hr ${m} Min ${s} Sec`;
}

function isTalkTimeField(fieldKey: string): boolean {
  const n = normalizeKey(fieldKey);
  return (
    n === 'talkseconds' ||
    n === 'talktime' ||
    n === 'talktimeseconds' ||
    n === 'talkduration' ||
    n === 'talktimesec' ||
    n === 'talksecond' ||
    n === 'talktimes' ||
    (n.includes('talk') && n.includes('sec'))
  );
}

/** Admin-panel `statToneClass` parity for colored metric cards. */
export function gtelCallerDashStatTone(key: string): GtelCallerDashTone {
  const n = normalizeKey(key);
  if (n.includes('answered') && !n.includes('not') && !n.includes('unanswer')) {
    return 'ok';
  }
  if ((n.includes('valid') && !n.includes('invalid')) || n === 'active' || n === 'activated') {
    return 'ok';
  }
  if (n.includes('invalid') || n.includes('incorrect') || n === 'inactive') return 'bad';
  if (
    n.includes('pending') ||
    n.includes('notset') ||
    n.includes('notanswered') ||
    n.includes('nowebhook')
  ) {
    return 'warn';
  }
  if (isTalkTimeField(key) || n.includes('talktime')) return 'time';
  if (n.includes('allot')) return 'allot';
  if (n.includes('caller')) return 'caller';
  if (n.includes('flagged') || n.includes('compliance')) return 'warn';
  if (n === 'e' || n === 'exch' || n === 'exchange') return 'ok';
  if (n === 'c' || n === 'casino') return 'calls';
  if (n === 's' || n === 'satta' || n === 'sm' || n === 'sattamatka') return 'neutral';
  if (n.includes('redial')) return 'caller';
  if (n === 'campaign' || n === 'manual' || n === 'calls' || n.includes('total')) return 'calls';
  return 'neutral';
}

function formatMetric(fieldKey: string, value: unknown): string {
  if (isTalkTimeField(fieldKey)) return formatTalkTime(value);
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toLocaleString('en-IN') : '—';
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '—';
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const n = Number(trimmed);
      return Number.isFinite(n) ? n.toLocaleString('en-IN') : trimmed;
    }
    return trimmed;
  }
  return '—';
}

function pickFromCalls(
  calls: Record<string, unknown> | null,
  fieldNames: string[],
): unknown {
  if (!calls) return undefined;
  const wanted = new Set(fieldNames.map(normalizeKey));
  for (const [key, value] of Object.entries(calls)) {
    if (wanted.has(normalizeKey(key))) return value;
  }
  return undefined;
}

function isCallerRow(row: Record<string, unknown>): boolean {
  return (
    isPlainObject(row.subAdmin) ||
    isPlainObject(row.calls) ||
    isPlainObject(row.campaign) ||
    isPlainObject(row.campaigns) ||
    isPlainObject(row.dispositions) ||
    isPlainObject(row.playerCompositionByVertical) ||
    isPlainObject(row.personalConnectionCompliance) ||
    row.empCode != null ||
    row.name != null
  );
}

function mapCallerRow(row: Record<string, unknown>): GtelCallerDashRow {
  const subAdmin = isPlainObject(row.subAdmin) ? row.subAdmin : row;
  const name = String(
    subAdmin.name || subAdmin.Name || row.name || row.Name || '—',
  ).trim() || '—';
  const empCode = String(
    subAdmin.empCode ||
      subAdmin.EmpCode ||
      subAdmin.emp_code ||
      row.empCode ||
      row.EmpCode ||
      '',
  ).trim();

  const groupSources: Record<string, Record<string, unknown>> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === 'subAdmin' || key === '_id' || key === 'id') continue;
    if (isPlainObject(value)) groupSources[key] = value;
  }

  const collapseAliases = (canonical: string, aliases: string[]) => {
    const aliasNorms = new Set([canonical, ...aliases].map(normalizeKey));
    let source: Record<string, unknown> | null = null;
    for (const key of Object.keys(groupSources)) {
      if (!aliasNorms.has(normalizeKey(key))) continue;
      if (!source) source = groupSources[key];
      delete groupSources[key];
    }
    if (source) groupSources[canonical] = source;
  };
  collapseAliases('calls', ['call', 'Calls', 'Call']);
  collapseAliases('dispositions', ['disposition', 'Dispositions', 'Disposition']);
  collapseAliases('campaign', ['campaigns', 'Campaign', 'Campaigns']);
  collapseAliases('allotment', [
    'allotments',
    'Allotment',
    'Allotments',
    'allot',
    'allocation',
  ]);
  collapseAliases('playerCompositionByVertical', [
    'playercompositionbyvertical',
    'compositionByVertical',
    'compositionbyvertical',
    'verticalComposition',
    'verticalcomposition',
    'byVertical',
    'byvertical',
  ]);
  collapseAliases('personalConnectionCompliance', [
    'personalconnectioncompliance',
    'connectionCompliance',
    'connectioncompliance',
    'compliance',
  ]);

  const calls = groupSources.calls || null;

  const total = formatMetric('total', pickFromCalls(calls, ['total', 'calls', 'count']));
  const answered = formatMetric(
    'answered',
    pickFromCalls(calls, ['answered', 'answer', 'answeredCalls']),
  );
  const talkTime = formatMetric(
    'talkSeconds',
    pickFromCalls(calls, [
      'talkSeconds',
      'talk_seconds',
      'talkTime',
      'talk_time',
      'talktime',
    ]),
  );

  const metrics: GtelCallerDashMetric[] = [];
  const seen = new Set<string>();
  let byDisposition: Record<string, number> = {};
  let campaignActive: string[] = [];
  let campaignInactive: string[] = [];
  let byAllotmentType: Record<string, number> = {};
  let allottedCx: string[] = [];
  let allottedCxDetails: GtelAllottedCxDetail[] = [];
  const allotmentMetaKeys = new Set([
    'total',
    'count',
    'allotted',
    'allotment',
    'allotments',
    'sum',
  ]);
  const allotmentListKeys = new Set([
    'list',
    'cx',
    'cxs',
    'details',
    'detail',
    'customers',
    'customer',
    'allottedlist',
    'allotedlist',
    'allotedcustomer',
    'allottedcustomer',
    'allotedcustomers',
    'allottedcustomers',
    'allottedcx',
    'allotedcx',
    'names',
    'items',
    'players',
    'records',
  ]);
  const skipCallFields = new Set([
    'total',
    'calls',
    'count',
    'answered',
    'answer',
    'answeredcalls',
  ]);

  for (const [groupKey, groupObj] of Object.entries(groupSources)) {
    const normGroup = normalizeKey(groupKey);

    if (normGroup === 'campaign' || normGroup === 'campaigns') {
      const activeRaw =
        groupObj.active ?? groupObj.Active ?? groupObj.activeCampaigns ?? groupObj.activeList;
      const inactiveRaw =
        groupObj.inactive ??
        groupObj.Inactive ??
        groupObj.inactiveCampaigns ??
        groupObj.inactiveList;
      const activeLabels = extractListLabels(activeRaw);
      const inactiveLabels = extractListLabels(inactiveRaw);
      if (activeLabels.length) campaignActive = activeLabels;
      if (inactiveLabels.length) campaignInactive = inactiveLabels;
      const activeCount = countOrValue(activeRaw, activeLabels);
      const inactiveCount = countOrValue(inactiveRaw, inactiveLabels);
      if (activeCount != null) pushMetric(metrics, seen, 'campaign', 'active', activeCount);
      if (inactiveCount != null) pushMetric(metrics, seen, 'campaign', 'inactive', inactiveCount);

      for (const [field, fieldVal] of Object.entries(groupObj)) {
        const nf = normalizeKey(field);
        if (
          [
            'active',
            'inactive',
            'activecampaigns',
            'inactivecampaigns',
            'activelist',
            'inactivelist',
          ].includes(nf)
        ) {
          continue;
        }
        pushMetric(metrics, seen, 'campaign', field, fieldVal);
      }
      continue;
    }

    if (normGroup === 'allotment' || normGroup === 'allotments' || normGroup === 'allot') {
      let allotmentTotal = 0;
      const byTypeCandidates = [
        groupObj.byType,
        groupObj.by_type,
        groupObj.types,
        groupObj.byAllotmentType,
        groupObj.breakdown,
        groupObj.counts,
      ];
      const byTypeRaw = byTypeCandidates.find(
        (candidate) => candidate != null && !looksLikeAllottedCxArray(candidate),
      );
      if (byTypeRaw != null) {
        byAllotmentType = { ...byAllotmentType, ...parseByDisposition(byTypeRaw) };
      }

      const pushAllottedRecords = (fieldVal: unknown) => {
        const records = extractListRecords(fieldVal);
        if (!records.length) return;
        for (const rec of records) {
          if (typeof rec === 'string') {
            allottedCx.push(rec);
            allottedCxDetails.push({ _id: rec, name: rec });
          } else {
            allottedCxDetails.push(rec);
            const label = String(rec.name || rec.dp_id || rec._id || '').trim();
            if (label) allottedCx.push(label);
          }
        }
        if (!allotmentTotal) allotmentTotal = Math.max(allotmentTotal, records.length);
      };

      for (const [field, fieldVal] of Object.entries(groupObj)) {
        const nf = normalizeKey(field);
        // CX detail arrays (dp_id/name/source/allotedAt) — even under breakdown/counts.
        if (looksLikeAllottedCxArray(fieldVal)) {
          pushAllottedRecords(fieldVal);
          continue;
        }
        if (
          ['bytype', 'by_type', 'types', 'byallotmenttype', 'breakdown', 'counts'].includes(nf)
        ) {
          continue;
        }
        if (allotmentListKeys.has(nf) || Array.isArray(fieldVal)) {
          pushAllottedRecords(fieldVal);
          continue;
        }
        if (fieldVal == null || fieldVal === '' || typeof fieldVal === 'object') continue;
        const num = Number(fieldVal);
        if (!Number.isFinite(num)) {
          pushMetric(metrics, seen, 'allotment', field, fieldVal);
          continue;
        }
        if (allotmentMetaKeys.has(nf)) {
          pushMetric(metrics, seen, 'allotment', field, fieldVal);
          if (nf === 'total' || nf === 'allotted' || nf === 'count') {
            allotmentTotal = Math.max(allotmentTotal, num);
          }
          continue;
        }
        // Remaining numeric fields are allotment types (campaign, manual, …).
        byAllotmentType[field] = (byAllotmentType[field] || 0) + num;
        pushMetric(metrics, seen, 'allotment', field, fieldVal);
      }

      for (const [typeName, count] of Object.entries(byAllotmentType)) {
        pushMetric(metrics, seen, 'allotment', typeName, count);
      }

      if (!allotmentTotal) {
        allotmentTotal = Object.values(byAllotmentType).reduce((sum, n) => sum + n, 0);
      }
      if (allotmentTotal && !seen.has('allotment:total')) {
        pushMetric(metrics, seen, 'allotment', 'total', allotmentTotal);
      }
      continue;
    }

    if (normGroup === 'dispositions' || normGroup === 'disposition') {
      const byRaw =
        groupObj.byDisposition ??
        groupObj.by_disposition ??
        groupObj.byDispositions ??
        groupObj.bydisposition ??
        groupObj.breakdown ??
        groupObj.counts;
      byDisposition = { ...byDisposition, ...parseByDisposition(byRaw) };

      for (const [field, fieldVal] of Object.entries(groupObj)) {
        const nf = normalizeKey(field);
        if (
          ['bydisposition', 'by_disposition', 'bydispositions', 'breakdown', 'counts'].includes(nf)
        ) {
          continue;
        }
        pushMetric(metrics, seen, 'dispositions', field, fieldVal);
      }
      continue;
    }

    if (normGroup === 'calls' || normGroup === 'call') {
      for (const [field, fieldVal] of Object.entries(groupObj)) {
        const nf = normalizeKey(field);
        if (skipCallFields.has(nf) || isTalkTimeField(field)) continue;
        // Web splits Campaign / Manual into Call Mode group.
        if (CALL_MODE_FIELDS.has(nf)) {
          pushMetric(metrics, seen, 'callmode', field, fieldVal);
          continue;
        }
        // Web moves Valid / Invalid / Not Set under Dispositions.
        if (DISP_STATUS_FIELDS.has(nf)) {
          const outField = nf === 'not_set' || nf === 'notset' ? 'notSet' : field;
          pushMetric(metrics, seen, 'dispositions', outField, fieldVal);
          continue;
        }
        pushMetric(metrics, seen, 'calls', field, fieldVal);
      }
      continue;
    }

    if (normGroup === 'callmode' || normGroup === 'dialtype') {
      for (const [field, fieldVal] of Object.entries(groupObj)) {
        pushMetric(metrics, seen, 'callmode', field, fieldVal);
      }
      continue;
    }

    if (isVerticalCompositionGroup(normGroup)) {
      const canonical = 'playerCompositionByVertical';
      for (const vert of VERTICAL_FIELDS) {
        const raw =
          groupObj[vert] ?? groupObj[vert.toLowerCase()] ?? groupObj[vert.toUpperCase()];
        pushMetric(metrics, seen, canonical, vert, raw == null || raw === '' ? 0 : raw);
      }
      for (const [field, fieldVal] of Object.entries(groupObj)) {
        const nf = normalizeKey(field);
        if (nf === 'e' || nf === 'c' || nf === 's') continue;
        pushMetric(metrics, seen, canonical, field, fieldVal);
      }
      continue;
    }

    if (isComplianceGroup(normGroup)) {
      const canonical = 'personalConnectionCompliance';
      const flaggedRaw =
        groupObj.flagged ?? groupObj.Flagged ?? groupObj.flaggedCount ?? groupObj.count;
      pushMetric(
        metrics,
        seen,
        canonical,
        'flagged',
        flaggedRaw == null || flaggedRaw === '' ? 0 : flaggedRaw,
      );
      for (const [field, fieldVal] of Object.entries(groupObj)) {
        const nf = normalizeKey(field);
        if (nf === 'flagged' || nf === 'flaggedcount' || nf === 'count') continue;
        pushMetric(metrics, seen, canonical, field, fieldVal);
      }
      continue;
    }

    // Other groups (cx, …)
    for (const [field, fieldVal] of Object.entries(groupObj)) {
      const nf = normalizeKey(field);
      if (CALL_MODE_FIELDS.has(nf)) {
        pushMetric(metrics, seen, 'callmode', field, fieldVal);
        continue;
      }
      if (DISP_STATUS_FIELDS.has(nf)) {
        const outField = nf === 'not_set' || nf === 'notset' ? 'notSet' : field;
        pushMetric(metrics, seen, 'dispositions', outField, fieldVal);
        continue;
      }
      pushMetric(metrics, seen, groupKey, field, fieldVal);
    }
  }

  // Ensure disposition status keys exist when present under alternate names.
  {
    const disp = groupSources.dispositions;
    if (disp) {
      const aliases: Array<[string, string[]]> = [
        ['valid', ['valid', 'validDispositions', 'dispositionCorrect', 'correct']],
        ['invalid', ['invalid', 'invalidDispositions', 'dispositionIncorrect', 'incorrect']],
        ['notSet', ['notSet', 'not_set', 'NotSet', 'dispositionNotSet', 'dispositionsNotSet']],
      ];
      for (const [canonical, keys] of aliases) {
        if (seen.has(`dispositions:${normalizeKey(canonical)}`)) continue;
        for (const k of keys) {
          if (disp[k] == null) continue;
          pushMetric(metrics, seen, 'dispositions', canonical, disp[k]);
          break;
        }
      }
    }
  }

  // Top-level flatten fallbacks
  for (const [key, value] of Object.entries(row)) {
    if (value == null || typeof value === 'object') continue;
    const nk = normalizeKey(key);
    if (CALL_MODE_FIELDS.has(nk)) {
      pushMetric(metrics, seen, 'callmode', key, value);
      continue;
    }
    if (DISP_STATUS_FIELDS.has(nk)) {
      const outField = nk === 'not_set' || nk === 'notset' ? 'notSet' : key;
      pushMetric(metrics, seen, 'dispositions', outField, value);
      continue;
    }
    if (
      nk.includes('pending') ||
      nk === 'active' ||
      nk === 'inactive' ||
      nk.includes('allot')
    ) {
      pushMetric(metrics, seen, 'calls', key, value);
    }
  }

  if (!Object.keys(byDisposition).length) {
    byDisposition = parseByDisposition(
      row.byDisposition ?? row.by_disposition ?? row.byDispositions,
    );
  }

  // Also collect named disposition metrics into byDisposition if map still empty.
  if (!Object.keys(byDisposition).length) {
    for (const m of metrics) {
      if (!m.key.startsWith('dispositions:')) continue;
      const label = m.label;
      if (['Valid', 'Invalid', 'Not Set'].includes(label)) continue;
      const n = Number(String(m.value).replace(/,/g, ''));
      if (Number.isFinite(n)) byDisposition[label] = n;
    }
  }

  // Fallback: derive allotment types from metrics when unknown shape.
  if (!Object.keys(byAllotmentType).length) {
    for (const m of metrics) {
      if (!m.key.startsWith('allotment:')) continue;
      const field = m.key.slice('allotment:'.length);
      if (!field || allotmentMetaKeys.has(field)) continue;
      const n = Number(String(m.value).replace(/,/g, ''));
      if (Number.isFinite(n)) byAllotmentType[m.label || field] = n;
    }
  }

  return {
    name,
    empCode,
    total,
    answered,
    talkTime,
    metrics: sortMetrics(metrics),
    byDisposition,
    campaignActive,
    campaignInactive,
    byAllotmentType,
    allottedCx: Array.from(new Set(allottedCx)),
    allottedCxDetails,
  };
}

/**
 * Peel API envelopes without dropping sibling totals.
 * Encrypted responses often look like `{ totals, callers, payload: {…} }` —
 * older unwrap kept only `.payload` and lost Totals cards on mobile.
 */
function mergePayloadSiblings(
  host: Record<string, unknown>,
  inner: unknown,
): Record<string, unknown> | unknown[] | null {
  const { payload: _drop, data: _data, ...siblings } = host;
  if (Array.isArray(inner)) {
    if (Object.keys(siblings).length) return { ...siblings, callers: inner };
    return inner;
  }
  if (isPlainObject(inner)) {
    return { ...siblings, ...inner };
  }
  if (Object.keys(siblings).length) return siblings;
  return null;
}

function unwrapPayload(raw: unknown): Record<string, unknown> | unknown[] | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw;
  if (!isPlainObject(raw)) return null;

  // Prefer data, then payload, then the object itself (admin resolvePayload).
  const layer: unknown = raw.data ?? raw.payload ?? raw;
  if (Array.isArray(layer)) {
    // Keep sibling metrics if they lived next to data/payload on the envelope.
    if (raw.data != null || raw.payload != null) {
      return mergePayloadSiblings(raw, layer) ?? layer;
    }
    return layer;
  }

  if (isPlainObject(layer)) {
    if (layer.payload !== undefined) {
      const merged = mergePayloadSiblings(layer, layer.payload);
      if (merged != null) return merged;
    }
    if (isPlainObject(layer.data) && !Array.isArray(layer.data)) {
      const nested = layer.data;
      if (nested.payload !== undefined) {
        const merged = mergePayloadSiblings(nested, nested.payload);
        if (merged != null) return merged;
      }
      return nested;
    }
    if (Array.isArray(layer.data)) {
      return mergePayloadSiblings(layer, layer.data) ?? layer.data;
    }
    return layer;
  }

  if (isPlainObject(raw.payload)) {
    return mergePayloadSiblings(raw, raw.payload) ?? raw.payload;
  }
  if (Array.isArray(raw.payload)) {
    return mergePayloadSiblings(raw, raw.payload) ?? raw.payload;
  }
  return raw;
}

function collectCallerArrays(payload: Record<string, unknown>): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const pushRows = (rows: unknown) => {
    if (!Array.isArray(rows)) return;
    for (const item of rows) {
      if (isPlainObject(item) && isCallerRow(item)) out.push(item);
    }
  };

  pushRows(payload.callers);
  pushRows(payload.caller);
  pushRows(payload.rows);
  pushRows(payload.list);
  pushRows(payload.data);

  if (!out.length) {
    for (const value of Object.values(payload)) {
      if (!Array.isArray(value)) continue;
      const sample = value.find(isPlainObject) as Record<string, unknown> | undefined;
      if (sample && isCallerRow(sample)) {
        pushRows(value);
        break;
      }
    }
  }

  return out;
}

function normalizeEmpCode(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/^0+(?=\d)/, '');
}

function looksLikeCallRow(item: Record<string, unknown>): boolean {
  const keys = Object.keys(item);
  const hit = (names: string[]) =>
    names.some((name) => keys.some((key) => key.toLowerCase() === name.toLowerCase()));
  if (
    hit([
      'callId',
      'call_id',
      'phoneNumber',
      'phone',
      'mobile',
      'clickedAt',
      'callDate',
      'hangupRequestedAt',
      'recordingUrl',
      'recording_url',
      'dialerUniqueId',
      'webhookPayload',
    ])
  ) {
    return true;
  }
  return (
    hit(['status', 'statusByDialer', 'disposition']) &&
    hit(['extension', 'duration', 'from', 'to', 'sid', 'userId', 'username', '_id'])
  );
}

function isCallArray(value: unknown): value is Record<string, unknown>[] {
  if (!Array.isArray(value) || !value.length) return false;
  const rows = value.filter(isPlainObject) as Record<string, unknown>[];
  if (!rows.length) return false;
  const sample = rows.slice(0, Math.min(5, rows.length));
  return sample.filter(looksLikeCallRow).length >= Math.ceil(sample.length / 2);
}

const CALL_ARRAY_KEYS = [
  'calls',
  'callList',
  'callLogs',
  'call_logs',
  'callerCalls',
  'includedCalls',
  'callHistory',
  'call_history',
  'recentCalls',
  'recent_calls',
  'callDetails',
  'callRecords',
  'records',
  'items',
  'list',
  'data',
  'rows',
  'docs',
  'results',
] as const;

/** Deep-collect call arrays from includeCalls dashboard payload (admin parity). */
function collectCallArrays(
  value: unknown,
  depth = 0,
  out: Record<string, unknown>[][] = [],
): Record<string, unknown>[][] {
  if (value == null || depth > 6) return out;
  if (isCallArray(value)) {
    out.push(value.filter(isPlainObject) as Record<string, unknown>[]);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectCallArrays(item, depth + 1, out);
    return out;
  }
  if (!isPlainObject(value)) return out;

  const mapValues = Object.values(value).filter(isPlainObject) as Record<string, unknown>[];
  if (
    mapValues.length >= 1 &&
    mapValues.length === Object.keys(value).length &&
    mapValues.every(looksLikeCallRow)
  ) {
    out.push(mapValues);
    return out;
  }

  for (const key of CALL_ARRAY_KEYS) {
    const nested = value[key];
    if (isCallArray(nested)) {
      out.push(nested.filter(isPlainObject) as Record<string, unknown>[]);
    } else if (isPlainObject(nested) || Array.isArray(nested)) {
      collectCallArrays(nested, depth + 1, out);
    }
  }

  for (const [key, nested] of Object.entries(value)) {
    if ((CALL_ARRAY_KEYS as readonly string[]).includes(key)) continue;
    if (nested && typeof nested === 'object') collectCallArrays(nested, depth + 1, out);
  }
  return out;
}

function findCallerRowForCalls(
  payload: unknown,
  empCode?: string,
): Record<string, unknown> | null {
  const code = normalizeEmpCode(empCode);
  const visit = (value: unknown, depth = 0): Record<string, unknown> | null => {
    if (value == null || depth > 5) return null;
    if (Array.isArray(value)) {
      const rows = value.filter(isPlainObject) as Record<string, unknown>[];
      if (!rows.length) return null;
      if (code) {
        const matched = rows.find((row) => {
          const sub = isPlainObject(row.subAdmin) ? row.subAdmin : null;
          const rowCode = normalizeEmpCode(
            row.empCode || row.emp_code || sub?.empCode || sub?.emp_code || '',
          );
          return Boolean(rowCode && rowCode === code);
        });
        if (matched) return matched;
      }
      return (
        rows.find(
          (row) => row.empCode != null || row.subAdmin != null || isPlainObject(row.calls),
        ) || null
      );
    }
    if (!isPlainObject(value)) return null;
    for (const key of ['callers', 'callerList', 'data', 'rows', 'items', 'list']) {
      const found = visit(value[key], depth + 1);
      if (found) return found;
    }
    return null;
  };
  return visit(payload);
}

/**
 * Extract dialer call rows from GET /dialer/caller-dashboard?includeCalls=true.
 * Matches admin `extractCallerCalls` — deep scan + prefer matched empCode caller.
 */
export function extractGtelCallsFromCallerDashboard(
  raw: unknown,
  empCode?: string,
): Record<string, unknown>[] {
  const payload = unwrapPayload(raw);
  if (payload == null) return [];

  const code = normalizeEmpCode(empCode);
  const callerRow = findCallerRowForCalls(payload, empCode);
  const preferred = callerRow ? collectCallArrays(callerRow) : [];
  const all = preferred.length ? preferred : collectCallArrays(payload);
  if (!all.length) return [];

  const ranked = [...all].sort((a, b) => b.length - a.length);
  let calls = ranked[0];

  if (code) {
    const withCode = calls.filter((row) =>
      Boolean(normalizeEmpCode(row.empCode || row.emp_code || row.callerEmpCode || '')),
    );
    if (withCode.length) {
      const matched = calls.filter((row) => {
        const rowCode = normalizeEmpCode(row.empCode || row.emp_code || row.callerEmpCode || '');
        return !rowCode || rowCode === code;
      });
      if (matched.length) calls = matched;
    }
  }

  return calls;
}

function metricFieldNum(row: GtelCallerDashRow, group: string, field: string): number | null {
  const g = normalizeKey(group);
  const f = normalizeKey(field);
  for (const m of row.metrics) {
    if (!m.key.includes(':')) continue;
    const [grp, fld] = m.key.split(':');
    if (normalizeKey(grp) !== g || normalizeKey(fld) !== f) continue;
    const n = Number(String(m.value).replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : 0;
  }
  return null;
}

function ensureMetric(
  metrics: GtelCallerDashMetric[],
  group: string,
  field: string,
  value: number,
): GtelCallerDashMetric[] {
  const id = `${normalizeKey(group)}:${normalizeKey(field)}`;
  if (metrics.some((m) => m.key === id)) return metrics;
  return sortMetrics([
    ...metrics,
    {
      key: id,
      label: metricLabel(group, field),
      value: formatMetric(field, value),
      tone: gtelCallerDashStatTone(field),
    },
  ]);
}

/** When any caller has E/C/S or Flagged, ensure every row shows those counts (0 default). */
export function ensureGtelVerticalFlaggedMetrics(rows: GtelCallerDashRow[]): GtelCallerDashRow[] {
  const hasVertical = rows.some((row) =>
    VERTICAL_FIELDS.some((v) => metricFieldNum(row, 'playerCompositionByVertical', v) != null),
  );
  const hasFlagged = rows.some(
    (row) => metricFieldNum(row, 'personalConnectionCompliance', 'flagged') != null,
  );
  if (!hasVertical && !hasFlagged) return rows;

  return rows.map((row) => {
    let metrics = row.metrics;
    if (hasVertical) {
      for (const vert of VERTICAL_FIELDS) {
        const n = metricFieldNum(row, 'playerCompositionByVertical', vert);
        metrics = ensureMetric(metrics, 'playerCompositionByVertical', vert, n ?? 0);
      }
    }
    if (hasFlagged) {
      const n = metricFieldNum(row, 'personalConnectionCompliance', 'flagged');
      metrics = ensureMetric(metrics, 'personalConnectionCompliance', 'flagged', n ?? 0);
    }
    return metrics === row.metrics ? row : { ...row, metrics };
  });
}

function parseCardNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const n = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function talkTimeToSeconds(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = String(value ?? '').trim();
  if (!text || text === '—') return 0;
  const matched = text.match(/(\d+)\s*Hr\s*(\d+)\s*Min\s*(\d+)\s*Sec/i);
  if (matched) {
    return Number(matched[1]) * 3600 + Number(matched[2]) * 60 + Number(matched[3]);
  }
  const asNum = Number(text.replace(/,/g, ''));
  return Number.isFinite(asNum) ? asNum : 0;
}

function sumMetricFields(
  rows: GtelCallerDashRow[],
  groups: string[],
  fields: string[],
): number | null {
  let found = false;
  let sum = 0;
  for (const row of rows) {
    let rowVal: number | null = null;
    for (const group of groups) {
      if (rowVal != null) break;
      for (const field of fields) {
        const n = metricFieldNum(row, group, field);
        if (n == null) continue;
        rowVal = n;
        break;
      }
    }
    if (rowVal == null) continue;
    found = true;
    sum += rowVal;
  }
  return found ? sum : null;
}

/** Exch / Casino / SM / Flagged totals across caller rows. */
export function gtelVerticalFlaggedSummaryCards(rows: GtelCallerDashRow[]): GtelCallerDashCard[] {
  return buildGtelTotalsCardsFromCallers(rows).filter((card) =>
    ['e', 'c', 's', 'flagged'].includes(cardFieldKey(card.key)),
  );
}

/**
 * Build admin-style Totals cards by summing caller rows.
 * Used when API envelope unwrap drops the top-level `totals` block (common on mobile).
 */
export function buildGtelTotalsCardsFromCallers(rows: GtelCallerDashRow[]): GtelCallerDashCard[] {
  if (!rows.length) return [];

  const cards: GtelCallerDashCard[] = [
    {
      key: 'callers',
      label: 'Callers',
      value: formatMetric('callers', rows.length),
      tone: gtelCallerDashStatTone('callers'),
    },
  ];

  let totalCalls = 0;
  let answered = 0;
  let talkSecs = 0;
  let hasTotal = false;
  let hasAnswered = false;
  let hasTalk = false;

  for (const row of rows) {
    const t = parseCardNumber(row.total);
    if (String(row.total || '').trim() && String(row.total).trim() !== '—') {
      hasTotal = true;
      totalCalls += t;
    }
    const a = parseCardNumber(row.answered);
    if (String(row.answered || '').trim() && String(row.answered).trim() !== '—') {
      hasAnswered = true;
      answered += a;
    }
    const fromMetric = sumMetricFields([row], ['calls', 'call'], [
      'talkSeconds',
      'talk_seconds',
      'talkTime',
      'talk_time',
    ]);
    if (fromMetric != null) {
      hasTalk = true;
      talkSecs += fromMetric;
    } else {
      const secs = talkTimeToSeconds(row.talkTime);
      if (secs > 0 || (row.talkTime && row.talkTime !== '—')) {
        hasTalk = true;
        talkSecs += secs;
      }
    }
  }

  if (hasTotal) {
    cards.push({
      key: 'calls',
      label: 'Total Calls',
      value: formatMetric('calls', totalCalls),
      tone: gtelCallerDashStatTone('calls'),
    });
  }
  if (hasAnswered) {
    cards.push({
      key: 'answered',
      label: 'Answered',
      value: formatMetric('answered', answered),
      tone: gtelCallerDashStatTone('answered'),
    });
  }

  const redials = sumMetricFields(rows, ['calls', 'call'], ['redials', 'redial']);
  if (redials != null) {
    cards.push({
      key: 'redials',
      label: 'Redials',
      value: formatMetric('redials', redials),
      tone: gtelCallerDashStatTone('redials'),
    });
  }

  if (hasTalk) {
    cards.push({
      key: 'talkSeconds',
      label: 'Talk Time',
      value: formatTalkTime(talkSecs),
      tone: gtelCallerDashStatTone('talkSeconds'),
    });
  }

  const valid = sumMetricFields(
    rows,
    ['dispositions', 'disposition', 'calls'],
    ['valid', 'validDispositions'],
  );
  if (valid != null) {
    cards.push({
      key: 'valid',
      label: 'Valid Disposition',
      value: formatMetric('valid', valid),
      tone: gtelCallerDashStatTone('valid'),
    });
  }

  const invalid = sumMetricFields(
    rows,
    ['dispositions', 'disposition', 'calls'],
    ['invalid', 'invalidDispositions'],
  );
  if (invalid != null) {
    cards.push({
      key: 'invalid',
      label: 'Invalid Disposition',
      value: formatMetric('invalid', invalid),
      tone: gtelCallerDashStatTone('invalid'),
    });
  }

  const notSet = sumMetricFields(
    rows,
    ['dispositions', 'disposition', 'calls'],
    ['notSet', 'not_set', 'dispositionNotSet', 'dispositionsNotSet'],
  );
  if (notSet != null) {
    cards.push({
      key: 'notSet',
      label: 'Disposition Not Set',
      value: formatMetric('notSet', notSet),
      tone: gtelCallerDashStatTone('notSet'),
    });
  }

  const pending = sumMetricFields(
    rows,
    ['calls', 'call', 'pending'],
    [
      'pending',
      'pendingCalls',
      'pendingTotal',
      'pending_calls',
      'pendingInCampaigns',
      'pendingCampaigns',
    ],
  );
  if (pending != null) {
    cards.push({
      key: 'pendingCalls',
      label: 'Pending Calls',
      value: formatMetric('pendingCalls', pending),
      tone: gtelCallerDashStatTone('pending'),
    });
  }

  const allotment = sumMetricFields(
    rows,
    ['allotment', 'allotments', 'allot'],
    ['total', 'allotted', 'count'],
  );
  if (allotment != null) {
    cards.push({
      key: 'allotment',
      label: 'CX Allotments',
      value: formatMetric('allotment', allotment),
      tone: gtelCallerDashStatTone('allotment'),
    });
  }

  for (const vert of VERTICAL_FIELDS) {
    const n = sumMetricFields(rows, ['playerCompositionByVertical'], [vert]);
    if (n == null) continue;
    cards.push({
      key: vert,
      label: labelizeKey(vert),
      value: formatMetric(vert, n),
      tone: gtelCallerDashStatTone(vert),
    });
  }

  const flagged = sumMetricFields(
    rows,
    ['personalConnectionCompliance', 'compliance'],
    ['flagged', 'flaggedCount'],
  );
  if (flagged != null) {
    cards.push({
      key: 'flagged',
      label: 'Flagged words',
      value: formatMetric('flagged', flagged),
      tone: gtelCallerDashStatTone('flagged'),
    });
  }

  return sortTotalsCards(cards);
}

function cardFieldKey(key: string): string {
  const parts = String(key || '').split('.');
  return normalizeKey(parts[parts.length - 1] || key);
}

function sortTotalsCards(cards: GtelCallerDashCard[]): GtelCallerDashCard[] {
  return [...cards].sort((a, b) => {
    const ak = cardFieldKey(a.key);
    const bk = cardFieldKey(b.key);
    const ai = TOTALS_CARD_ORDER.indexOf(ak);
    const bi = TOTALS_CARD_ORDER.indexOf(bk);
    const aRank = ai >= 0 ? ai : TOTALS_CARD_ORDER.length + 1;
    const bRank = bi >= 0 ? bi : TOTALS_CARD_ORDER.length + 1;
    if (aRank !== bRank) return aRank - bRank;
    return a.label.localeCompare(b.label);
  });
}

/**
 * Flatten payload scalars into Totals cards (admin mergeIntoTotals parity).
 * Nested objects (vertical / compliance / dispositions) are recursively flattened.
 */
function collectTotalsCards(payload: Record<string, unknown>): GtelCallerDashCard[] {
  const byNorm = new Map<string, GtelCallerDashCard>();

  const pushScalar = (fieldKey: string, fieldVal: unknown) => {
    if (fieldVal == null || fieldVal === '') return;
    if (isPlainObject(fieldVal)) {
      for (const [nestedKey, nestedVal] of Object.entries(fieldVal)) {
        pushScalar(nestedKey, nestedVal);
      }
      return;
    }
    if (Array.isArray(fieldVal)) {
      // Only count-like arrays (campaign lists); skip caller arrays.
      if (fieldVal.some((item) => isPlainObject(item) && isCallerRow(item))) return;
      const labels = extractListLabels(fieldVal);
      const count = countOrValue(fieldVal, labels);
      if (count == null) return;
      fieldVal = count;
    }
    if (typeof fieldVal === 'object') return;

    const nk = normalizeKey(fieldKey);
    // Skip group wrapper keys that only exist as containers.
    if (
      nk === 'totals' ||
      nk === 'summary' ||
      nk === 'stats' ||
      isVerticalCompositionGroup(nk) ||
      isComplianceGroup(nk)
    ) {
      return;
    }
    if (byNorm.has(nk)) return;
    byNorm.set(nk, {
      key: fieldKey,
      label: labelizeKey(fieldKey),
      value: formatMetric(fieldKey, fieldVal),
      tone: gtelCallerDashStatTone(fieldKey),
    });
  };

  const skipMeta = new Set(['range', 'daterange', 'period', 'filters', 'graphicalview']);
  const skipCallerArrays = new Set(['callers', 'caller', 'rows', 'list', 'data']);

  const mergeIntoTotals = (normKey: string) =>
    normKey === 'totals' ||
    normKey === 'summary' ||
    normKey === 'stats' ||
    isVerticalCompositionGroup(normKey) ||
    isComplianceGroup(normKey);

  for (const [key, value] of Object.entries(payload)) {
    if (value == null || value === '') continue;
    const nk = normalizeKey(key);
    if (skipMeta.has(nk)) continue;

    if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
      // Top-level callers: 32 etc.
      pushScalar(key === 'caller' ? 'callers' : key, value);
      continue;
    }

    if (Array.isArray(value)) {
      if (skipCallerArrays.has(nk) || value.some((item) => isPlainObject(item) && isCallerRow(item))) {
        if (!byNorm.has('callers') && value.some((item) => isPlainObject(item) && isCallerRow(item))) {
          pushScalar('callers', value.length);
        }
      }
      continue;
    }

    if (isPlainObject(value) && !isCallerRow(value)) {
      if (mergeIntoTotals(nk)) {
        for (const [childKey, childVal] of Object.entries(value)) {
          pushScalar(childKey, childVal);
        }
        continue;
      }
      // Other nested metric groups: flatten scalars with field labels.
      for (const [childKey, childVal] of Object.entries(value)) {
        if (childVal == null || typeof childVal === 'object') continue;
        pushScalar(childKey, childVal);
      }
    }
  }

  return sortTotalsCards(Array.from(byNorm.values()));
}

/** Prefer API Totals; fill any missing admin Totals keys from caller-row sums. */
export function mergeGtelTotalsCards(
  cards: GtelCallerDashCard[],
  rows: GtelCallerDashRow[],
): GtelCallerDashCard[] {
  const present = new Set(cards.map((c) => cardFieldKey(c.key)));
  // Also treat total/totalcalls as covering "calls".
  if (present.has('total') || present.has('totalcalls')) present.add('calls');
  if (present.has('calls')) present.add('total');
  const fallback = buildGtelTotalsCardsFromCallers(rows).filter((card) => {
    const k = cardFieldKey(card.key);
    if (present.has(k)) return false;
    if (k === 'calls' && (present.has('total') || present.has('totalcalls'))) return false;
    return true;
  });
  if (!fallback.length) return sortTotalsCards(cards);
  return sortTotalsCards([...cards, ...fallback]);
}

/**
 * Normalize caller-dashboard API body into summary cards + caller rows.
 */
export function normalizeGtelCallerDashboard(raw: unknown): {
  cards: GtelCallerDashCard[];
  callers: GtelCallerDashRow[];
} {
  const payload = unwrapPayload(raw);
  const callers: GtelCallerDashRow[] = [];

  if (Array.isArray(payload)) {
    for (const item of payload) {
      if (isPlainObject(item) && isCallerRow(item)) callers.push(mapCallerRow(item));
    }
    const normalizedCallers = ensureGtelVerticalFlaggedMetrics(callers);
    return {
      cards: mergeGtelTotalsCards([], normalizedCallers),
      callers: normalizedCallers,
    };
  }

  if (!isPlainObject(payload)) return { cards: [], callers };

  for (const row of collectCallerArrays(payload)) {
    callers.push(mapCallerRow(row));
  }

  const normalizedCallers = ensureGtelVerticalFlaggedMetrics(callers);
  const cards = mergeGtelTotalsCards(collectTotalsCards(payload), normalizedCallers);
  return { cards, callers: normalizedCallers };
}

/** True when login Role_ID is in {@link CALLER_HEAD} — show only assigned callers. */
export function isGtelCallerHeadDashboardRole(roleId: unknown): boolean {
  return CALLER_HEAD_ROLE_IDS.has(String(roleId ?? '').trim());
}

export type GtelCallerHeadIndex = {
  byEmp: Record<string, unknown>;
  byName: Record<string, unknown>;
};

function empLookupKeys(value: unknown): string[] {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!raw || raw === '—' || raw === '-') return [];
  const stripped = raw.replace(/^0+/, '') || '0';
  return raw === stripped ? [raw] : [raw, stripped];
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text && text !== '—' && text !== '-') return text;
  }
  return '';
}

function samePerson(
  admin: Record<string, unknown>,
  roleId: string,
  userId: string,
  empCode: string,
): boolean {
  const adminId = String(admin._id || '').trim();
  const adminRoleId = String(admin.Role_ID || admin.roleId || '').trim();
  const adminEmp = String(admin.empCode || '').trim();
  if (userId && adminId === userId) return true;
  if (empCode && adminEmp && adminEmp === empCode && (!roleId || adminRoleId === roleId)) {
    return true;
  }
  return Boolean(roleId && adminRoleId === roleId && userId && adminId === userId);
}

/** Collect login display names from user + byRole directory. */
export function gtelCallerHeadMatchNames(
  byRole: unknown,
  opts: { roleId: string; userId: string; empCode: string; loginNames?: string[] },
): string[] {
  const groups = Array.isArray(byRole) ? byRole : [];
  const names = new Set<string>();
  for (const n of opts.loginNames || []) {
    const t = String(n || '').trim();
    if (t) names.add(t);
  }
  for (const role of groups) {
    if (!isPlainObject(role)) continue;
    const subs = Array.isArray(role.subAdmins) ? role.subAdmins : [];
    for (const admin of subs) {
      if (!isPlainObject(admin)) continue;
      if (!samePerson(admin, opts.roleId, opts.userId, opts.empCode)) continue;
      for (const key of ['name', 'realName', 'chatName'] as const) {
        const t = String(admin[key] || '').trim();
        if (t) names.add(t);
      }
    }
  }
  return Array.from(names);
}

/**
 * Build empCode/name → callerHead index from Caller Allotment `byRole`
 * (only caller Role_IDs).
 */
export function buildGtelCallerHeadIndex(byRole: unknown): GtelCallerHeadIndex {
  const byEmp: Record<string, unknown> = {};
  const byName: Record<string, unknown> = {};
  const groups = Array.isArray(byRole) ? byRole : [];
  for (const role of groups) {
    if (!isPlainObject(role)) continue;
    const roleKey = String(role.roleId || role._id || '').trim();
    if (roleKey && !CALLER_ROLE_IDS.has(roleKey)) continue;
    const subs = Array.isArray(role.subAdmins) ? role.subAdmins : [];
    for (const admin of subs) {
      if (!isPlainObject(admin)) continue;
      const callerHead = admin.callerHead;
      if (callerHead == null || callerHead === '' || callerHead === 'not assigned') continue;
      for (const code of empLookupKeys(admin.empCode)) {
        byEmp[code] = callerHead;
      }
      const name = firstText(admin.name, admin.realName).toLowerCase();
      if (name) byName[name] = callerHead;
    }
  }
  return { byEmp, byName };
}

function lookupCallerHead(
  row: GtelCallerDashRow,
  index: GtelCallerHeadIndex,
): unknown {
  for (const key of empLookupKeys(row.empCode)) {
    if (index.byEmp[key] != null) return index.byEmp[key];
  }
  const name = String(row.name || '')
    .trim()
    .toLowerCase();
  if (name && index.byName[name] != null) return index.byName[name];
  return undefined;
}

/** True if callerHead assignment includes any of the login head names. */
export function matchesGtelCallerHeadAssignment(
  callerHead: unknown,
  loginNames: string[],
): boolean {
  const mine = loginNames.map((n) => n.trim().toLowerCase()).filter(Boolean);
  if (!mine.length || callerHead == null || callerHead === '' || callerHead === 'not assigned') {
    return false;
  }
  const same = (value: unknown) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const record = value as { name?: unknown; realName?: unknown };
      const named = firstText(record.name, record.realName).toLowerCase();
      return mine.includes(named);
    }
    return mine.includes(String(value ?? '').trim().toLowerCase());
  };
  if (Array.isArray(callerHead)) return callerHead.some(same);
  return String(callerHead)
    .split(/[,|]/)
    .some((part) => same(part));
}

/**
 * For CALLER_HEAD logins: keep only callers whose allotment `callerHead`
 * matches the logged-in head. Other roles: return rows unchanged.
 */
export function filterGtelCallerDashRowsForHead(
  rows: GtelCallerDashRow[],
  index: GtelCallerHeadIndex,
  loginNames: string[],
): GtelCallerDashRow[] {
  if (!loginNames.length) return [];
  return rows.filter((row) =>
    matchesGtelCallerHeadAssignment(lookupCallerHead(row, index), loginNames),
  );
}

export type AssembleGtelCallerDashboardParams = {
  dashBody: unknown;
  /** `byRole` from ops.callerAllotmentSubadmins — required when restricting. */
  allotByRole?: unknown;
  restrictToAssignedCallers: boolean;
  roleId: string;
  userId: string;
  empCode: string;
  loginNames: string[];
};

export type AssembleGtelCallerDashboardResult = {
  cards: GtelCallerDashCard[];
  callers: GtelCallerDashRow[];
  /** Soft empty-state message (not a network failure). */
  emptyMessage: string | null;
};

/** Normalize dashboard (+ optional head allotment filter) into UI cards/rows. */
export function assembleGtelCallerDashboard(
  params: AssembleGtelCallerDashboardParams,
): AssembleGtelCallerDashboardResult {
  const parsed = normalizeGtelCallerDashboard(params.dashBody);
  let callers = parsed.callers;

  if (params.restrictToAssignedCallers) {
    const index = buildGtelCallerHeadIndex(params.allotByRole);
    const matchNames = gtelCallerHeadMatchNames(params.allotByRole, {
      roleId: params.roleId,
      userId: params.userId,
      empCode: params.empCode,
      loginNames: params.loginNames,
    });
    callers = filterGtelCallerDashRowsForHead(parsed.callers, index, matchNames);
  }

  const cards = params.restrictToAssignedCallers
    ? buildGtelTotalsCardsFromCallers(callers)
    : mergeGtelTotalsCards(parsed.cards, callers);

  const emptyMessage =
    !cards.length && !callers.length
      ? params.restrictToAssignedCallers
        ? 'No assigned callers for this head.'
        : 'No dashboard data for selected filters.'
      : null;

  return { cards, callers, emptyMessage };
}
