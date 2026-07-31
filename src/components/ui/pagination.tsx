import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  disabled?: boolean;
  className?: string;
  /** Max numbered buttons around the current page (default 1 → shows current ±1). */
  siblingCount?: number;
};

function range(start: number, end: number): number[] {
  const out: number[] = [];
  for (let i = start; i <= end; i += 1) out.push(i);
  return out;
}

/** Build page items with ellipsis for large page counts (MUI Pagination–style). */
export function getPaginationItems(
  page: number,
  totalPages: number,
  siblingCount = 1,
): Array<number | 'ellipsis'> {
  if (totalPages <= 1) return [1];

  const totalNumbers = siblingCount * 2 + 5;
  if (totalPages <= totalNumbers) return range(1, totalPages);

  const leftSibling = Math.max(page - siblingCount, 1);
  const rightSibling = Math.min(page + siblingCount, totalPages);
  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < totalPages - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    const leftCount = 3 + siblingCount * 2;
    return [...range(1, leftCount), 'ellipsis', totalPages];
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    const rightCount = 3 + siblingCount * 2;
    return [1, 'ellipsis', ...range(totalPages - rightCount + 1, totalPages)];
  }

  return [1, 'ellipsis', ...range(leftSibling, rightSibling), 'ellipsis', totalPages];
}

const itemClass =
  'inline-flex h-8 min-w-8 items-center justify-center rounded-full text-sm tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none';

/** Numbered pagination — orange active circle, plain page numbers (panel style). */
export function Pagination({
  page,
  totalPages,
  onChange,
  disabled,
  className,
  siblingCount = 1,
}: Props) {
  const pages = Math.max(1, totalPages);
  const current = Math.min(Math.max(1, page), pages);
  const items = getPaginationItems(current, pages, siblingCount);

  return (
    <nav
      aria-label="Pagination"
      className={cn('inline-flex items-center gap-1', className)}
    >
      <button
        type="button"
        className={cn(
          itemClass,
          'text-foreground/90 hover:text-foreground disabled:text-muted-foreground/50',
        )}
        disabled={disabled || current <= 1}
        onClick={() => onChange(current - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {items.map((item, index) =>
        item === 'ellipsis' ? (
          <span
            key={`e-${index}`}
            className="flex h-8 min-w-8 items-center justify-center text-sm text-foreground/80"
            aria-hidden
          >
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            className={cn(
              itemClass,
              'px-1.5 font-medium',
              item === current
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground/90 hover:text-foreground',
            )}
            disabled={disabled}
            aria-current={item === current ? 'page' : undefined}
            onClick={() => onChange(item)}
          >
            {item.toLocaleString()}
          </button>
        ),
      )}

      <button
        type="button"
        className={cn(
          itemClass,
          'text-foreground/90 hover:text-foreground disabled:text-muted-foreground/50',
        )}
        disabled={disabled || current >= pages}
        onClick={() => onChange(current + 1)}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}
