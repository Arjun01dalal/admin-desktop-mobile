import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { pushToBotDialer } from '@/screens/panel/shared/pushToBotDialer';
import {
  extractDialLeadsFromExcel,
  mapRowToDialSetting,
  toDialerConnectDetails,
  toDialerLead,
} from './utils';
import type { CallLogRow, DialerConnectDetails } from './types';
import { MAX_COMMENT_LENGTH } from './types';

type Admin = {
  _id?: string;
  name?: string;
  extensionId?: string[];
  serverId?: string | number;
} | null | undefined;

type Params = {
  admin: Admin;
  load: () => Promise<void>;
  getSelectedRows: () => CallLogRow[];
  clearSelection: () => void;
  campaignId: string;
  getDateRange: () => { startDate: string; endDate: string };
};

export function useCallLogsActions({
  admin,
  load,
  getSelectedRows,
  clearSelection,
  campaignId,
  getDateRange,
}: Params) {
  const [actionLoading, setActionLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<Record<string, unknown> | null>(
    null,
  );

  const botCall = useCallback(
    async (rows?: CallLogRow[]) => {
      const target = rows ?? getSelectedRows();
      if (!target.length) {
        toast.error('Select at least one row');
        return;
      }
      setActionLoading(true);
      try {
        const res = await pushToBotDialer({
          userId: admin?._id,
          created_by: admin?.name,
          dialout_settings: target.map(mapRowToDialSetting) as Record<
            string,
            unknown
          >[],
        });
        if (!res.ok) {
          toast.error(res.message || 'Bot call failed');
          return;
        }
        toast.success(res.message || `Bot call queued (${res.pushed})`);
        clearSelection();
        await load();
      } finally {
        setActionLoading(false);
      }
    },
    [admin?._id, admin?.name, clearSelection, getSelectedRows, load],
  );

  const dialerCall = useCallback(async () => {
    if (!campaignId) {
      toast.error('Campaign Name should not be empty');
      return;
    }
    const selectedRows = getSelectedRows();
    if (!selectedRows.length) {
      toast.error('Select at least one row');
      return;
    }
    setActionLoading(true);
    try {
      const res = await secureApi('callLogs.externalDialerBatch', {
        campaignId,
        leads: selectedRows.map(toDialerLead),
        serverId: admin?.serverId,
      });
      if (!res.ok) {
        toast.error(res.message || 'Dialer call failed');
        return;
      }
      toast.success(res.message || 'Dialer call queued');
      clearSelection();
      await load();
    } finally {
      setActionLoading(false);
    }
  }, [admin?.serverId, campaignId, clearSelection, getSelectedRows, load]);

  const connectDialer = useCallback(
    async (row: CallLogRow) => {
      const details: DialerConnectDetails = toDialerConnectDetails(row);
      const res = await secureApi('callLogs.externalDialerSingle', {
        details,
        extensionId: admin?.extensionId || [],
        adminName: admin?.name || 'ADMIN',
        serverId: admin?.serverId,
      });
      if (!res.ok) toast.error(res.message || 'Connect dialer failed');
      else toast.success(res.message || 'Connected to dialer');
    },
    [admin?.extensionId, admin?.name, admin?.serverId],
  );

  const endCall = useCallback(
    async (row: CallLogRow) => {
      const res = await secureApi('callLogs.updateCallData', {
        call_sid: row.call_sid,
        status: 'no-answer',
        commented_by: admin?.name,
      });
      if (!res.ok) toast.error(res.message || 'Failed to end call');
      else {
        toast.success('Call ended');
        await load();
      }
    },
    [admin?.name, load],
  );

  const submitComment = useCallback(
    async (callSid: string, value: string) => {
      const trimmed = value.trim().slice(0, MAX_COMMENT_LENGTH);
      if (!trimmed) {
        toast.error('Comment is required');
        return false;
      }
      const res = await secureApi('callLogs.updateCallData', {
        call_sid: callSid,
        comments: trimmed,
        commented_by: admin?.name,
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to save comment');
        return false;
      }
      toast.success('Comment saved');
      await load();
      return true;
    },
    [admin?.name, load],
  );

  const pauseBotCalls = useCallback(
    async (pauseBotId: string) => {
      const payload: Record<string, unknown> = { deletedBy: admin?.name };
      if (pauseBotId.trim()) {
        const botId = Number.parseInt(pauseBotId, 10);
        if (!Number.isFinite(botId) || botId < 0) {
          toast.error('Invalid Bot ID');
          return false;
        }
        payload.botId = botId;
      }
      const res = await secureApi('callLogs.deleteQueuedCalls', payload);
      if (!res.ok) {
        toast.error(res.message || 'Failed to pause bot calls');
        return false;
      }
      toast.success(res.message || 'Queued calls deleted');
      await load();
      return true;
    },
    [admin?.name, load],
  );

  const viewSummary = useCallback(
    async (row: CallLogRow) => {
      setActionLoading(true);
      try {
        const res = await secureApi<Record<string, unknown>>('callLogs.processCall', {
          call_sid: row.call_sid,
        });
        if (!res.ok) {
          toast.error(res.message || 'Analysis is in progress.');
          return false;
        }
        setSummaryData(res.data || null);
        return true;
      } finally {
        setActionLoading(false);
      }
    },
    [],
  );

  const onUpload = useCallback(
    async (file?: File | null) => {
      if (!file) return;
      try {
        const leads = await extractDialLeadsFromExcel(file);
        setActionLoading(true);
        const res = await pushToBotDialer({
          userId: admin?._id,
          created_by: admin?.name,
          dialout_settings: leads as unknown as Record<string, unknown>[],
        });
        if (!res.ok) toast.error(res.message || 'Upload dial failed');
        else {
          toast.success(res.message || `Uploaded to bot (${res.pushed})`);
          await load();
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Invalid Excel');
      } finally {
        setActionLoading(false);
      }
    },
    [admin?._id, admin?.name, load],
  );

  const reinitiateDeleted = useCallback(
    async (botId: number) => {
      setActionLoading(true);
      try {
        const { startDate, endDate } = getDateRange();
        const res = await secureApi<CallLogRow[]>('callLogs.fetchDeleted', {
          startDate,
          endDate,
          botId,
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to fetch deleted calls');
          return;
        }
        const rows = Array.isArray(res.data) ? res.data : [];
        if (!rows.length) {
          toast.info('No deleted calls to reinitiate');
          return;
        }
        await botCall(rows);
      } finally {
        setActionLoading(false);
      }
    },
    [botCall, getDateRange],
  );

  return {
    actionLoading,
    summaryData,
    setSummaryData,
    botCall,
    dialerCall,
    connectDialer,
    endCall,
    submitComment,
    pauseBotCalls,
    viewSummary,
    onUpload,
    reinitiateDeleted,
  };
}
