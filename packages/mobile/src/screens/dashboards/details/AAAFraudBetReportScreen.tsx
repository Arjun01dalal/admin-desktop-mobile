/**
 * AAA Fraud Bet Report — mobile port of desktop AAAFraudBetReportPage / Laxmi.
 * Date pickers (From / To), card list, images rendered with <Image>.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { colors, radius, spacing } from '../../../theme';
import { secureApi } from '../../../api/client';
import { DateField } from '../../../components/DateField';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

const STATUS_OPTIONS = ['All', 'Pending', 'Approved', 'Rejected'];
const LIMIT_OPTIONS = ['10', '25', '50', '100', '200'];

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

const IMAGE_URL_REGEX = /^https?:\/\/.*\.(png|jpe?g|gif|webp|svg|bmp)(\?.*)?$/i;
const IMAGE_DATA_URI_REGEX = /^data:image\/[a-zA-Z0-9.+-]+;base64,/i;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?$/;

/** Card summary keys (show first when present). */
const CARD_PRIORITY_KEYS = [
  'userName',
  'user_name',
  'name',
  'userId',
  'user_id',
  'status',
  'amount',
  'stake',
  'gameName',
  'game',
  'market',
  'createdAt',
  'createdOn',
  'date',
  'betTime',
  'remark',
  'comment',
];

function toYmd(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toApiDateTime(ymd: string, endOfDay: boolean): string {
  const clean = ymd.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return endOfDay ? `${clean}T23:59` : `${clean}T00:00`;
  }
  // Already datetime-local
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(clean)) return clean.slice(0, 16);
  return clean;
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

function extractList(raw: unknown): Record<string, unknown>[] {
  const found = findRecordArray(raw);
  if (!found) return [];
  return found.filter(isPlainObject) as Record<string, unknown>[];
}

