import { memo, useCallback, useRef, type MouseEvent, type ReactNode } from 'react';
import {
  Box,
  CircularProgress,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  type SxProps,
  type Theme,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useVirtualizer } from '@tanstack/react-virtual';
import { copyToClipboard } from '@/utils/clipboard';

/**
 * Shared table styles.
 * Update this object once to change table UI on every page.
 */
export const commonTableStyles = {
  paper: {
    bgcolor: '#1a1a1f',
    overflow: 'auto',
  } satisfies SxProps<Theme>,
  cell: {
    whiteSpace: 'nowrap',
    fontSize: 13,
    color: '#e8e8ea',
    border: '1px solid rgba(255,255,255,0.14)',
    py: 1.25,
    px: 1.5,
    textAlign: 'center',
  } satisfies SxProps<Theme>,
  /** Column title row */
  head: {
    whiteSpace: 'nowrap',
    fontSize: 13,
    fontWeight: 700,
    color: '#1a1200',
    bgcolor: '#ff9f0a',
    border: '1px solid rgba(0,0,0,0.2)',
    py: 1.25,
    px: 1.5,
    textAlign: 'center',
  } satisfies SxProps<Theme>,
  /** Search / filter row under headers */
  filter: {
    whiteSpace: 'nowrap',
    fontSize: 12,
    color: '#e8e8ea',
    bgcolor: '#2c3340',
    border: '1px solid rgba(255,255,255,0.12)',
    py: 1,
    px: 1.25,
    verticalAlign: 'middle',
    textAlign: 'center',
  } satisfies SxProps<Theme>,
};

/** Light table tone for User Report / Laxmi-style pages. */
export const commonTableStylesLight = {
  paper: {
    bgcolor: '#fff',
    overflow: 'auto',
    border: '1px solid #ddd',
  } satisfies SxProps<Theme>,
  cell: {
    whiteSpace: 'nowrap',
    fontSize: 13,
    color: '#111',
    border: '1px solid #ddd',
    py: 1,
    px: 1.25,
    textAlign: 'center',
    bgcolor: '#fff',
  } satisfies SxProps<Theme>,
  head: {
    whiteSpace: 'nowrap',
    fontSize: 13,
    fontWeight: 700,
    color: '#fff',
    bgcolor: '#ff9f0a',
    border: '1px solid #e08c00',
    py: 1.25,
    px: 1.5,
    textAlign: 'center',
  } satisfies SxProps<Theme>,
  filter: {
    whiteSpace: 'nowrap',
    fontSize: 12,
    color: '#111',
    bgcolor: '#fff',
    border: '1px solid #ddd',
    py: 0.75,
    px: 1,
    verticalAlign: 'middle',
    textAlign: 'center',
  } satisfies SxProps<Theme>,
};

export type CommonTableColumn<T> = {
  id: string;
  label: ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: number | string;
  sortable?: boolean;
  onHeaderClick?: () => void;
  /** Optional filter cell shown in the second header row. */
  filter?: ReactNode;
  render: (row: T, index: number) => ReactNode;
  cellSx?: SxProps<Theme>;
  headSx?: SxProps<Theme>;
};

export type CommonTableProps<T> = {
  columns: CommonTableColumn<T>[];
  rows: T[];
  getRowKey?: (row: T, index: number) => string | number;
  loading?: boolean;
  emptyMessage?: string;
  stickyHeader?: boolean;
  minWidth?: number | string;
  /** Wrap table in the shared Paper shell (default true). */
  paper?: boolean;
  hover?: boolean;
  dense?: boolean;
  size?: 'small' | 'medium';
  onRowClick?: (row: T, index: number) => void;
  /** Optional per-row sx (e.g. status background colors). */
  getRowSx?: (row: T, index: number) => SxProps<Theme> | undefined;
  /**
   * Virtualize body rows for large lists.
   * - true / undefined: auto when rows.length >= virtualizeThreshold
   * - false: never
   */
  virtualize?: boolean;
  /** Row count before virtualization kicks in (default 40). */
  virtualizeThreshold?: number;
  /** Scroll container height when virtualized (default 560). */
  maxHeight?: number | string;
  /** Estimated row height for the virtualizer (default dense ? 40 : 48). */
  estimateRowHeight?: number;
  /** Use Laxmi-style light table (orange header, black text). */
  tone?: 'dark' | 'light';
};

