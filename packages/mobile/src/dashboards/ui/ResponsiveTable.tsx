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
 *
 * Pass `virtualized` to use FlatList as the scroll root (do not wrap in
 * ScrollView). Use `listHeaderComponent` / `listFooterComponent` for filters
 * and pagers.
 */
import React, { memo, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type ListRenderItemInfo,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors } from '../../theme';
import { toDisplayText } from '../jyotish/jyotishMapping';
import { DataTable, type DataTableColumn } from './DataTable';
import { RowDetailSheet, type SheetField } from '../../screens/dashboards/details/RowDetailSheet';
import { styles } from './ResponsiveTable.styles';

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
  getSheetActions?: (
    row: Row,
    index: number,
  ) => {
    label: string;
    onPress: () => void;
    tone?: 'primary' | 'warning' | 'danger' | 'default';
  }[];
  /** Always use cards, even on tablet. */
  forceCards?: boolean;
  /**
   * `preview` (default): title + preview fields, tap opens a sheet.
   * `full`: every column as label/value on the card (no sheet).
   */
  cardLayout?: 'preview' | 'full';
  /** How many columns (after title) to show on compact cards. Default 2. */
  previewFieldCount?: number;
  /** Optional status/badge shown on the right side of each phone card. */
  getCardBadge?: (row: Row, index: number) => { text: string; color?: string } | null | undefined;
  /** Optional control beside the card title (e.g. withdrawal MID report icon). */
  renderCardTitleSuffix?: (row: Row, index: number) => React.ReactNode;
  /**
   * Use FlatList as the scroll root. Do not wrap this table in a ScrollView.
   * Pair with listHeaderComponent / listFooterComponent for filters & pagers.
   */
  virtualized?: boolean;
  listHeaderComponent?: React.ReactElement | null;
  listFooterComponent?: React.ReactElement | null;
  refreshControl?: React.ReactElement<React.ComponentProps<typeof RefreshControl>>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
};

export function ResponsiveTable<Row>(props: Props<Row>) {
  const { width } = useWindowDimensions();
  if (!props.forceCards && width >= TABLET_MIN_WIDTH) {
    if (props.virtualized) {
      return (
        <FlatList
          style={props.style}
          contentContainerStyle={props.contentContainerStyle}
          data={[{ key: 'table' }]}
          keyExtractor={(item) => item.key}
          refreshControl={props.refreshControl}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={props.listHeaderComponent ?? undefined}
          ListFooterComponent={
            <>
              <DataTable {...props} />
              {props.listFooterComponent}
            </>
          }
          renderItem={() => null}
        />
      );
    }
    return <DataTable {...props} />;
  }
  return <CardList {...props} />;
}

type CardRowProps<Row> = {
  row: Row;
  index: number;
  columns: DataTableColumn<Row>[];
  fullCards: boolean;
  previewFieldCount: number;
  onRowPress?: (row: Row, index: number) => void;
  openSheet: (row: Row, index: number) => void;
  rowBg?: (row: Row) => string | undefined;
  renderCardFooter?: (row: Row, index: number) => React.ReactNode;
  getCardBadge?: (row: Row, index: number) => { text: string; color?: string } | null | undefined;
  renderCardTitleSuffix?: (row: Row, index: number) => React.ReactNode;
};

