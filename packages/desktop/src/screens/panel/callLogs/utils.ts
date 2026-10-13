import {
  buildBotSummaryRows,
  buildCallRecordRows,
  cleanDialObject,
  filterCallsClientSide,
  formatStatusLabel,
  getAssignedBotIds,
  isCallLogsCaller,
  mapRowToDialSetting as mapRowToDialSettingShared,
  statusBadgeTone,
  toMinSec,
  type BotSummaryRow,
  type CallRecordRow,
  type StatusBadgeTone,
} from '@astro/shared';
import { readSpreadsheetRows } from '@/utils/spreadsheet';
import { STATE_LANGUAGE_MAP } from './constants';
import type { CallLogRow, DialerConnectDetails, DialerLead } from './types';
import { MAX_EXCEL_LEADS } from './types';

export type DialLead = {
  phone_number: string;
  app_name: string;
  language: string;
  client_name: string;
  id: string;
  state: string;
  city: string;
  email: string;
  botId: number;
  reason: string;
};

export {
  buildBotSummaryRows,
  buildCallRecordRows,
  filterCallsClientSide,
  formatStatusLabel,
  getAssignedBotIds,
  isCallLogsCaller,
  statusBadgeTone,
  toMinSec,
};
export type { BotSummaryRow, CallRecordRow, StatusBadgeTone };

export const cleanObject = cleanDialObject;

export function mapRowToDialSetting(item: CallLogRow) {
  return mapRowToDialSettingShared(item);
}

/** Only whitelisted fields for external dialer connect. */
export function toDialerConnectDetails(row: CallLogRow): DialerConnectDetails {
  return {
    call_sid: row.call_sid,
    client_name: row.client_name,
    phone_number: row.phone_number,
    city: row.city,
    state: row.state,
    app_name: row.app_name,
    caller_user_id: row.caller_user_id,
    _id: row._id,
  };
}

export function toDialerLead(item: CallLogRow): DialerLead {
  return {
    first_name: item.client_name || '',
    last_name: '',
    phone_number: item.phone_number || '',
    city: item.city ?? '',
    state: item.state ?? '',
    email: item.app_name ?? '',
    comments: item.app_name ?? '',
    province: item.caller_user_id || item._id || '',
  };
}

export function extractDialLeadsFromExcel(file: File): Promise<DialLead[]> {
  return readSpreadsheetRows(file, { maxRows: MAX_EXCEL_LEADS }).then((jsonData) => {
    if (!jsonData.length) throw new Error('Excel file is empty');

    const excelColumns = Object.keys(jsonData[0]);
    const missing = ['number', 'state', 'botId'].filter((c) => !excelColumns.includes(c));
    if (missing.length) {
      throw new Error(`Invalid Excel file. Missing columns: ${missing.join(', ')}`);
    }

    return jsonData.map((row) => {
      const state = String(row.state || '');
      const rawPhone = String(row.number || '').replace(/\D/g, '');
      const botId = Number(row.botId);
      return {
        phone_number: rawPhone,
        app_name: 'OS Games',
        language: STATE_LANGUAGE_MAP[state] ?? 'hindi',
        client_name: 'Sir',
        id: '',
        state,
        city: '',
        email: '',
        botId: Number.isFinite(botId) && botId > 0 ? botId : 1,
        reason: String(row.reason || 'New Leads').slice(0, 200),
      };
    });
  });
}
