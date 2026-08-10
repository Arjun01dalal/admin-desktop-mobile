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
import { RowDetailSheet, type SheetField } from '../../screens/dashboards/details/RowDetailSheet';

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
  const [sheetRow, setSheetRow] = React.useState<{ row: Row; index: number } | null>(null);

  const openSheet = (row: Row, index: number) => setSheetRow({ row, index });

  const sheetFields: SheetField[] = React.useMemo(() => {
    if (!sheetRow) return [];
    const { row, index } = sheetRow;
    return columns.slice(1).map((col) => ({
      label: toDisplayText(col.label),
      value: toDisplayText(col.render(row, index)),
      color: col.color?.(row),
      badgeColor: col.badge?.(row),
    }));
  }, [sheetRow, columns]);

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
  // Compact card shows the title plus a couple of key fields; the full field
  // set opens in a bottom sheet on tap.
  const previewCols = restCols.slice(0, 2);

  return (
    <View style={styles.list}>
      {rows.map((row, index) => {
        const bg = rowBg?.(row);
        const titleValue = toDisplayText(titleCol.render(row, index));
        const body = (
          <View style={styles.cardRow}>
            <View style={styles.cardMain}>
              {titleCol.onCellPress ? (
                <TouchableOpacity onPress={() => titleCol.onCellPress?.(row)}>
                  <Text style={[styles.cardTitle, styles.link]} numberOfLines={1}>
                    {titleValue}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text
                  style={[styles.cardTitle, titleCol.color?.(row) ? { color: titleCol.color(row) } : null]}
                  numberOfLines={1}
                >
                  {titleValue}
                </Text>
              )}
              <Text style={styles.cardSub} numberOfLines={1}>
                {previewCols
                  .map((col) => `${toDisplayText(col.label)}: ${toDisplayText(col.render(row, index))}`)
                  .join('  ·  ')}
              </Text>
            </View>
            <View style={styles.cardRight}>
              {(() => {
                const badgeCol = restCols.find((c) => c.badge?.(row));
                if (badgeCol) {
                  return (
                    <View style={[styles.badge, { backgroundColor: badgeCol.badge?.(row) }]}>
                      <Text style={styles.badgeText} numberOfLines={1}>
                        {toDisplayText(badgeCol.render(row, index))}
                      </Text>
                    </View>
                  );
                }
                const colorCol = restCols.find((c) => c.color?.(row));
                if (colorCol) {
                  return (
                    <Text style={[styles.cardTitle, { color: colorCol.color?.(row) }]} numberOfLines={1}>
                      {toDisplayText(colorCol.render(row, index))}
                    </Text>
                  );
                }
                return null;
              })()}
              <Text style={styles.rowNo}>#{index + 1} ›</Text>
            </View>
          </View>
        );
        const cardStyle = [styles.card, bg ? { backgroundColor: bg } : null];
        return (
          <TouchableOpacity
            key={keyFor(row, index)}
            style={cardStyle}
            onPress={() => (onRowPress ? onRowPress(row, index) : openSheet(row, index))}
          >
            {body}
          </TouchableOpacity>
        );
      })}

      <RowDetailSheet
        visible={sheetRow != null}
        title={sheetRow ? toDisplayText(titleCol.render(sheetRow.row, sheetRow.index)) : ''}
        fields={sheetFields}
        onClose={() => setSheetRow(null)}
      />

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
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
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
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardMain: { flex: 1, paddingRight: spacing(2) },
  cardRight: { alignItems: 'flex-end', gap: 2 },
  cardTitle: { color: colors.foreground, fontSize: 13, fontWeight: '700' },
  cardSub: { color: colors.muted, fontSize: 11, marginTop: 2 },
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