function CardRowInner<Row>({
  row,
  index,
  columns,
  fullCards,
  previewFieldCount,
  onRowPress,
  openSheet,
  rowBg,
  renderCardFooter,
  getCardBadge,
  renderCardTitleSuffix,
}: CardRowProps<Row>) {
  const [titleCol, ...restCols] = columns;
  const dataCols = columns.filter((col) => !col.onCellPress);
  const actionCols = columns.filter((col) => col.onCellPress);
  const previewCols = restCols
    .filter((col) => !col.onCellPress)
    .slice(0, Math.max(0, previewFieldCount));
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
      <View style={[styles.card, bg ? { backgroundColor: bg } : null]}>
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
                style={[styles.fieldValue, col.color?.(row) ? { color: col.color(row) } : null]}
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

  const badge = getCardBadge?.(row, index);
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
      <View style={styles.titleRow}>
        <View style={styles.titleWithSuffix}>
          <Text
            style={[
              styles.cardTitle,
              styles.cardTitleFlex,
              titleCol.color?.(row) ? { color: titleCol.color(row) } : null,
            ]}
            numberOfLines={2}
          >
            {titleValue}
          </Text>
          {renderCardTitleSuffix?.(row, index)}
        </View>
        {badge ? (
          <View style={[styles.statusPill, badge.color ? { backgroundColor: badge.color } : null]}>
            <Text style={styles.statusPillText} numberOfLines={1}>
              {toDisplayText(badge.text)}
            </Text>
          </View>
        ) : null}
      </View>
      {previewCols.length > 0 ? (
        <View style={styles.metaRow}>
          {previewCols.map((col) => (
            <View key={col.key} style={styles.metaItem}>
              <Text style={styles.metaLabel} numberOfLines={1}>
                {toDisplayText(col.label)}
              </Text>
              <Text
                style={[styles.metaValue, col.color?.(row) ? { color: col.color(row) } : null]}
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
      style={[styles.card, styles.cardCompact, bg ? { backgroundColor: bg } : null]}
      onPress={() => (onRowPress ? onRowPress(row, index) : openSheet(row, index))}
      activeOpacity={0.88}
    >
      {body}
      {extras}
    </TouchableOpacity>
  );
}

const CardRow = memo(CardRowInner) as typeof CardRowInner;

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
  getCardBadge,
  renderCardTitleSuffix,
  cardLayout = 'preview',
  previewFieldCount = 2,
  virtualized,
  listHeaderComponent,
  listFooterComponent,
  refreshControl,
  contentContainerStyle,
  style,
  hint,
}: Props<Row>) {
  const [sheetRow, setSheetRow] = React.useState<{ row: Row; index: number } | null>(null);
  const fullCards = cardLayout === 'full';
  const openSheet = useCallback((row: Row, index: number) => setSheetRow({ row, index }), []);

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

  const [titleCol] = columns;
  const actionCols = columns.filter((col) => col.onCellPress);

  const renderCard = useCallback(
    ({ item, index }: ListRenderItemInfo<Row>) => (
      <CardRow
        row={item}
        index={index}
        columns={columns}
        fullCards={fullCards}
        previewFieldCount={previewFieldCount}
        onRowPress={onRowPress}
        openSheet={openSheet}
        rowBg={rowBg}
        renderCardFooter={renderCardFooter}
        getCardBadge={getCardBadge}
        renderCardTitleSuffix={renderCardTitleSuffix}
      />
    ),
    [
      columns,
      fullCards,
      previewFieldCount,
      onRowPress,
      openSheet,
      rowBg,
      renderCardFooter,
      getCardBadge,
      renderCardTitleSuffix,
    ],
  );

  const keyExtractor = useCallback(
    (row: Row, index: number) => keyFor(row, index),
    [keyFor],
  );

  const emptyOrLoading =
    loading && rows.length === 0 ? (
      <View style={styles.stateCard}>
        <ActivityIndicator style={styles.spinner} color={colors.primary} />
      </View>
    ) : rows.length === 0 ? (
      <View style={styles.stateCard}>
        <Text style={styles.empty}>{toDisplayText(emptyMessage)}</Text>
      </View>
    ) : null;

  const footerBlock = (
    <>
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
      {hint && rows.length > 0 ? <Text style={styles.listHint}>{toDisplayText(hint)}</Text> : null}
      {listFooterComponent}
    </>
  );

  const sheet = fullCards ? null : (
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
  );

  if (virtualized) {
    return (
      <>
        <FlatList
          style={style}
          contentContainerStyle={[styles.list, contentContainerStyle]}
          data={emptyOrLoading ? [] : rows}
          keyExtractor={keyExtractor}
          renderItem={renderCard}
          ListHeaderComponent={
            <>
              {listHeaderComponent}
              {emptyOrLoading}
            </>
          }
          ListFooterComponent={footerBlock}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          windowSize={7}
          maxToRenderPerBatch={8}
          initialNumToRender={10}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews={Platform.OS === 'android'}
        />
        {sheet}
      </>
    );
  }

  if (emptyOrLoading) {
    return emptyOrLoading;
  }

  return (
    <View style={styles.list}>
      {rows.map((row, index) => (
        <CardRow
          key={keyFor(row, index)}
          row={row}
          index={index}
          columns={columns}
          fullCards={fullCards}
          previewFieldCount={previewFieldCount}
          onRowPress={onRowPress}
          openSheet={openSheet}
          rowBg={rowBg}
          renderCardFooter={renderCardFooter}
          getCardBadge={getCardBadge}
          renderCardTitleSuffix={renderCardTitleSuffix}
        />
      ))}
      {footerBlock}
      {sheet}
    </View>
  );
}
