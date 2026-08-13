/**
 * Horizontally scrollable data table showing every desktop column.
 * Columns use fixed widths; the whole table (header + rows) scrolls sideways
 * together. Intended for page-sized data (≤ ~50 rows per page).
 */
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radius, spacing } from '../../theme';
import { toDisplayText } from '../jyotish/jyotishMapping';

export type DataTableColumn<Row> = {
  key: string;
  label: string;
  width: number;
  align?: 'left' | 'right' | 'center';
  render: (row: Row, index: number) => string;
  /** Optional value color (e.g. red for negative GGR). */
  color?: (row: Row) => string | undefined;
  /** Renders the cell as a colored pill (web-style status badge). Returns the badge background. */
  badge?: (row: Row) => string | undefined;
  /** Optional second line under the value (e.g. call duration / "Recording"). */
  subtext?: (row: Row) => string | undefined;
  /** Makes the cell tappable (e.g. provider drill-down). */
  onCellPress?: (row: Row) => void;
  /** Makes the header tappable (sorting). */
  onHeaderPress?: () => void;
  /** Optional per-column filter control shown in a row under the header. */
  filter?: React.ReactNode;
};

type Props<Row> = {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  keyFor: (row: Row, index: number) => string;
  loading?: boolean;
  emptyMessage?: string;
  /** Optional pinned footer row (e.g. totals). */
  footer?: { label: string; cells: Record<string, string> };
  /** Makes whole rows tappable (e.g. open a detail sheet). */
  onRowPress?: (row: Row, index: number) => void;
  /** Optional per-row background color (e.g. highlight risky rows). */
  rowBg?: (row: Row) => string | undefined;
  /** Hint text under the table. */
  hint?: string;
};

