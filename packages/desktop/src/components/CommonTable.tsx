import {
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
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
import { useTheme } from '@mui/material/styles';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useVirtualizer } from '@tanstack/react-virtual';
import { copyToClipboard } from '@/utils/clipboard';
import { useRevealCodes } from '@/context/useRevealCodes';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';

function displayColLabel(label: ReactNode): ReactNode {
  if (typeof label === 'string' || typeof label === 'number') {
    return toDisplayText(String(label));
  }
  return label;
}

/**
 * Shared table styles.
 * Update these objects once to change table UI on every page.
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
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    verticalAlign: 'middle',
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

/** Light table tone for User Report / Laxmi-style pages + app light mode. */
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
    bgcolor: '#f5f5f7',
    border: '1px solid #ddd',
    py: 0.75,
    px: 1,
    verticalAlign: 'middle',
    textAlign: 'center',
  } satisfies SxProps<Theme>,
};

export type CommonTableTone = 'auto' | 'dark' | 'light';

export function resolveCommonTableTone(
  tone: CommonTableTone | undefined,
  paletteMode: 'light' | 'dark',
): 'dark' | 'light' {
  if (tone === 'dark' || tone === 'light') return tone;
  return paletteMode === 'light' ? 'light' : 'dark';
}

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
  /**
   * Freeze column on horizontal scroll.
   * `true` = auto left offset from prior sticky columns' widths.
   * `number` = explicit left px.
   */
  stickyLeft?: boolean | number;
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
  /** Tighter than `dense` — trims row padding so more rows fit on one screen. */
  compact?: boolean;
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
  /**
   * Table appearance.
   * - `auto` (default): follows app Light/Dark theme
   * - `light` / `dark`: force that tone
   */
  tone?: CommonTableTone;
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
  stickyOffsets?: Map<string, StickyMeta>;
  stickyBodyBg?: string;
};

type StickyMeta = { left: number; width: number; isLast: boolean };