function formatColumnLabel(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function isImageValue(col: string, value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  if (IMAGE_DATA_URI_REGEX.test(value)) return true;
  if (/screenshot|screen_shot|image|photo|img/i.test(col)) {
    return /^https?:\/\//i.test(value) || IMAGE_DATA_URI_REGEX.test(value);
  }
  return IMAGE_URL_REGEX.test(value);
}

function cellText(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' && /time|date/i.test(key) && ISO_DATE_REGEX.test(value)) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleString();
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value).slice(0, 160);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function pickImageFromRow(row: Record<string, unknown>): { key: string; uri: string } | null {
  for (const [key, value] of Object.entries(row)) {
    if (isImageValue(key, value)) return { key, uri: value };
  }
  return null;
}

function cardFields(row: Record<string, unknown>): { key: string; label: string; value: string }[] {
  const keys = Object.keys(row);
  const ordered: string[] = [];
  for (const pref of CARD_PRIORITY_KEYS) {
    const match = keys.find((k) => k === pref || k.toLowerCase() === pref.toLowerCase());
    if (match && !ordered.includes(match) && !isImageValue(match, row[match])) {
      ordered.push(match);
    }
  }
  for (const k of keys) {
    if (ordered.length >= 6) break;
    if (ordered.includes(k)) continue;
    if (isImageValue(k, row[k])) continue;
    if (k === '_id' || k === 'id') continue;
    ordered.push(k);
  }
  return ordered.map((key) => ({
    key,
    label: formatColumnLabel(key),
    value: cellText(key, row[key]),
  }));
}

export function AAAFraudBetReportScreen() {
  const [startDate, setStartDate] = useState(() =>
    toYmd(new Date(Date.now() - 9 * 24 * 60 * 60 * 1000)),
  );
  const [endDate, setEndDate] = useState(() => toYmd(new Date()));
  const [status, setStatus] = useState('All');
  const [limit, setLimit] = useState('10');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetRow, setSheetRow] = useState<Record<string, unknown> | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await secureApi<unknown>('aaa.fraudBetsReport', {
        startDate: toApiDateTime(startDate, false),
        endDate: toApiDateTime(endDate, true),
        status: status || 'All',
        limit: String(limit || 10),
      });
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to fetch fraud bets report');
        setRows([]);
        return;
      }
      setSheetRow(null);
      setRows(extractList(res.data));
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [startDate, endDate, status, limit]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sheetFields: SheetField[] = useMemo(() => {
    if (!sheetRow) return [];
    return Object.keys(sheetRow)
      .filter((k) => !isImageValue(k, sheetRow[k]))
      .map((k) => ({
        label: formatColumnLabel(k),
        value: cellText(k, sheetRow[k]),
        multiline: true,
      }));
  }, [sheetRow]);

  const sheetImage = sheetRow ? pickImageFromRow(sheetRow) : null;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => void load()}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={styles.title}>AAA Fraud Bet Report</Text>
      <Text style={styles.sub}>Total: {rows.length.toLocaleString('en-IN')}</Text>

      <View style={styles.filterCard}>
        <View style={styles.datesRow}>
          <View style={styles.dateField}>
            <Text style={styles.fieldLabel}>From Date</Text>
            <DateField style={styles.dateInput} value={startDate} onChange={setStartDate} />
          </View>
          <View style={styles.dateField}>
            <Text style={styles.fieldLabel}>To Date</Text>
            <DateField style={styles.dateInput} value={endDate} onChange={setEndDate} />
          </View>
        </View>

        <Text style={styles.fieldLabel}>Status</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {STATUS_OPTIONS.map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.chip, status === s && styles.chipActive]}
              onPress={() => setStatus(s)}
            >
              <Text style={[styles.chipText, status === s && styles.chipTextActive]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.fieldLabel}>Limit</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {LIMIT_OPTIONS.map((n) => (
            <TouchableOpacity
              key={n}
              style={[styles.chip, limit === n && styles.chipActive]}
              onPress={() => setLimit(n)}
            >
              <Text style={[styles.chipText, limit === n && styles.chipTextActive]}>{n}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.btn, styles.btnFlex, loading && styles.btnDisabled]}
            disabled={loading}
            onPress={() => void load()}
          >
            <Text style={styles.btnText}>{loading ? 'Loading…' : 'Apply'}</Text>
          </TouchableOpacity>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      {loading && rows.length === 0 ? <Text style={styles.hint}>Loading…</Text> : null}
      {!loading && rows.length === 0 ? (
        <Text style={styles.hint}>No fraud bets found for the selected filters.</Text>
      ) : null}

      <View style={styles.list}>
        {rows.map((row, index) => {
          const image = pickImageFromRow(row);
          const fields = cardFields(row);
          const title =
            String(
              row.userName ||
                row.user_name ||
                row.name ||
                row.userId ||
                row.user_id ||
                `Bet #${index + 1}`,
            ) || `Bet #${index + 1}`;
          return (
            <TouchableOpacity
              key={`row-${index}-${String(row._id || row.id || row.userId || '')}`}
              style={styles.card}
              activeOpacity={0.75}
              onPress={() => setSheetRow(row)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardIndex}>#{index + 1}</Text>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {title}
                </Text>
                {image ? (
                  <TouchableOpacity
                    style={styles.viewImageBtn}
                    activeOpacity={0.8}
                    onPress={() => setPreviewImage(image.uri)}
                  >
                    <Text style={styles.viewImageBtnText}>View Image</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {fields.map((f) => (
                <View key={f.key} style={styles.cardRow}>
                  <Text style={styles.cardLabel}>{f.label}</Text>
                  <Text style={styles.cardValue} numberOfLines={3}>
                    {f.value}
                  </Text>
                </View>
              ))}
            </TouchableOpacity>
          );
        })}
      </View>

      <RowDetailSheet
        visible={Boolean(sheetRow)}
        title="Fraud Bet"
        fields={sheetFields}
        actions={
          sheetImage
            ? [
                {
                  label: 'View Image',
                  tone: 'primary',
                  onPress: () => {
                    const uri = sheetImage.uri;
                    setSheetRow(null);
                    setTimeout(() => setPreviewImage(uri), 250);
                  },
                },
              ]
            : undefined
        }
        onClose={() => setSheetRow(null)}
      />

      <Modal
        visible={Boolean(previewImage)}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}
      >
        <View style={styles.previewBackdrop}>
          <TouchableWithoutFeedback onPress={() => setPreviewImage(null)}>
            <View style={styles.previewTouch} />
          </TouchableWithoutFeedback>
          <View style={styles.previewCard}>
            <TouchableOpacity
              style={styles.previewClose}
              onPress={() => setPreviewImage(null)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.previewCloseText}>✕</Text>
            </TouchableOpacity>
            {previewImage ? (
              <Image
                source={{ uri: previewImage }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            ) : null}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1), marginBottom: spacing(3) },
  filterCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing(3),
    gap: spacing(2),
    marginBottom: spacing(3),
  },
  datesRow: { flexDirection: 'row', gap: spacing(2) },
  dateField: { flex: 1, minWidth: 0 },
  fieldLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: spacing(1),
  },
  dateInput: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    fontSize: 14,
  },
  chipRow: { flexDirection: 'row', gap: spacing(2), alignItems: 'center', paddingVertical: 2 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    backgroundColor: colors.surfaceAlt,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { color: colors.foreground, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.primaryForeground },
  actionRow: { flexDirection: 'row', marginTop: spacing(1) },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
    alignItems: 'center',
  },
  btnFlex: { flex: 1 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  error: { color: colors.destructive, fontSize: 12, marginTop: spacing(1) },
  hint: { color: colors.muted, marginBottom: spacing(2) },
  list: { gap: spacing(3) },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
    gap: spacing(1.5),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    marginBottom: spacing(1),
  },
  cardIndex: {
    color: colors.primaryForeground,
    backgroundColor: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: spacing(2),
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  cardTitle: { color: colors.foreground, fontSize: 15, fontWeight: '700', flex: 1, minWidth: 0 },
  viewImageBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1.5),
    flexShrink: 0,
  },
  viewImageBtnText: {
    color: colors.primaryForeground,
    fontSize: 11,
    fontWeight: '700',
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing(2),
    paddingVertical: 2,
  },
  cardLabel: { color: colors.muted, fontSize: 12, fontWeight: '600', width: '38%' },
  cardValue: { color: colors.foreground, fontSize: 12, flex: 1, textAlign: 'right' },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: spacing(4),
  },
  previewTouch: { ...StyleSheet.absoluteFillObject },
  previewCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing(3),
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewClose: { alignSelf: 'flex-end', marginBottom: spacing(2) },
  previewCloseText: { color: colors.foreground, fontSize: 18, fontWeight: '700' },
  previewImage: { width: '100%', height: 360 },
});