type BodyRowProps<T> = {
  row: T;
  index: number;
  columns: CommonTableColumn<T>[];
  cellBase: SxProps<Theme>;
  hover: boolean;
  onRowClick?: (row: T, index: number) => void;
  getRowSx?: (row: T, index: number) => SxProps<Theme> | undefined;
  measureRef?: (node: HTMLTableRowElement | null) => void;
  dataIndex?: number;
};

function BodyRowInner<T>({
  row,
  index,
  columns,
  cellBase,
  hover,
  onRowClick,
  getRowSx,
  measureRef,
  dataIndex,
}: BodyRowProps<T>) {
  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (!onRowClick) return;
      const target = e.target as HTMLElement | null;
      if (
        target?.closest?.(
          'button, a, input, textarea, select, .MuiButtonBase-root, .MuiIconButton-root',
        )
      ) {
        return;
      }
      onRowClick(row, index);
    },
    [onRowClick, row, index],
  );

  const rowSx = getRowSx?.(row, index);
  return (
    <TableRow
      ref={measureRef}
      data-index={dataIndex}
      hover={hover}
      onClick={onRowClick ? handleClick : undefined}
      sx={[onRowClick ? { cursor: 'pointer' } : undefined, rowSx] as SxProps<Theme>}
    >
      {columns.map((col) => (
        <TableCell
          key={col.id}
          align={col.align ?? 'center'}
          width={col.width}
          sx={[cellBase, col.cellSx] as SxProps<Theme>}
        >
          {col.render(row, index)}
        </TableCell>
      ))}
    </TableRow>
  );
}

const BodyRow = memo(BodyRowInner) as typeof BodyRowInner;

/**
 * Common table used across all admin pages.
 * Pass columns + rows; UI styling lives in `commonTableStyles` above.
 * Set `column.filter` to show a shared filter/search row under the headers.
 * Large lists are virtualized with measured row heights.
 */
