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
}: Props<T>) {
  const hasFilters = columns.some((col) => col.filter);

  return (
    <Card className="relative overflow-hidden">
      <div className="relative w-full overflow-auto">
        <Table style={{ minWidth }}>
          <TableHeader>
            <TableRow className="border-border bg-muted/50 hover:bg-muted/50">
              {columns.map((col) => (
                <TableHead
                  key={col.id}
                  className={cn(
                    'whitespace-nowrap text-foreground',
                    col.headClassName,
                  )}
                >
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
            {hasFilters && (
              <TableRow className="border-border bg-muted/20 hover:bg-muted/20">
                {columns.map((col) => (
                  <TableHead key={`f-${col.id}`} className="py-2">
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
                    onRowClick && 'cursor-pointer',
                    rowClassName?.(row, index),
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <TableCell
                      key={col.id}
                      className={cn('whitespace-nowrap', col.className)}
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
