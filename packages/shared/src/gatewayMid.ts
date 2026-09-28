/**
 * Set Gateway Mid — shared types & parsers (admin-panel-domains WhatsappMid / Gateway Mid).
 * Used by desktop + mobile.
 */

export const GATEWAY_MID_POSITION_LIMIT = 15;

export const WHATSAPP_UP_RAJ_NAME = 'whatsapp-UP-RAJ';
export const WHATSAPP_UP_RAJ_NUMBER = '+918040265069';

export type GatewayMidFormField =
  | 'name'
  | 'mid'
  | 'upiId'
  | 'maxDepositAllowed'
  | 'position'
  | 'type'
  | 'whatsappNumber';

export type GatewayMidRow = {
  _id?: string;
  id?: string;
  name: string;
  mid: string;
  midName?: string;
  upiId: string;
  maxDepositAllowed: number;
  position: number;
  isCurrentlyActive: boolean;
  type?: string;
  whatsappNumber?: string;
};

export type GatewayMidFormState = {
  name: string;
  mid: string;
  upiId: string;
  maxDepositAllowed: string;
  position: string;
  type: string;
  whatsappNumber: string;
};

export type GatewayMidFormErrors = Partial<Record<GatewayMidFormField, string>>;

export const EMPTY_GATEWAY_MID_FORM: GatewayMidFormState = {
  name: '',
  mid: '',
  upiId: '',
  maxDepositAllowed: '',
  position: '',
  type: '',
  whatsappNumber: '',
};

export const GATEWAY_MID_FIELD_LABELS: Record<GatewayMidFormField, string> = {
  name: 'Enter Name',
  mid: 'Enter MID',
  upiId: 'Enter UPI Id',
  maxDepositAllowed: 'Enter Max Deposit Allowed',
  position: 'Enter Position',
  type: 'Select Type',
  whatsappNumber: 'Enter WhatsApp Number',
};

export const getGatewayMidRowId = (item: Pick<GatewayMidRow, '_id' | 'id'>) =>
  String(item._id || item.id || '').trim();

export const dedupeStrings = (values: Array<string | undefined | null>) =>
  Array.from(new Set(values.filter((value): value is string => !!value?.trim()).map((v) => v.trim())));

export const isWhatsappType = (type: string) =>
  String(type || '')
    .trim()
    .toLowerCase() === 'whatsapp';

export const isWhatsappUpRajName = (name: string) =>
  String(name || '')
    .trim()
    .toLowerCase() === WHATSAPP_UP_RAJ_NAME.toLowerCase();

export const stripWhatsappCountryCode = (value: string) => {
  const raw = String(value || '')
    .trim()
    .replace(/[\s-]/g, '');
  if (raw.startsWith('+91')) return raw.slice(3);
  if (/^91\d{10}$/.test(raw)) return raw.slice(2);
  return raw.replace(/\D/g, '');
};

/** UP Raj → prefer entered value (keep +91 if present); empty falls back to fixed no.
 *  Other whatsapp → 91… */
export const formatWhatsappNumberForSave = (name: string, number: string) => {
  const trimmed = String(number || '').trim();
  if (isWhatsappUpRajName(name)) {
    if (!trimmed) return WHATSAPP_UP_RAJ_NUMBER;
    if (trimmed.startsWith('+')) return trimmed;
    const digits = stripWhatsappCountryCode(trimmed);
    return digits ? `+91${digits}` : WHATSAPP_UP_RAJ_NUMBER;
  }
  const digits = stripWhatsappCountryCode(trimmed);
  if (!digits) return '';
  return `91${digits}`;
};

