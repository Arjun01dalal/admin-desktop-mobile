/**
 * Shared responsive wrapper around DataTable.
 *
 * - Tablet / wide screens (>= 768px): renders the regular horizontal DataTable
 *   (columns fit comfortably, desktop parity).
 * - Phones (< 768px): renders each row as a vertical card with label:value
 *   pairs — no sideways scrolling needed.
 *
 * Accepts the exact same props as DataTable, so screens can swap
 * `<DataTable .../>` for `<ResponsiveTable .../>` with no other change.
 */
import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { colors, radius, spacing } from '../../theme';
import { toDisplayText } from '../jyotish/jyotishMapping';
import { DataTable, type DataTableColumn } from './DataTable';

const TABLET_MIN_WIDTH = 768;

type Props<Row> = {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  keyFor: (row: Row, index: number) => string;
  loading?: boolean;
  emptyMessage?: string;
  footer?: { label: string; cells: Record<string, string> };
  onRowPress?: (row: Row, index: number) => void;
  rowBg?: (row: Row) => string | undefined;
  hint?: string;
};

export function ResponsiveTable<Row>(props: Props<Row>) {
  const { width } = useWindowDimensions();
  if (width >= TABLET_MIN_WIDTH) {
    return <DataTable {...props} />;
  }
  return <CardList {...props} />;
}

function CardList<Row>({
  columns,
  rows,
  keyFor,
  loading,
  emptyMessage = 'No data',
  footer,
  onRowPress,
  rowBg,
}: Props<Row>) {
  if (loading && rows.length === 0) {
    return (
      <View style={styles.stateCard}>
        <ActivityIndicator style={styles.spinner} color={colors.primary} />
      </View>
    );
  }
  if (rows.length === 0) {
    return (
      <View style={styles.stateCard}>
        <Text style={styles.empty}>{toDisplayText(emptyMessage)}</Text>
      </View>
    );
  }

  const [titleCol, ...restCols] = columns;

  return (
    <View style={styles.list}>
      {rows.map((row, index) => {
        const bg = rowBg?.(row);
        const titleValue = toDisplayText(titleCol.render(row, index));
        const body = (
          <>
            <View style={styles.cardHead}>
              <View style={styles.cardHeadLeft}>
                <Text style={styles.cardHeadLabel}>{toDisplayText(titleCol.label)}</Text>
                {titleCol.onCellPress ? (
                  <TouchableOpacity onPress={() => titleCol.onCellPress?.(row)}>
                    <Text style={[styles.cardTitle, styles.link]} numberOfLines={2}>
                      {titleValue}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text
                    style={[styles.cardTitle, titleCol.color?.(row) ? { color: titleCol.color(row) } : null]}
                    numberOfLines={2}
                  >
                    {titleValue}
                  </Text>
                )}
              </View>
              <Text style={styles.rowNo}>#{index + 1}</Text>
            </View>
            <View style={styles.fieldGrid}>
              {restCols.map((col) => {
                const value = toDisplayText(col.render(row, index));
                const color = col.color?.(row);
                const badgeBg = col.badge?.(row);
                const sub = col.subtext?.(row);
                return (
                  <View key={col.key} style={styles.field}>
                    <Text style={styles.fieldLabel} numberOfLines={1}>
                      {toDisplayText(col.label)}
                    </Text>
                    {badgeBg ? (
                      <View style={[styles.badge, { backgroundColor: badgeBg }]}>
                        <Text style={styles.badgeText} numberOfLines={1}>
                          {value}
                        </Text>
                      </View>
                    ) : col.onCellPress ? (
                      <TouchableOpacity onPress={() => col.onCellPress?.(row)}>
                        <Text style={[styles.fieldValue, styles.link]} numberOfLines={3}>
                          {value}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <Text
                        style={[styles.fieldValue, color ? { color, fontWeight: '700' } : null]}
                        numberOfLines={3}
                      >
                        {value}
                      </Text>
                    )}
                    {sub ? (
                      <Text style={styles.fieldSub} numberOfLines={1}>
                        {toDisplayText(sub)}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </>
        );
        const cardStyle = [styles.card, bg ? { backgroundColor: bg } : null];
        if (onRowPress) {
          return (
            <TouchableOpacity
              key={keyFor(row, index)}
              style={cardStyle}
              onPress={() => onRowPress(row, index)}
            >
              {body}
            </TouchableOpacity>
          );
        }
        return (
          <View key={keyFor(row, index)} style={cardStyle}>
            {body}
          </View>
        );
      })}

      {footer && rows.length > 0 ? (
        <View style={[styles.card, styles.footerCard]}>
          <Text style={styles.cardTitle}>{toDisplayText(footer.label)}</Text>
          <View style={styles.fieldGrid}>
            {columns
              .filter((col) => footer.cells[col.key] != null && footer.cells[col.key] !== '')
              .map((col) => (
                <View key={col.key} style={styles.field}>
                  <Text style={styles.fieldLabel} numberOfLines={1}>
                    {toDisplayText(col.label)}
                  </Text>
                  <Text style={styles.fieldValue} numberOfLines={2}>
                    {toDisplayText(footer.cells[col.key] ?? '')}
                  </Text>
                </View>
              ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: spacing(3), gap: spacing(2) },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
  },
  footerCard: { borderColor: colors.primary },
  stateCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing(2),
  },
  cardHeadLeft: { flex: 1, paddingRight: spacing(2) },
  cardHeadLabel: { color: colors.muted, fontSize: 10, marginBottom: 2 },
  cardTitle: { color: colors.foreground, fontSize: 13, fontWeight: '700' },
  rowNo: { color: colors.muted, fontSize: 11 },
  fieldGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  field: { width: '50%', paddingRight: spacing(2), marginBottom: spacing(2) },
  fieldLabel: { color: colors.muted, fontSize: 10, marginBottom: 2 },
  fieldValue: { color: colors.foreground, fontSize: 12 },
  fieldSub: { color: colors.muted, fontSize: 10, marginTop: 1 },
  badge: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(0.5),
    alignSelf: 'flex-start',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  link: { color: colors.primary, textDecorationLine: 'underline' },
  spinner: { marginVertical: spacing(4) },
  empty: { color: colors.muted, textAlign: 'center', marginVertical: spacing(4) },
});
