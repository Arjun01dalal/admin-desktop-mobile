/**
 * Call Logs screen helpers — pure logic lives in `@astro/shared/callLogs`.
 * This file keeps mobile-only types, theme colors, and networking.
 */
import {
  CALL_STATUS_OPTIONS,
  COMMENT_FILTER_OPTIONS,
  MAX_CALL_COMMENT_LENGTH,
  buildCallRecordRows,
  buildSummaryRows,
  callLogCustomerId,
  callLogRowId,
  filterCallsClientSide,
  formatStatusLabel,
  getAssignedBotIds,
  hasValidBotPhone,
  isCallLogsCaller,
  mapRowToDialSetting,
  normalizeCallerRoleName,
  pickPageSizes,
  reinitTargetKey,
  statusBadgeTone,
  toMinSec,
  buildBotSummaryRows,
  REINIT_CHIPS,
  type BotStatusSummaryData,
  type BotSummaryRow,
  type CallRecordRow,
  type ReinitStatus,
  type StatusBadgeTone,
} from '@astro/shared';
import {
  processIncomingCall,
  type CallAnalysis,
  type CallSummaryData,
} from '../../../../api/incomingBot';
import { colors } from '../../../../theme';
export { maskMobile } from '../../../../utils/display';

export type { CallSummaryData, CallAnalysis, BotSummaryRow, BotStatusSummaryData, ReinitStatus };
export type { CallRecordRow, StatusBadgeTone };

export {
  buildBotSummaryRows,
  buildCallRecordRows,
  buildSummaryRows,
  callLogCustomerId,
  callLogRowId,
  filterCallsClientSide,
  formatStatusLabel,
  getAssignedBotIds,
  hasValidBotPhone,
  isCallLogsCaller,
  mapRowToDialSetting,
  normalizeCallerRoleName,
  reinitTargetKey,
  statusBadgeTone,
  toMinSec,
  REINIT_CHIPS,
};

export type CallLogRow = Record<string, unknown> & {
  call_sid?: string;
  _id?: string;
  client_name?: string;
  /** Current API field (admin-panel-domains Call Logs key change). */
  customerId?: string;
  /** Legacy field — prefer `customerId`. */
  caller_user_id?: string;
  phone_number?: string;
  app_name?: string;
  state?: string;
  status?: string;
  call_duration?: unknown;
  bot_id?: number | string;
  completed_at?: string;
  comments?: string;
  commented_by?: string;
  deleted_by?: string;
  deleted_at?: string;
  recording_url?: string;
  last_played_date?: string;
  language?: string;
  city?: string;
  email?: string;
  reason?: string;
};

export const PAGE_SIZES = pickPageSizes([25, 50]);
export const STATUS_OPTIONS = CALL_STATUS_OPTIONS;
export const COMMENT_OPTIONS = COMMENT_FILTER_OPTIONS.filter((c) => c !== 'All');
export const MAX_COMMENT_LENGTH = MAX_CALL_COMMENT_LENGTH;

export function toDialerLeadSource(row: CallLogRow) {
  return {
    _id: callLogCustomerId(row) || String(row._id || ''),
    name: row.client_name,
    mobile: row.phone_number,
    city: row.city,
    state: row.state,
    clientName: row.app_name,
  };
}

/** Map shared status tone → RN theme colors. */
export function statusColor(item: CallLogRow): string {
  const tone = statusBadgeTone(item);
  if (tone === 'deleted') return colors.muted;
  if (tone === 'busy') return '#facc15';
  if (tone === 'no-answer') return colors.destructive;
  if (tone === 'completed') return colors.success;
  return colors.foreground;
}

/**
 * Mirror of desktop electron/secure processCallSummary: plain HTTPS POST to the
 * calling-bot helper (no auth/encryption), so it works without the Electron bridge.
 */
export async function processCallSummary(
  callSid: string,
): Promise<{ ok: boolean; message?: string; data?: CallSummaryData }> {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(callSid)) {
    return { ok: false, message: 'Invalid call_sid' };
  }
  try {
    const { response, data } = await processIncomingCall(callSid);
    if (!response.ok || data?.status === 'failed') {
      return { ok: false, message: data?.message || 'Analysis failed', data: data ?? undefined };
    }
    return { ok: true, data: data ?? undefined, message: data?.message };
  } catch {
    return { ok: false, message: 'Analysis is in progress.' };
  }
}