export const formatGatewayTypeLabel = (type: string) => {
  const key = String(type || '').trim();
  if (!key) return '';
  if (key === 'upi-payment') return 'UPI Payment';
  if (key === 'intent-pay') return 'Intent Pay';
  if (key === 'whatsapp') return 'WhatsApp';
  if (key === 'telegram') return 'Telegram';
  return key
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const toGatewayMidRow = (item: Record<string, unknown>, groupName?: string): GatewayMidRow => ({
  ...item,
  name: String(groupName || item?.name || ''),
  mid: String(item?.mid || ''),
  midName: String(item?.midName || item?.mid || ''),
  upiId: String(item?.upiId || ''),
  maxDepositAllowed: Number(item?.maxDepositAllowed) || 0,
  position: Number(item?.position) || 0,
  isCurrentlyActive: Boolean(item?.isCurrentlyActive),
  type: String(item?.type || item?.gatewayType || ''),
  whatsappNumber: String(
    item?.whatsappNumber || item?.whatsapp_number || item?.whatsAppNumber || '',
  ),
});

const flattenGatewayUpis = (list: unknown[]): GatewayMidRow[] =>
  list.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return [];
    const item = raw as Record<string, unknown>;
    if (Array.isArray(item.upis)) {
      const groupType = String(item.type || item.gatewayType || '');
      return item.upis.map((upi) => {
        const row = upi && typeof upi === 'object' ? (upi as Record<string, unknown>) : {};
        return toGatewayMidRow(
          {
            ...row,
            type: row.type || row.gatewayType || groupType,
          },
          String(item.name || ''),
        );
      });
    }
    return [toGatewayMidRow(item)];
  });

/** Unwrap decrypted secureApi body → object or array root. */
const unwrapRoot = (body: unknown): unknown => {
  if (Array.isArray(body)) return body;
  if (!body || typeof body !== 'object') return {};
  const obj = body as Record<string, unknown>;
  const nested = obj.payload ?? obj.data;
  if (Array.isArray(nested) || (nested && typeof nested === 'object')) return nested;
  return obj;
};

/**
 * get-all-gateway-upis → { gateways, types }
 * Thin fallback: root array treated as gateways.
 */
export const parseGatewayUpisResponse = (
  body: unknown,
): { rows: GatewayMidRow[]; types: string[] } => {
  const root = unwrapRoot(body);
  const rootObj = root && typeof root === 'object' && !Array.isArray(root)
    ? (root as Record<string, unknown>)
    : null;
  const gateways = Array.isArray(rootObj?.gateways)
    ? (rootObj!.gateways as unknown[])
    : Array.isArray(root)
      ? root
      : [];
  const rows = flattenGatewayUpis(gateways);
  const rawTypes = Array.isArray(root) ? undefined : rootObj?.types;
  const types = Array.isArray(rawTypes)
    ? dedupeStrings(rawTypes.map((t) => String(t ?? '').trim()))
    : [];
  return {
    rows,
    types: types.length ? types : dedupeStrings(rows.map((row) => row.type)),
  };
};

export const parseGatewayNameOptions = (body: unknown): string[] => {
  const root = unwrapRoot(body);
  const providers = Array.isArray(root)
    ? root
    : Array.isArray((root as Record<string, unknown>)?.payload)
      ? ((root as Record<string, unknown>).payload as unknown[])
      : [];
  return dedupeStrings(
    providers.map((gateway) => {
      if (!gateway || typeof gateway !== 'object') return '';
      const g = gateway as Record<string, unknown>;
      return String(g.name || g.displayName || '');
    }),
  );
};

/** Parse getAllDistinctMids / distinct MID list responses. */
export const parseDistinctMidOptions = (body: unknown): string[] => {
  const root = unwrapRoot(body);
  const candidate =
    root && typeof root === 'object' && !Array.isArray(root)
      ? ((root as Record<string, unknown>).payload ??
        (root as Record<string, unknown>).midList ??
        root)
      : root;

  const list = Array.isArray(candidate)
    ? candidate
    : candidate && typeof candidate === 'object'
      ? Array.isArray((candidate as Record<string, unknown>).mids)
        ? ((candidate as Record<string, unknown>).mids as unknown[])
        : Array.isArray((candidate as Record<string, unknown>).data)
          ? ((candidate as Record<string, unknown>).data as unknown[])
          : Array.isArray((candidate as Record<string, unknown>).items)
            ? ((candidate as Record<string, unknown>).items as unknown[])
            : []
      : [];

  return dedupeStrings(
    list.map((item) => {
      if (typeof item === 'string' || typeof item === 'number') return String(item).trim();
      if (!item || typeof item !== 'object') return '';
      const row = item as Record<string, unknown>;
      return String(row.mid ?? row.midName ?? '').trim();
    }),
  );
};