export function DataTable<Row>({
  columns,
  rows,
  keyFor,
  loading,
  emptyMessage = 'No data',
  footer,
  onRowPress,
  rowBg,
  hint,
}: Props<Row>) {
  // Only enable horizontal scrolling when the table is actually wider than the
  // card. When everything fits (e.g. a 1-2 column list), a live horizontal
  // ScrollView eats taps — any tiny finger movement cancels the row press,
  // making rows feel randomly untappable.
  const [containerW, setContainerW] = React.useState(0);
  const contentW = columns.reduce((sum, c) => sum + c.width, 0);
  const innerW = Math.max(0, containerW - spacing(3) * 2);
  const needsHScroll = contentW > innerW + 1;
  const table = (
    <View>
          <View style={[styles.row, styles.headRow]}>
            {columns.map((col) =>
              col.onHeaderPress ? (
                <TouchableOpacity
                  key={col.key}
                  onPress={col.onHeaderPress}
                  style={{ width: col.width }}
                >
                  <Text
                    style={[styles.headText, col.align === 'right' && styles.right, col.align === 'center' && styles.center]}
                    numberOfLines={2}
                  >
                    {toDisplayText(col.label)}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text
                  key={col.key}
                  style={[
                    styles.headText,
                    { width: col.width },
                    col.align === 'right' && styles.right,
                    col.align === 'center' && styles.center,
                  ]}
                  numberOfLines={2}
                >
                  {toDisplayText(col.label)}
                </Text>
              ),
            )}
          </View>

          {columns.some((c) => c.filter != null) ? (
            <View style={[styles.row, styles.filterRow]}>
              {columns.map((col) => (
                <View key={col.key} style={[styles.filterCell, { width: col.width }]}>
                  {col.filter ?? null}
                </View>
              ))}
            </View>
          ) : null}

          {loading && rows.length === 0 ? (
            <ActivityIndicator style={styles.spinner} color={colors.primary} />
          ) : rows.length === 0 ? (
            <Text style={styles.empty}>{toDisplayText(emptyMessage)}</Text>
          ) : (
            rows.map((row, index) => {
              const cells = columns.map((col) => {
                  const value = toDisplayText(col.render(row, index));
                  const color = col.color?.(row);
                  const badgeBg = col.badge?.(row);
                  const sub = col.subtext?.(row);
                  const subMapped = sub ? toDisplayText(sub) : undefined;
                  const textStyle = [
                    styles.cell,
                    { width: col.width },
                    col.align === 'right' && styles.right,
                    col.align === 'center' && styles.center,
                    color ? { color, fontWeight: '700' as const } : null,
                  ];
                  if (badgeBg) {
                    return (
                      <View key={col.key} style={[styles.badgeCell, { width: col.width }]}>
                        <View style={[styles.badge, { backgroundColor: badgeBg }]}>
                          <Text style={styles.badgeText} numberOfLines={1}>
                            {value}
                          </Text>
                          {subMapped ? (
                            <Text style={styles.badgeSub} numberOfLines={1}>
                              {subMapped}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    );
                  }
                  if (col.onCellPress) {
                    return (
                      <TouchableOpacity
                        key={col.key}
                        onPress={() => col.onCellPress?.(row)}
                        style={{ width: col.width }}
                      >
                        <Text
                          style={[textStyle, styles.link, { width: undefined }, color ? { color } : null]}
                          numberOfLines={2}
                        >
                          {value}
                        </Text>
                      </TouchableOpacity>
                    );
                  }
                  return (
                    <Text key={col.key} style={textStyle} numberOfLines={1}>
                      {value}
                    </Text>
                  );
                });
              const bg = rowBg?.(row);
              const rowStyle = [styles.row, bg ? { backgroundColor: bg } : null];
              if (onRowPress) {
                return (
                  <Pressable
                    key={keyFor(row, index)}
                    style={rowStyle}
                    onPress={() => onRowPress(row, index)}
                    delayPressIn={0}
                    unstable_pressDelay={0}
                  >
                    {cells}
                  </Pressable>
                );
              }
              return (
                <View key={keyFor(row, index)} style={rowStyle}>
                  {cells}
                </View>
              );
            })
          )}

          {footer && rows.length > 0 ? (
            <View style={[styles.row, styles.footerRow]}>
              {columns.map((col, i) => (
                <Text
                  key={col.key}
                  style={[
                    styles.headText,
                    { width: col.width },
                    col.align === 'right' && styles.right,
                    col.align === 'center' && styles.center,
                  ]}
                  numberOfLines={1}
                >
                  {i === 0 ? toDisplayText(footer.label) : toDisplayText(footer.cells[col.key] ?? '')}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
  );

  return (
    <View style={styles.card} onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}>
      {needsHScroll ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          keyboardShouldPersistTaps="handled"
        >
          {table}
        </ScrollView>
      ) : (
        <View style={styles.tableClip}>{table}</View>
      )}
      <Text style={styles.hint}>{hint ?? (needsHScroll ? 'Swipe sideways to see all columns →' : '')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing(3),
    marginTop: spacing(3),
    overflow: 'hidden',
  },
  tableClip: { overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing(2),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    overflow: 'hidden',
  },
  headRow: { borderBottomColor: colors.primary },
  badgeCell: { paddingHorizontal: spacing(0.5) },
  badge: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1),
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  badgeSub: { color: '#fff', fontSize: 10, opacity: 0.9 },
  filterRow: { paddingVertical: spacing(1) },
  filterCell: { paddingHorizontal: spacing(0.5) },
  footerRow: { borderBottomWidth: 0, borderTopWidth: 1, borderTopColor: colors.primary },
  headText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
    paddingHorizontal: spacing(1),
  },
  cell: { color: colors.foreground, fontSize: 12, paddingHorizontal: spacing(1), overflow: 'hidden' },
  right: { textAlign: 'right' },
  center: { textAlign: 'center' },
  link: { color: colors.primary, textDecorationLine: 'underline' },
  spinner: { marginVertical: spacing(6) },
  empty: { color: colors.muted, textAlign: 'center', marginVertical: spacing(6) },
  hint: { color: colors.muted, fontSize: 10, textAlign: 'center', marginTop: spacing(2) },
});
