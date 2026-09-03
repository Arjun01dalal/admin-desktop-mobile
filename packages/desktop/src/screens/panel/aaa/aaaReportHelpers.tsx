import type { ReactNode } from 'react';

const PREFERRED_LIST_KEYS = [
  'reports',
  'report',
  'FraudBets',
  'fraudBets',
  'data',
  'list',
  'rows',
  'items',
  'users',
  'result',
  'payload',
];

const MAX_CELL_LENGTH = 200;
const IMAGE_URL_REGEX = /^https?:\/\/.*\.(png|jpe?g|gif|webp|svg|bmp)(\?.*)?$/i;
const IMAGE_DATA_URI_REGEX = /^data:image\/[a-zA-Z0-9.+-]+;base64,/i;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?$/;

export function formatColumnLabel(key: string): string {
  const withSpaces = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
  return withSpaces
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function findRecordArray(value: unknown, depth = 0): unknown[] | null {
  if (value == null || depth > 5) return null;

  if (Array.isArray(value)) {
    if (value.length === 0 || value.every((item) => isPlainObject(item))) {
      return value;
    }
    return null;
  }

  if (isPlainObject(value)) {
    for (const key of PREFERRED_LIST_KEYS) {
      if (key in value) {
        const found = findRecordArray(value[key], depth + 1);
        if (found) return found;
      }
    }
    for (const key of Object.keys(value)) {
      if (PREFERRED_LIST_KEYS.includes(key)) continue;
      const found = findRecordArray(value[key], depth + 1);
      if (found) return found;
    }
  }

  return null;
}

export function extractList(raw: unknown): Record<string, unknown>[] {
  const found = findRecordArray(raw);
  if (!found) return [];
  return found.filter(isPlainObject) as Record<string, unknown>[];
}

export function collectColumns(rows: Record<string, unknown>[]): string[] {
  if (!rows.length) return [];
  const keys = new Set<string>();
  for (const row of rows) {
    Object.keys(row || {}).forEach((key) => keys.add(key));
  }
  return Array.from(keys);
}

function formatPrimitive(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' && /time|date/i.test(key) && ISO_DATE_REGEX.test(value)) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleString();
  }
  return String(value);
}

function renderCellValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return text.length > MAX_CELL_LENGTH ? `${text.slice(0, MAX_CELL_LENGTH)}…` : text;
}

function isImageValue(col: string, value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (IMAGE_DATA_URI_REGEX.test(value)) return true;
  if (/screenshot|screen_shot|image|photo/i.test(col)) {
    return /^https?:\/\//i.test(value);
  }
  return IMAGE_URL_REGEX.test(value);
}

function formatObjectInline(obj: Record<string, unknown>): string {
  return Object.entries(obj)
    .map(([key, val]) =>
      isPlainObject(val)
        ? `${key}: {${formatObjectInline(val)}}`
        : `${key}: ${formatPrimitive(key, val)}`,
    )
    .join(', ');
}

function renderJsonValue(value: unknown): ReactNode {
  if (Array.isArray(value)) {
    if (value.length === 0) return '-';
    if (value.every((item) => isPlainObject(item))) {
      return (
        <div style={{ maxHeight: 150, overflowY: 'auto', textAlign: 'left' }}>
          {value.map((item, idx) => (
            <div
              key={idx}
              style={{
                padding: '3px 0',
                borderBottom: idx < value.length - 1 ? '1px dashed #ddd' : 'none',
              }}
            >
              {formatObjectInline(item as Record<string, unknown>)}
            </div>
          ))}
        </div>
      );
    }
    return value.map((item) => formatPrimitive('', item)).join(', ');
  }

  if (isPlainObject(value)) {
    if (typeof value.message === 'string' && Object.keys(value).length === 1) {
      return value.message;
    }
    return (
      <div style={{ maxHeight: 150, overflowY: 'auto', textAlign: 'left' }}>
        {Object.entries(value).map(([key, val]) => (
          <div key={key} style={{ padding: '1px 0' }}>
            <strong>{key}:</strong>{' '}
            {isPlainObject(val) ? formatObjectInline(val) : formatPrimitive(key, val)}
          </div>
        ))}
      </div>
    );
  }

  return renderCellValue(value);
}

export function renderAaaCell(
  col: string,
  value: unknown,
  onImageClick: (src: string) => void,
): ReactNode {
  if (isImageValue(col, value)) {
    return (
      <img
        src={value}
        alt={formatColumnLabel(col)}
        onClick={() => onImageClick(value)}
        style={{
          maxWidth: 150,
          maxHeight: 100,
          objectFit: 'contain',
          borderRadius: 4,
          border: '1px solid #ddd',
          cursor: 'pointer',
        }}
      />
    );
  }
  if (value !== null && typeof value === 'object') {
    return renderJsonValue(value);
  }
  return renderCellValue(value);
}

export function toDateTimeLocal(date: Date): string {
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function defaultFraudEndDate(): string {
  return toDateTimeLocal(new Date());
}

export function defaultFraudStartDate(): string {
  return toDateTimeLocal(new Date(Date.now() - 9 * 24 * 60 * 60 * 1000));
}