export const validateGatewayMidForm = (form: GatewayMidFormState): GatewayMidFormErrors => {
  const next: GatewayMidFormErrors = {};
  const whatsapp = isWhatsappType(form.type);
  (Object.keys(GATEWAY_MID_FIELD_LABELS) as GatewayMidFormField[]).forEach((field) => {
    if (field === 'whatsappNumber') {
      if (whatsapp && !String(form.whatsappNumber || '').trim()) {
        next.whatsappNumber = GATEWAY_MID_FIELD_LABELS.whatsappNumber;
      }
      return;
    }
    if (!String(form[field] || '').trim()) next[field] = GATEWAY_MID_FIELD_LABELS[field];
  });
  return next;
};

export const buildGatewayMidSavePayload = (
  form: GatewayMidFormState,
  options: { editingId?: string; editingRow?: GatewayMidRow | null },
) => {
  const isUpdate = Boolean(options.editingId);
  const type = form.type.trim() || 'whatsapp';
  const whatsapp = isWhatsappType(type);
  return {
    name: form.name.trim(),
    upiId: form.upiId.trim(),
    mid: form.mid.trim(),
    midName: form.mid.trim(),
    maxDepositAllowed: Number(form.maxDepositAllowed),
    position: Number(form.position),
    type,
    whatsappNumber: whatsapp
      ? formatWhatsappNumberForSave(form.name, form.whatsappNumber)
      : '',
    isCurrentlyActive: isUpdate ? Boolean(options.editingRow?.isCurrentlyActive) : true,
    ...(isUpdate ? { id: options.editingId } : {}),
  };
};

export const buildGatewayMidStatusPayload = (row: GatewayMidRow, checked: boolean) => ({
  name: row.name || '',
  id: getGatewayMidRowId(row),
  upiId: row.upiId,
  mid: row.mid,
  midName: row.midName || row.mid,
  maxDepositAllowed: Number(row.maxDepositAllowed),
  position: Number(row.position),
  isCurrentlyActive: checked,
});

export const formStateFromGatewayMidRow = (row: GatewayMidRow): GatewayMidFormState => ({
  name: row.name || '',
  mid: row.mid || '',
  upiId: row.upiId || '',
  maxDepositAllowed: String(row.maxDepositAllowed ?? ''),
  position: String(row.position ?? ''),
  type: row.type || '',
  whatsappNumber: isWhatsappUpRajName(row.name)
    ? WHATSAPP_UP_RAJ_NUMBER
    : stripWhatsappCountryCode(row.whatsappNumber || ''),
});

export const availableGatewayMidPositions = (
  rows: GatewayMidRow[],
  name: string,
  editingId = '',
): number[] => {
  if (!name) return [];
  const taken = new Set(
    rows
      .filter((item) => {
        if ((item.name || '') !== name) return false;
        if (editingId && getGatewayMidRowId(item) === editingId) return false;
        return true;
      })
      .map((item) => Number(item.position)),
  );
  return Array.from({ length: GATEWAY_MID_POSITION_LIMIT }, (_, i) => i + 1).filter(
    (pos) => !taken.has(pos),
  );
};

export type GatewayMidGroup = { name: string; rows: GatewayMidRow[] };

export const groupGatewayMids = (
  midData: GatewayMidRow[],
): { groups: GatewayMidGroup[]; totalUpis: number; activeCount: number } => {
  const sorted = [...midData].sort((a, b) => {
    const byName = (a.name || '').localeCompare(b.name || '');
    if (byName !== 0) return byName;
    return (Number(a.position) || 0) - (Number(b.position) || 0);
  });
  const groups: GatewayMidGroup[] = [];
  let active = 0;

  for (const item of sorted) {
    if (item.isCurrentlyActive) active += 1;
    const groupName = item.name || 'Untitled';
    const last = groups[groups.length - 1];
    if (!last || last.name !== groupName) {
      groups.push({ name: groupName, rows: [item] });
    } else {
      last.rows.push(item);
    }
  }

  return { groups, totalUpis: sorted.length, activeCount: active };
};
