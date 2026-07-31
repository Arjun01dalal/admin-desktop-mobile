import type { ReactNode } from 'react';
import { PanelPage } from '@/screens/panel/dashboards/PanelPage';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Props = {
  title: string;
  description?: string;
  actions?: ReactNode;
  toolbar?: ReactNode;
  onRefresh?: () => void;
  loading?: boolean;
  error?: string | null;
  children: ReactNode;
  className?: string;
};

/** Tailwind panel shell: title + optional toolbar card + content. */
export function ReportPage({
  title,
  description,
  actions,
  toolbar,
  onRefresh,
  loading,
  error,
  children,
  className,
}: Props) {
  return (
    <PanelPage
      title={title}
      description={description}
      actions={actions}
      onRefresh={onRefresh}
      loading={loading}
      error={error}
    >
      <div className={cn('space-y-4', className)}>
        {toolbar && (
          <Card>
            <CardContent className="flex flex-wrap items-end gap-3 p-4">
              {toolbar}
            </CardContent>
          </Card>
        )}
        {children}
      </div>
    </PanelPage>
  );
}
