import { secureApi } from '@/api/secureClient';

/**
 * Backend /SubAdmin/add-to-dialer often only accepts a small batch per request.
 * Pushing 20 at once can result in only ~10 being queued — chunk to be safe.
 */
export const BOT_PUSH_CHUNK_SIZE = 10;

export function hasValidBotPhone(value: unknown): boolean {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length >= 8;
}

export function filterValidBotSettings(
  settings: Record<string, unknown>[],
): Record<string, unknown>[] {
  return settings.filter((s) => hasValidBotPhone(s.phone_number));
}

type PushResult = {
  ok: boolean;
  message: string;
  pushed: number;
  skipped: number;
  totalRequested: number;
};

/**
 * Push dialout_settings to bot in chunks so every lead is submitted.
 */
export async function pushToBotDialer(opts: {
  userId?: string;
  created_by?: string;
  dialout_settings: Record<string, unknown>[];
  chunkSize?: number;
}): Promise<PushResult> {
  const totalRequested = opts.dialout_settings.length;
  const settings = filterValidBotSettings(opts.dialout_settings);
  const skipped = totalRequested - settings.length;

  if (!settings.length) {
    return {
      ok: false,
      message: 'No valid phone numbers to push',
      pushed: 0,
      skipped,
      totalRequested,
    };
  }

  const chunkSize = Math.max(1, opts.chunkSize ?? BOT_PUSH_CHUNK_SIZE);
  let pushed = 0;
  let lastMessage = '';

  for (let i = 0; i < settings.length; i += chunkSize) {
    const chunk = settings.slice(i, i + chunkSize);
    const res = await secureApi('callLogs.addToBotDialer', {
      userId: opts.userId,
      created_by: opts.created_by,
      dialout_settings: chunk,
    });
    if (!res.ok) {
      return {
        ok: false,
        message:
          res.message ||
          `Failed after pushing ${pushed} of ${settings.length} leads`,
        pushed,
        skipped,
        totalRequested,
      };
    }
    pushed += chunk.length;
    lastMessage = res.message || '';
  }

  const skipNote = skipped > 0 ? ` (${skipped} skipped — no mobile)` : '';
  return {
    ok: true,
    message:
      lastMessage ||
      `Call Initiated Successfully (${pushed} leads)${skipNote}.`,
    pushed,
    skipped,
    totalRequested,
  };
}
