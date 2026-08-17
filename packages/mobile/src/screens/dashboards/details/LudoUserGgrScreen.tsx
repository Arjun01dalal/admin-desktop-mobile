/** Laxmi-compatible Ludo user GGR-by-round report. */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { secureApi } from '../../../api/client';
import { parseLudoGameOptions } from '../../../dashboards/gameMetrics';
import { toNum } from '../../../dashboards/mergeMetrics';
import { toDisplayText } from '../../../dashboards/jyotish/jyotishMapping';
import {
  DataTable,
  type DataTableColumn,
} from '../../../dashboards/ui/DataTable';
import { colors, radius, spacing } from '../../../theme';
import { todayIST } from '../../../utils/dates';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

type GgrType = 'plus' | 'minus';
type ReportRow = Record<string, unknown>;
type GameOption = { value: string; label: string };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseResponse(raw: unknown): {
  rows: ReportRow[];
  summary: Record<string, unknown> | null;
} {
  if (Array.isArray(raw)) return { rows: raw as ReportRow[], summary: null };

  const payload = asRecord(raw);
  const rows = ['data', 'users', 'rounds', 'list'].reduce<ReportRow[]>(
    (found, key) =>
      found.length || !Array.isArray(payload[key])
        ? found
        : (payload[key] as ReportRow[]),
    [],
  );
  return {
    rows,
    summary:
      payload.summary &&
      typeof payload.summary === 'object' &&
      !Array.isArray(payload.summary)
        ? (payload.summary as Record<string, unknown>)
        : null,
  };
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return value.toLocaleString('en-IN');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function labelFor(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isPrimitive(value: unknown): boolean {
  return value === null || typeof value !== 'object';
}

function resolveGameId(
  preferred: string | undefined,
  options: GameOption[],
): string {
  if (preferred && preferred !== 'All') return preferred;
  return options[0]?.value || '';
}

export function LudoUserGgrScreen() {
  const params = (useRoute().params ?? {}) as Record<string, unknown>;
  const initialDate =
    typeof params.date === 'string'
      ? params.date
      : typeof params.startDate === 'string'
        ? params.startDate
        : todayIST();
  const paramGameId =
    typeof params.gameId === 'string' ? params.gameId : 'All';
  const initialGgr: GgrType = params.ggr === 'minus' ? 'minus' : 'plus';
  const initialOptions = Array.isArray(params.gameOptions)
    ? (params.gameOptions as GameOption[])
        .map((option) => ({
          value: String(option.value ?? ''),
          label: String(option.label ?? option.value ?? ''),
        }))
        .filter((option) => option.value && option.value !== 'All')
    : [];

  const [draftDate, setDraftDate] = useState(initialDate);
  const [date, setDate] = useState(initialDate);
  const [gameOptions, setGameOptions] = useState<GameOption[]>(initialOptions);
  const [draftGameId, setDraftGameId] = useState(
    resolveGameId(paramGameId, initialOptions),
  );
  const [gameId, setGameId] = useState(
    resolveGameId(paramGameId, initialOptions),
  );
  const [draftGgr, setDraftGgr] = useState<GgrType>(initialGgr);
  const [ggr, setGgr] = useState<GgrType>(initialGgr);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [selected, setSelected] = useState<ReportRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGameOptions = useCallback(async () => {
    if (gameOptions.length) return gameOptions;
    const res = await secureApi('dashboard.ludoGameIds', {});
    if (!res.ok) return [] as GameOption[];
    const options = parseLudoGameOptions(res.data).filter(
      (option) => option.value && option.value !== 'All',
    );
    setGameOptions(options);
    return options;
  }, [gameOptions]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const options = await loadGameOptions();
      const resolvedGameId = resolveGameId(gameId, options);
      if (!resolvedGameId) {
        setError('gameId is required — select a Ludo game');
        setRows([]);
        setSummary(null);
        return;
      }
      if (resolvedGameId !== gameId) {
        setGameId(resolvedGameId);
        setDraftGameId(resolvedGameId);
      }

      // Backend requires a concrete gameId (All is not accepted).
      const res = await secureApi('dashboard.ludoUserGgrByRound', {
        date,
        ggr,
        gameId: resolvedGameId,
      });
      if (!res.ok || res.success === false) {
        setError(res.message || 'Failed to load Ludo user GGR');
        setRows([]);
        setSummary(null);
        return;
      }

      const parsed = parseResponse(res.data);
      setRows(parsed.rows);
      setSummary(parsed.summary);
    } finally {
      setLoading(false);
    }
  }, [date, gameId, ggr, loadGameOptions]);

  useEffect(() => {
    void load();
  }, [load]);

  const columnKeys = useMemo(() => {
    const first = rows[0];
    if (!first) return [];
    return Object.keys(first).filter((key) => isPrimitive(first[key]));
  }, [rows]);

  const columns = useMemo<DataTableColumn<ReportRow>[]>(
    () =>
      columnKeys.map((key) => ({
        key,
        label: labelFor(key),
        width: key.toLowerCase().includes('name') ? 140 : 110,
        align:
          typeof rows[0]?.[key] === 'number'
            ? ('right' as const)
            : ('left' as const),
        render: (row: ReportRow) => displayValue(row[key]),
        color: key.toLowerCase() === 'ggr'
          ? (row: ReportRow) =>
              toNum(row[key]) < 0 ? colors.destructive : colors.success
          : undefined,
      })),
    [columnKeys, rows],
  );

  const compactColumns = useMemo(() => {
    const preferred = ['name', 'userName', 'userId', 'ggr'];
    const picked = preferred
      .map((key) => columns.find((column) => column.key === key))
      .filter(Boolean) as DataTableColumn<ReportRow>[];
    return picked.length >= 2 ? picked.slice(0, 3) : columns.slice(0, 3);
  }, [columns]);

  const sheetFields = useMemo<SheetField[]>(() => {
    if (!selected) return [];
    return columns.map((column) => ({
      label: column.label,
      value: column.render(selected, rows.indexOf(selected)),
      color: column.color?.(selected),
    }));
  }, [columns, rows, selected]);

  const selectedLabel =
    gameOptions.find((option) => option.value === gameId)?.label || gameId;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => void load()}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={styles.title}>{toDisplayText('Ludo User GGR By Round')}</Text>
      <Text style={styles.sub}>
        {date} · {selectedLabel || 'Select game'} ·{' '}
        {ggr === 'plus' ? 'Positive GGR' : 'Negative GGR'}
      </Text>

      <DetailFilterBar
        startDate={draftDate}
        endDate={draftDate}
        loading={loading}
        onStartDateChange={setDraftDate}
        onEndDateChange={setDraftDate}
        onApply={() => {
          if (!draftGameId) {
            setError('gameId is required — select a Ludo game');
            return;
          }
          setDate(draftDate);
          setGameId(draftGameId);
          setGgr(draftGgr);
        }}
      />

      <Text style={styles.filterLabel}>Game</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {gameOptions.length ? (
          gameOptions.map((option) => {
            const active = gameId === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => {
                  if (option.value === gameId) return;
                  setDraftGameId(option.value);
                  setGameId(option.value);
                }}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })
        ) : (
          <Text style={styles.emptyChip}>No game IDs available</Text>
        )}
      </ScrollView>

      <Text style={styles.filterLabel}>GGR</Text>
      <View style={styles.chips}>
        {(['plus', 'minus'] as const).map((type) => {
          const active = ggr === type;
          return (
            <TouchableOpacity
              key={type}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => {
                if (type === ggr) return;
                setDraftGgr(type);
                setGgr(type);
              }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {type === 'plus' ? 'Plus' : 'Minus'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {summary ? (
        <View style={styles.summary}>
          {Object.entries(summary).map(([key, value]) => (
            <View key={key} style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{labelFor(key)}</Text>
              <Text style={styles.summaryValue}>{displayValue(value)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loaderText}>Loading…</Text>
        </View>
      ) : (
        <DataTable
          columns={compactColumns}
          rows={rows}
          keyFor={(row, index) =>
            String(row._id ?? row.userId ?? row.roundId ?? index)
          }
          emptyMessage="No Ludo GGR users found"
          onRowPress={setSelected}
          hint="Tap a row to see all details"
        />
      )}

      <RowDetailSheet
        visible={selected !== null}
        title={String(
          selected?.name ?? selected?.userName ?? selected?.userId ?? 'Details',
        )}
        fields={sheetFields}
        onClose={() => setSelected(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: {
    color: colors.muted,
    fontSize: 13,
    marginTop: spacing(1),
    marginBottom: spacing(3),
  },
  filterLabel: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: spacing(1),
  },
  chips: {
    flexDirection: 'row',
    gap: spacing(2),
    marginBottom: spacing(3),
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.foreground, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.primaryForeground },
  emptyChip: { color: colors.muted, fontSize: 12 },
  summary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginBottom: spacing(3),
  },
  summaryItem: {
    width: '48%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
  },
  summaryLabel: { color: colors.muted, fontSize: 11 },
  summaryValue: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: '700',
    marginTop: spacing(1),
  },
  error: { color: colors.destructive, fontSize: 13, marginBottom: spacing(3) },
  loaderWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing(10),
    gap: spacing(2),
  },
  loaderText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
});
