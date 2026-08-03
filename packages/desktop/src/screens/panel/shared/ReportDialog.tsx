import type { FormEvent, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  onSubmit?: (event: FormEvent) => void;
  submitLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
};

/** Lightweight modal for Tailwind panel pages. */
export function ReportDialog({
  open,
  title,
  onClose,
  onSubmit,
  submitLabel = 'Submit',
  cancelLabel = 'Cancel',
  loading,
  children,
  className,
  footer,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl',
          className,
        )}
      >
        <h2 className="mb-5 text-lg font-semibold text-foreground">{title}</h2>
        {onSubmit ? (
          <form onSubmit={onSubmit} className="space-y-4">
            {children}
            <div className="flex justify-end gap-2 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="text-foreground"
              >
                {cancelLabel}
              </Button>
              <Button type="submit" disabled={loading}>
                {submitLabel}
              </Button>
            </div>
          </form>
        ) : (
          <>
            <div className="space-y-4">{children}</div>
            {footer ?? (
              <div className="mt-5 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="text-foreground"
                >
                  {cancelLabel}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
