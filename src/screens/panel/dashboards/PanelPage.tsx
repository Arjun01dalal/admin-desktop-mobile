import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

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
    <div className="min-h-full space-y-6 p-1">
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