function colWidthPx(col: { width?: number | string }, fallback = 120): number {
  if (typeof col.width === 'number') return col.width;
  if (typeof col.width === 'string' && col.width.endsWith('px')) {
    const n = Number(col.width.replace('px', ''));
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function buildStickyOffsets<T>(columns: CommonTableColumn<T>[]): Map<string, StickyMeta> {
  const map = new Map<string, StickyMeta>();
  let left = 0;
  const stickyCols = columns.filter((c) => c.stickyLeft != null && c.stickyLeft !== false);
  stickyCols.forEach((col, i) => {
    const width = colWidthPx(col);
    const offset = typeof col.stickyLeft === 'number' ? col.stickyLeft : left;
    map.set(col.id, { left: offset, width, isLast: i === stickyCols.length - 1 });
    left = offset + width;
  });
  return map;
}

/** Freeze column: locked pixel width + opaque fill so scroll cells cannot paint over it. */
function stickyColSx(
  meta: StickyMeta | undefined,
  opts: { top?: number; zIndex: number; bgcolor: string },
): SxProps<Theme> | undefined {
  if (!meta) return undefined;
  return {
    position: 'sticky',
    left: meta.left,
    top: opts.top,
    zIndex: opts.zIndex,
    width: meta.width,
    minWidth: meta.width,
    maxWidth: meta.width,
    boxSizing: 'border-box',
    bgcolor: `${opts.bgcolor} !important`,
    backgroundColor: `${opts.bgcolor} !important`,
    backgroundImage: 'none !important',
    overflow: 'hidden',
    ...(meta.isLast
      ? {
          boxShadow: '12px 0 16px -10px rgba(0,0,0,0.9)',
          borderRight: '1px solid rgba(255,255,255,0.18)',
        }
      : null),
  };
}

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
  stickyOffsets,
  stickyBodyBg = '#1a1a1f',
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
      {columns.map((col) => {
        const stickyMeta = stickyOffsets?.get(col.id);
        const widthPx = stickyMeta?.width ?? (typeof col.width === 'number' ? col.width : undefined);
        return (
          <TableCell
            key={col.id}
            align={col.align ?? 'center'}
            width={stickyMeta?.width ?? col.width}
            data-sticky-left={stickyMeta ? 'true' : undefined}
            sx={
              [
                cellBase,
                widthPx != null &&
                  (stickyMeta
                    ? {
                        width: widthPx,
                        minWidth: widthPx,
                        maxWidth: widthPx,
                        boxSizing: 'border-box',
                        overflow: 'hidden',
                      }
                    : {
                        // minWidth only — maxWidth + ellipsis clips short numeric cols (e.g. "#").
                        // Pages that need a hard cap can set maxWidth via cellSx / headSx.
                        width: widthPx,
                        minWidth: widthPx,
                        boxSizing: 'border-box',
                      }),
                stickyMeta
                  ? stickyColSx(stickyMeta, { zIndex: 30, bgcolor: stickyBodyBg })
                  : { zIndex: 1 },
                col.cellSx,
              ] as SxProps<Theme>
            }
          >
            {col.render(row, index)}
          </TableCell>
        );
      })}
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
  compact = false,
  onRowClick,
  getRowSx,
  virtualize,
  virtualizeThreshold = 40,
  maxHeight = 560,
  estimateRowHeight,
  tone = 'auto',
}: CommonTableProps<T>) {
  useRevealCodes(); // re-render headers when Reveal codes toggles
  const theme = useTheme();
  const resolvedTone = resolveCommonTableTone(tone, theme.palette.mode);
  const styles =
    resolvedTone === 'light' ? commonTableStylesLight : commonTableStyles;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const cellBase: SxProps<Theme> = compact
    ? { ...styles.cell, fontSize: 12, py: 0.15, px: 0.75, lineHeight: 1.15 }
    : dense
      ? { ...styles.cell, fontSize: 12, py: 1 }
      : styles.cell;
  const headBase: SxProps<Theme> = compact
    ? { ...styles.head, fontSize: 12, py: 0.5, px: 0.75 }
    : dense
      ? { ...styles.head, fontSize: 12, py: 1 }
      : styles.head;
  const filterBase: SxProps<Theme> = compact
    ? {
        ...styles.filter,
        fontSize: 11.5,
        py: 0.35,
        px: 0.5,
        '& .MuiInputBase-root': { fontSize: 11.5 },
        '& .MuiInputBase-input': { py: 0.35 },
      }
    : dense
      ? { ...styles.filter, fontSize: 11, py: 0.75 }
      : styles.filter;

  const showFilters = columns.some((col) => col.filter != null);
  const shouldVirtualize =
    virtualize === true ||
    (virtualize !== false && rows.length >= virtualizeThreshold);
  const rowHeight = estimateRowHeight ?? (compact ? 30 : dense ? 40 : 48);
  const isSticky = stickyHeader || shouldVirtualize;
  /** Measured header height so sticky filters sit fully below labels (no clipping). */
  const headLabelRef = useRef<HTMLTableRowElement | null>(null);
  const [labelRowHeight, setLabelRowHeight] = useState(compact ? 30 : dense ? 40 : 48);
  useLayoutEffect(() => {
    const el = headLabelRef.current;
    if (!el) return;
    const update = () => {
      const h = el.getBoundingClientRect().height;
      if (h > 0) setLabelRowHeight(h);
    };
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [columns, dense, compact, showFilters, resolvedTone]);
  const filterStickyTop = showFilters ? labelRowHeight : 0;
  const stickyOffsets = useMemo(() => buildStickyOffsets(columns), [columns]);
  const stickyHeadBg = '#ff9f0a';
  const stickyFilterBg = resolvedTone === 'light' ? '#f5f5f7' : '#2c3340';
  const stickyBodyBg = resolvedTone === 'light' ? '#fff' : '#1a1a1f';
  const overlayBg =
    resolvedTone === 'light' ? 'rgba(255,255,255,0.55)' : 'rgba(10, 10, 14, 0.55)';

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

  const hasStickyLeft = stickyOffsets.size > 0;
  // MUI stickyHeader class uses z-index:2 and fights left-freeze stacking — handle top sticky ourselves when freezing columns.
  const useMuiStickyHeader = (stickyHeader || shouldVirtualize) && !hasStickyLeft;

  const table = (
    <Table
      size={size}
      stickyHeader={useMuiStickyHeader}
      sx={{
        width: '100%',
        minWidth: minWidth != null ? minWidth : '100%',
        tableLayout: 'auto',
        borderCollapse: hasStickyLeft ? 'separate' : 'collapse',
        borderSpacing: 0,
      }}
    >
      <TableHead>
        <TableRow ref={headLabelRef}>
          {columns.map((col) => {
            const stickyMeta = stickyOffsets.get(col.id);
            return (
              <TableCell
                key={col.id}
                align={col.align ?? 'center'}
                width={stickyMeta?.width ?? col.width}
                data-sticky-left={stickyMeta ? 'true' : undefined}
                onClick={
                  col.sortable || col.onHeaderClick ? col.onHeaderClick : undefined
                }
                sx={
                  [
                    headBase,
                    isSticky && {
                      position: 'sticky',
                      top: 0,
                      zIndex: stickyMeta ? 50 : 40,
                      bgcolor: stickyHeadBg,
                    },
                    stickyColSx(stickyMeta, {
                      top: isSticky ? 0 : undefined,
                      zIndex: isSticky ? 50 : 45,
                      bgcolor: stickyHeadBg,
                    }),
                    (col.sortable || col.onHeaderClick) && {
                      cursor: 'pointer',
                      userSelect: 'none',
                    },
                    col.headSx,
                  ] as SxProps<Theme>
                }
              >
                {displayColLabel(col.label)}
              </TableCell>
            );
          })}
        </TableRow>
        {showFilters && (
          <TableRow>
            {columns.map((col) => {
              const stickyMeta = stickyOffsets.get(col.id);
              return (
                <TableCell
                  key={`${col.id}-filter`}
                  align={col.align ?? 'center'}
                  width={stickyMeta?.width ?? col.width}
                  data-sticky-left={stickyMeta ? 'true' : undefined}
                  sx={
                    [
                      filterBase,
                      isSticky && {
                        position: 'sticky',
                        top: filterStickyTop,
                        zIndex: stickyMeta ? 48 : 38,
                        bgcolor: stickyFilterBg,
                      },
                      stickyColSx(stickyMeta, {
                        top: isSticky ? filterStickyTop : undefined,
                        zIndex: isSticky ? 48 : 42,
                        bgcolor: stickyFilterBg,
                      }),
                      !stickyMeta &&
                        col.width != null && {
                          width: col.width,
                          minWidth: col.width,
                          boxSizing: 'border-box',
                          overflow: 'visible',
                          verticalAlign: 'middle',
                        },
                      col.headSx,
                    ] as SxProps<Theme>
                  }
                >
                  {col.filter ?? null}
                </TableCell>
              );
            })}
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
              {toDisplayText(emptyMessage)}
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
            {virtualItems.map((virtualRow) => {
              const row = rows[virtualRow.index];
              if (row == null) return null;
              return (
              <BodyRow
                key={
                  getRowKey
                    ? getRowKey(row, virtualRow.index)
                    : virtualRow.key
                }
                row={row}
                index={virtualRow.index}
                columns={columns}
                cellBase={cellBase}
                hover={hover}
                onRowClick={onRowClick}
                getRowSx={getRowSx}
                dataIndex={virtualRow.index}
                measureRef={virtualizer.measureElement}
                stickyOffsets={stickyOffsets}
                stickyBodyBg={stickyBodyBg}
              />
              );
            })}
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
          rows.map((row, index) => {
            if (row == null) return null;
            return (
            <BodyRow
              key={getRowKey ? getRowKey(row, index) : index}
              row={row}
              index={index}
              columns={columns}
              cellBase={cellBase}
              hover={hover}
              onRowClick={onRowClick}
              getRowSx={getRowSx}
              stickyOffsets={stickyOffsets}
              stickyBodyBg={stickyBodyBg}
            />
            );
          })}
      </TableBody>
    </Table>
  );

  // Keep the scrollport width-bound so wide tables scroll inside the paper
  // instead of expanding the page (overflow:auto alone is not enough).
  const scrollSx: SxProps<Theme> = {
    ...styles.paper,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    // When embedded (paper=false), parent owns scrolling (e.g. freeze panes)
    overflow: paper ? 'auto' : 'visible',
    bgcolor: paper ? styles.paper.bgcolor : 'transparent',
    ...(shouldVirtualize
      ? {
          height: maxHeight,
          maxHeight,
          overflow: 'auto',
          willChange: 'scroll-position',
        }
      : paper && maxHeight
        ? { maxHeight }
        : null),
    ...(hasStickyLeft
      ? {
          '& td[data-sticky-left="true"], & th[data-sticky-left="true"]': {
            position: 'sticky',
            backgroundClip: 'padding-box',
          },
          '& tbody td[data-sticky-left="true"]': {
            zIndex: '30 !important',
          },
          '& thead th[data-sticky-left="true"]': {
            zIndex: '50 !important',
          },
          '& tbody td:not([data-sticky-left="true"])': {
            zIndex: '1 !important',
          },
        }
      : null),
  };

  const withOverlay = (node: ReactNode) => (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        // overflow:hidden clips / breaks left-sticky columns in Chromium
        overflow: hasStickyLeft ? 'visible' : 'hidden',
      }}
    >
      {node}
      {loading && rows.length > 0 && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: overlayBg,
            zIndex: 60,
            borderRadius: 1,
          }}
        >
          <CircularProgress size={36} />
        </Box>
      )}
    </Box>
  );

  if (!paper) {
    return withOverlay(
      <Box ref={scrollRef} sx={scrollSx}>
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
  getCopyValue,
  silent = false,
}: {
  value: string;
  breakAll?: boolean;
  /** Optional — e.g. navigate on text click (copy button still stops propagation). */
  onClick?: () => void;
  /** Override clipboard text (e.g. gated / decoy copy). Defaults to `value`. */
  getCopyValue?: () => string;
  /** When true, skip the "Copied" toast. */
  silent?: boolean;
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
          const text = getCopyValue ? getCopyValue() : value;
          void copyToClipboard(text, { silent });
        }}
        aria-label="Copy"
      >
        <ContentCopyIcon sx={{ fontSize: 14 }} />
      </IconButton>
    </Box>
  );
}
