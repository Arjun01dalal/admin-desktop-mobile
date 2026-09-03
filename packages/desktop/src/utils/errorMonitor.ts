/** Renderer error monitoring — forwards to main (log + optional webhook). */

type ReportPayload = {
  message: string;
  name?: string;
  stack?: string;
  source: string;
  url?: string;
};

function forward(payload: ReportPayload): void {
  try {
    window.gcalc?.reportError?.(payload);
  } catch {
    // ignore
  }
  if (import.meta.env.DEV) {
    console.error('[errorMonitor]', payload.source, payload.message, payload.stack);
  }
}

export function reportRendererError(
  source: string,
  err: unknown,
  extra: Record<string, string | undefined> = {},
): void {
  const message =
    err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown renderer error';
  const name = err instanceof Error ? err.name : undefined;
  const stack = err instanceof Error ? err.stack?.slice(0, 4000) : undefined;
  forward({ source, message, name, stack, ...extra });
}

export function installRendererErrorMonitor(): void {
  window.addEventListener('error', (event) => {
    forward({
      source: 'renderer:error',
      message: event.message || 'Script error',
      stack: event.error?.stack?.slice(0, 4000),
      url: event.filename,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportRendererError('renderer:unhandledrejection', event.reason);
  });
}
