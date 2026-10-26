import { dar } from './darStyles';
import { useRef, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

type Props<T> = {
  rows: T[];
  colSpan: number;
  head: ReactNode;
  getRowKey: (row: T, index: number) => string;
  /** Return `<td>` cells only — the wrapper owns the `<tr>`. */
  renderRow: (row: T, index: number) => ReactNode;
  wrapClassName: string;
  tableClassName: string;
  estimateSize?: number;
  /** Virtualize only when row count reaches this (default 24). */
  threshold?: number;
};

export function DarVirtualTable<T>({
  rows,
  colSpan,
  head,
  getRowKey,
  renderRow,
  wrapClassName,
  tableClassName,
  estimateSize = 44,
  threshold = 24,
}: Props<T>) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const shouldVirtualize = rows.length >= threshold;

  const isWindowsUi =
    typeof navigator !== 'undefined' &&
    (/Windows/i.test(navigator.userAgent) ||
      (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
        ?.platform === 'Windows');

  const virtualizer = useVirtualizer({
    count: shouldVirtualize ? rows.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize,
    overscan: isWindowsUi ? 6 : 10,
    paddingEnd: shouldVirtualize ? 16 : 0,
    // Windows DPI + measure thrash — stick to estimateSize there.
    measureElement: isWindowsUi
      ? undefined
      : (el) => el.getBoundingClientRect().height,
  });

  const virtualItems = shouldVirtualize ? virtualizer.getVirtualItems() : [];
  const paddingTop = virtualItems.length ? (virtualItems[0]?.start ?? 0) : 0;
  const paddingBottom = virtualItems.length
    ? Math.max(0, virtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end ?? 0))
    : 0;

  const spacer = (height: number) =>
    height > 0 ? (
      <tr aria-hidden className={dar.virtualSpacer}>
        <td colSpan={colSpan} style={{ height, padding: 0, border: 'none' }} />
      </tr>
    ) : null;

  return (
    <div ref={scrollRef} className={wrapClassName}>
      <table className={tableClassName}>
        {head}
        <tbody>
          {shouldVirtualize ? (
            <>
              {spacer(paddingTop)}
              {virtualItems.map((item) => {
                const row = rows[item.index];
                if (!row) return null;
                return (
                  <tr
                    key={getRowKey(row, item.index)}
                    data-index={item.index}
                    ref={isWindowsUi ? undefined : virtualizer.measureElement}
                  >
                    {renderRow(row, item.index)}
                  </tr>
                );
              })}
              {spacer(paddingBottom)}
            </>
          ) : (
            rows.map((row, index) => (
              <tr key={getRowKey(row, index)}>{renderRow(row, index)}</tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
