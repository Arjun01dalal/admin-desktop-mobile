import type { FiltersState } from './constants';
import type { HouseGameTransaction } from './types';

const NUMERIC_FILTER_KEYS = new Set(['roundCapacity', 'minAmount', 'maxAmount']);
const BOOLEAN_FILTER_KEYS = new Set(['isBot', 'human']);

const cleanFilter = (filter: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(filter).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  );

export const buildFilterPayload = (filters: FiltersState) => {
  const filter: Record<string, unknown> = {};

  Object.entries(filters).forEach(([key, value]) => {
    if (value === '' || value === null) return;

    if (BOOLEAN_FILTER_KEYS.has(key)) {
      filter[key] = value;
      return;
    }

    if (NUMERIC_FILTER_KEYS.has(key)) {
      const num = Number(value);
      if (!Number.isNaN(num)) filter[key] = num;
      return;
    }

    filter[key] = value;
  });

  if (filter.txnId) {
    filter.transactionId = filter.txnId;
  }

  return cleanFilter(filter);
};

export const formatDateTime = (value?: string) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const date = d.toLocaleDateString('en-GB');
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${date} - ${time}`;
};

export const getPlayerIdentity = (item: HouseGameTransaction) => {
  const identity = item?.playerIdentity;
  if (identity) {
    return `Bot: ${identity?.bot ?? '-'}, Real: ${identity?.real ?? '-'}`;
  }

  if (item?.playerIdentityBot !== undefined || item?.playerIdentityReal !== undefined) {
    return `Bot: ${item?.playerIdentityBot ?? '-'}, Real: ${item?.playerIdentityReal ?? '-'}`;
  }

  return '-';
};

export const getIsBotValue = (item: HouseGameTransaction & { bot?: unknown }) => {
  if (item?.isBot !== undefined) return String(item.isBot);
  if (item?.bot !== undefined) return String(item.bot);
  return '-';
};
