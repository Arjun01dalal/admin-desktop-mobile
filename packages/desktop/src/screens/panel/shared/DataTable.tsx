import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type DataColumn<T> = {
  id: string;
  label: ReactNode;
  className?: string;
  headClassName?: string;
  filter?: ReactNode;
  render: (row: T, index: number) => ReactNode;
};

type Props<T> = {
  columns: DataColumn<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string | number;
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T, index: number) => string | undefined;
  minWidth?: number | string;
  /** Extra classes on the <table> (e.g. `table-fixed w-full`). */
  tableClassName?: string;
  /** Keep header (and filter row) pinned while scrolling. */
  stickyHeader?: boolean;
  /** Max height of the scroll area (enables vertical scroll + sticky header). */
  maxHeight?: number | string;
};

/** Reusable Tailwind data table for panel list pages. */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  loading,
  emptyMessage = 'No records found',
  onRowClick,
  rowClassName,
  minWidth = 900,
  tableClassName,
  stickyHeader = true,
  maxHeight = 'calc(100vh - 280px)',
}: Props<T>) {
  const hasFilters = columns.some((col) => col.filter);

  return (
    <Card className="relative overflow-hidden border-border bg-card">
      <div
        className="relative w-full max-w-full overflow-auto"
        style={{ maxHeight }}
      >
        <Table
          className={cn(tableClassName)}
          style={{
            minWidth: minWidth === '100%' ? undefined : minWidth,
            width: '100%',
          }}
        >
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              {columns.map((col) => (
                <TableHead
                  key={col.id}
                  className={cn(
                    'whitespace-nowrap border-b border-border bg-muted text-foreground',
                    stickyHeader && 'sticky top-0 z-30',
                    col.headClassName,
                  )}
                >
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
            {hasFilters && (
              <TableRow className="border-border hover:bg-transparent">
                {columns.map((col) => (
                  <TableHead
                    key={`f-${col.id}`}
                    className={cn(
                      'border-b border-border bg-card py-2',
                      stickyHeader && 'sticky top-10 z-20',
                    )}
                  >
                    {col.filter ?? null}
                  </TableHead>
                ))}
              </TableRow>
            )}
          </TableHeader>
          <TableBody>
            {loading && rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-28 text-center text-muted-foreground"
                >
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading…
                  </span>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, index) => (
                <TableRow
                  key={getRowKey(row, index)}
                  className={cn(
                    'bg-card',
                    onRowClick && 'cursor-pointer',
                    rowClassName?.(row, index),
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <TableCell
                      key={col.id}
                      className={cn('whitespace-nowrap bg-card', col.className)}
                    >
                      {col.render(row, index)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {loading && rows.length > 0 && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
    </Card>
  );
}