export function CommonTable<T>({
  columns,
  rows,
  getRowKey,
  loading = false,
  emptyMessage = 'No data',
  stickyHeader = false,
  minWidth,
  size = 'small',
  paper = true,
  hover = true,
  dense = false,
  onRowClick,
  getRowSx,
  virtualize,
  virtualizeThreshold = 40,
  maxHeight = 560,
  estimateRowHeight,
  tone = 'dark',
}: CommonTableProps<T>) {
  const styles = tone === 'light' ? commonTableStylesLight : commonTableStyles;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const cellBase: SxProps<Theme> = dense
    ? { ...styles.cell, fontSize: 12, py: 1 }
    : styles.cell;
  const headBase: SxProps<Theme> = dense
    ? { ...styles.head, fontSize: 12, py: 1 }
    : styles.head;
  const filterBase: SxProps<Theme> = dense
    ? { ...styles.filter, fontSize: 11, py: 0.75 }
    : styles.filter;

  const showFilters = columns.some((col) => col.filter != null);
  const shouldVirtualize =
    virtualize === true ||
    (virtualize !== false && rows.length >= virtualizeThreshold);
  const rowHeight = estimateRowHeight ?? (dense ? 40 : 48);

  const virtualizer = useVirtualizer({
    count: shouldVirtualize ? rows.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
    measureElement:
      typeof window !== 'undefined' &&
      typeof document !== 'undefined' &&
      !navigator.userAgent.includes('Firefox')
        ? (el) => el.getBoundingClientRect().height
        : undefined,
  });

  const virtualItems = shouldVirtualize ? virtualizer.getVirtualItems() : [];
  const paddingTop = virtualItems.length ? virtualItems[0]?.start ?? 0 : 0;
  const paddingBottom = virtualItems.length
    ? virtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end ?? 0)
    : 0;

  const table = (
    <Table
      size={size}
      stickyHeader={stickyHeader || shouldVirtualize}
      sx={{
        minWidth: minWidth != null ? minWidth : undefined,
        borderCollapse: 'collapse',
        '& .MuiTableCell-root': {
          borderCollapse: 'collapse',
        },
      }}
    >
      <TableHead>
        <TableRow>
          {columns.map((col) => (
            <TableCell
              key={col.id}
              align={col.align ?? 'center'}
              width={col.width}
              onClick={
                col.sortable || col.onHeaderClick ? col.onHeaderClick : undefined
              }
              sx={
                [
                  headBase,
                  (col.sortable || col.onHeaderClick) && {
                    cursor: 'pointer',
                    userSelect: 'none',
                  },
                  col.headSx,
                ] as SxProps<Theme>
              }
            >
              {col.label}
            </TableCell>
          ))}
        </TableRow>
        {showFilters && (
          <TableRow>
            {columns.map((col) => (
              <TableCell
                key={`${col.id}-filter`}
                align={col.align ?? 'center'}
                width={col.width}
                sx={
                  [
                    filterBase,
                    col.width != null && {
                      width: col.width,
                      maxWidth: col.width,
                      minWidth: col.width,
                      boxSizing: 'border-box',
                      overflow: 'hidden',
                      verticalAlign: 'top',
                    },
                    col.headSx,
                  ] as SxProps<Theme>
                }
              >
                {col.filter ?? null}
              </TableCell>
            ))}
          </TableRow>
        )}
      </TableHead>
      <TableBody>
        {loading && rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={columns.length} align="center" sx={cellBase}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  py: 4,
                  gap: 1.5,
                }}
              >
                <CircularProgress size={28} />
                <Typography variant="body2" color="text.secondary">
                  Loading…
                </Typography>
              </Box>
            </TableCell>
          </TableRow>
        )}

        {rows.length === 0 && !loading && (
          <TableRow>
            <TableCell colSpan={columns.length} align="center" sx={cellBase}>
              {emptyMessage}
            </TableCell>
          </TableRow>
        )}

        {shouldVirtualize && rows.length > 0 && (
          <>
            {paddingTop > 0 && (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  sx={{ p: 0, border: 0, height: paddingTop }}
                />
              </TableRow>
            )}
            {virtualItems.map((virtualRow) => (
              <BodyRow
                key={
                  getRowKey
                    ? getRowKey(rows[virtualRow.index], virtualRow.index)
                    : virtualRow.key
                }
                row={rows[virtualRow.index]}
                index={virtualRow.index}
                columns={columns}
                cellBase={cellBase}
                hover={hover}
                onRowClick={onRowClick}
                getRowSx={getRowSx}
                dataIndex={virtualRow.index}
                measureRef={virtualizer.measureElement}
              />
            ))}
            {paddingBottom > 0 && (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  sx={{ p: 0, border: 0, height: paddingBottom }}
                />
              </TableRow>
            )}
          </>
        )}

        {!shouldVirtualize &&
          rows.map((row, index) => (
            <BodyRow
              key={getRowKey ? getRowKey(row, index) : index}
              row={row}
              index={index}
              columns={columns}
              cellBase={cellBase}
              hover={hover}
              onRowClick={onRowClick}
              getRowSx={getRowSx}
            />
          ))}
      </TableBody>
    </Table>
  );

  const scrollSx = shouldVirtualize
    ? {
        ...styles.paper,
        // Explicit height required for virtualization scrollport (maxHeight alone
        // can collapse when combined with layout tricks).
        height: maxHeight,
        maxHeight,
        overflow: 'auto',
        willChange: 'scroll-position',
      }
    : styles.paper;

  const withOverlay = (node: ReactNode) => (
    <Box sx={{ position: 'relative' }}>
      {node}
      {loading && rows.length > 0 && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(10, 10, 14, 0.55)',
            zIndex: 2,
            borderRadius: 1,
          }}
        >
          <CircularProgress size={36} />
        </Box>
      )}
    </Box>
  );

  if (!paper) {
    if (!shouldVirtualize) return withOverlay(table);
    return withOverlay(
      <Box
        ref={scrollRef}
        sx={{ height: maxHeight, maxHeight, overflow: 'auto' }}
      >
        {table}
      </Box>,
    );
  }

  return withOverlay(
    <Paper ref={scrollRef} sx={scrollSx}>
      {table}
    </Paper>,
  );
}

/** Text with a copy button — reuse anywhere. */
export function CopyText({
  value,
  breakAll = false,
  onClick,
}: {
  value: string;
  breakAll?: boolean;
  /** Optional — e.g. navigate on text click (copy button still stops propagation). */
  onClick?: () => void;
}) {
  if (!value) return <>—</>;

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.75,
        minWidth: 0,
      }}
    >
      <Typography
        variant="body2"
        component="span"
        onClick={onClick}
        sx={{
          color: 'inherit',
          cursor: onClick ? 'pointer' : undefined,
          wordBreak: breakAll ? 'break-all' : 'normal',
          whiteSpace: breakAll ? 'normal' : 'nowrap',
        }}
      >
        {value}
      </Typography>
      <IconButton
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          void copyToClipboard(value);
        }}
        aria-label="Copy"
      >
        <ContentCopyIcon sx={{ fontSize: 14 }} />
      </IconButton>
    </Box>
  );
}
