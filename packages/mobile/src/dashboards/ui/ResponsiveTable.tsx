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
  /** Extra controls under each phone card (e.g. Check / Cross Check). */
  renderCardFooter?: (row: Row, index: number) => React.ReactNode;
  /** Sheet actions when a compact card is tapped (e.g. Edit). */
  getSheetActions?: (row: Row, index: number) => { label: string; onPress: () => void; tone?: 'primary' | 'warning' | 'danger' | 'default' }[];
  /** Always use cards, even on tablet. */
  forceCards?: boolean;
  /**
   * `preview` (default): title + 2 fields, tap opens a sheet.
   * `full`: every column as label/value on the card (no sheet).
   */
  cardLayout?: 'preview' | 'full';
};

export function ResponsiveTable<Row>(props: Props<Row>) {
  const { width } = useWindowDimensions();
  if (!props.forceCards && width >= TABLET_MIN_WIDTH) {
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
  renderCardFooter,
  getSheetActions,
  cardLayout = 'preview',
}: Props<Row>) {
  const [sheetRow, setSheetRow] = React.useState<{ row: Row; index: number } | null>(null);
  const fullCards = cardLayout === 'full';

  const openSheet = (row: Row, index: number) => setSheetRow({ row, index });

  const sheetFields: SheetField[] = React.useMemo(() => {
    if (!sheetRow) return [];
    const { row, index } = sheetRow;
    return columns
      .filter((col) => !col.onCellPress)
      .map((col) => ({
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
  const dataCols = columns.filter((col) => !col.onCellPress);
  const actionCols = columns.filter((col) => col.onCellPress);
  const previewCols = restCols.filter((col) => !col.onCellPress).slice(0, 2);

  return (
    <View style={styles.list}>
      {rows.map((row, index) => {
        const bg = rowBg?.(row);
        const titleValue = toDisplayText(titleCol.render(row, index));
        const extras = (
          <>
            {renderCardFooter ? (
              <View style={styles.cardFooter}>{renderCardFooter(row, index)}</View>
            ) : null}
            {fullCards && actionCols.length > 0 ? (
              <View style={styles.actionRow}>
                {actionCols.map((col) => (
                  <TouchableOpacity
                    key={col.key}
                    style={styles.actionBtn}
                    onPress={() => col.onCellPress?.(row)}
                  >
                    <Text style={styles.actionBtnText}>
                      {toDisplayText(col.label)} {toDisplayText(col.render(row, index))}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </>
        );

        if (fullCards) {
          return (
            <View
              key={keyFor(row, index)}
              style={[styles.card, bg ? { backgroundColor: bg } : null]}
            >
              <View style={styles.fullHead}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {titleValue}
                </Text>
                <Text style={styles.rowNo}>#{index + 1}</Text>
              </View>
              <View style={styles.fieldGrid}>
                {dataCols.slice(1).map((col) => (
                  <View key={col.key} style={styles.field}>
                    <Text style={styles.fieldLabel} numberOfLines={1}>
                      {toDisplayText(col.label)}
                    </Text>
                    <Text
                      style={[
                        styles.fieldValue,
                        col.color?.(row) ? { color: col.color(row) } : null,
                      ]}
                      numberOfLines={3}
                    >
                      {toDisplayText(col.render(row, index))}
                    </Text>
                  </View>
                ))}
              </View>
              {extras}
            </View>
          );
        }

        const body = (
          <View>
            <View style={styles.cardTop}>
              <View style={styles.indexPill}>
                <Text style={styles.indexPillText}>#{index + 1}</Text>
              </View>
              {actionCols.length > 0 ? (
                <View style={styles.cardTopActions}>
                  {actionCols.map((col) => (
                    <TouchableOpacity
                      key={col.key}
                      style={styles.editChip}
                      onPress={() => col.onCellPress?.(row)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Text style={styles.editChipText}>✎ Edit</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={styles.cardHint}>Details ›</Text>
              )}
            </View>
            <Text
              style={[styles.cardTitle, titleCol.color?.(row) ? { color: titleCol.color(row) } : null]}
              numberOfLines={2}
            >
              {titleValue}
            </Text>
            {previewCols.length > 0 ? (
              <View style={styles.metaRow}>
                {previewCols.map((col) => (
                  <View key={col.key} style={styles.metaItem}>
                    <Text style={styles.metaLabel} numberOfLines={1}>
                      {toDisplayText(col.label)}
                    </Text>
                    <Text
                      style={[
                        styles.metaValue,
                        col.color?.(row) ? { color: col.color(row) } : null,
                      ]}
                      numberOfLines={1}
                    >
                      {toDisplayText(col.render(row, index))}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        );
        return (
          <TouchableOpacity
            key={keyFor(row, index)}
            style={[styles.card, styles.cardCompact, bg ? { backgroundColor: bg } : null]}
            onPress={() => (onRowPress ? onRowPress(row, index) : openSheet(row, index))}
            activeOpacity={0.88}
          >
            {body}
            {extras}
          </TouchableOpacity>
        );
      })}

      {fullCards ? null : (
        <RowDetailSheet
          visible={sheetRow != null}
          title={sheetRow ? toDisplayText(titleCol.render(sheetRow.row, sheetRow.index)) : ''}
          fields={sheetFields}
          actions={
            sheetRow
              ? [
                  ...(getSheetActions?.(sheetRow.row, sheetRow.index) ?? []).map((a) => ({
                    ...a,
                    onPress: () => {
                      setSheetRow(null);
                      a.onPress();
                    },
                  })),
                  ...actionCols.map((col) => ({
                    label: toDisplayText(col.label),
                    tone: 'primary' as const,
                    onPress: () => {
                      const r = sheetRow.row;
                      setSheetRow(null);
                      col.onCellPress?.(r);
                    },
                  })),
                ]
              : undefined
          }
          onClose={() => setSheetRow(null)}
        />
      )}

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
  list: { marginTop: spacing(2), gap: spacing(2) },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(3),
  },
  cardCompact: {
    paddingVertical: spacing(2.25),
    paddingHorizontal: spacing(3),
  },
  footerCard: { borderColor: colors.primary },
  stateCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing(4),
    marginTop: spacing(3),
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardMain: { flex: 1, paddingRight: spacing(2) },
  cardRight: { alignItems: 'flex-end', gap: spacing(1) },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(1.5),
  },
  cardTopActions: { flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
  indexPill: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(1.5),
    paddingVertical: 3,
  },
  indexPillText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  cardHint: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  cardTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.1,
    marginBottom: spacing(1.5),
  },
  cardSub: { color: colors.muted, fontSize: 11, marginTop: 2 },
  cardFooter: { marginTop: spacing(2) },
  metaRow: {
    flexDirection: 'row',
    gap: spacing(2),
    paddingTop: spacing(0.5),
  },
  metaItem: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1.5),
  },
  metaLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  metaValue: { color: colors.foreground, fontSize: 13, fontWeight: '600' },
  rowNo: { color: colors.muted, fontSize: 11 },
  fieldGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  field: { width: '50%', paddingRight: spacing(2), marginBottom: spacing(2) },
  fieldLabel: { color: colors.muted, fontSize: 10, marginBottom: 2 },
  fieldValue: { color: colors.foreground, fontSize: 12 },
  fieldSub: { color: colors.muted, fontSize: 10, marginTop: 1 },
  fullHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing(2),
    marginBottom: spacing(2),
  },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2), marginTop: spacing(2) },
  actionBtn: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1),
  },
  actionBtnText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  editChip: {
    backgroundColor: `${colors.primary}22`,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1),
  },
  editChipText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  compactEdit: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactEditText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
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
