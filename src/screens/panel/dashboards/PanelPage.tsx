import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';

type Props = {
  title: string;
  description?: string;
  actions?: ReactNode;
  onRefresh?: () => void;
  loading?: boolean;
  error?: string | null;
  children: ReactNode;
};

/** Shared shell for the new shadcn/Tailwind admin pages. */
export function PanelPage({
  title,
  description,
  actions,
  onRefresh,
  loading,
  error,
  children,
}: Props) {
  return (
    <div className="relative min-h-full space-y-6 p-1">
      {loading && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center pt-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            Loading…
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
              <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              Refresh
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
          {error}
        </div>
      )}

      {children}
    </div>
  );
}
