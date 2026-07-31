import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  CALLER_HEAD_ROLE_IDS,
  CALLER_ROLE_IDS,
  OFFICE_LOCATIONS,
} from './callerResponsibility/constants';
import {
  ReportPage,
  DataTable,
  type DataColumn,
  SelectField,
  ReportDialog,
  display,
} from './shared';

type SubAdmin = {
  _id: string;
  name?: string;
  realName?: string;
  empCode?: string;
  Role_ID?: string;
  block?: boolean;
  callerHead?: string;
  officeLocation?: string;
  extensionId?: string[] | string;
  botIds?: string[] | string;
  serverId?: string;
  telegram_username?: string;
  language?: string;
};

type RoleGroup = {
  roleId: string;
  block?: boolean;
  subAdmins?: SubAdmin[];
};

type CallerRow = SubAdmin & {
  location: string;
  extensionNo: string;
  botNo: string;
  serverIds: string;
  telegramUserId: string;
  languageDraft: string;
};

type CallerHeadOption = { id: string; name: string };

const LANGUAGE_OPTIONS = [
  'English',
  'Hindi',
  'Marathi',
  'Gujarati',
  'Punjabi',
  'Bengali',
  'Tamil',
  'Telugu',
  'Kannada',
  'Malayalam',
  'Odia',
  'Assamese',
].map((v) => ({ value: v, label: v }));

const LOCATION_OPTIONS = OFFICE_LOCATIONS.map((v) => ({ value: v, label: v }));

function toRow(subAdmin: SubAdmin, blockFallback?: boolean): CallerRow {
  return {
    ...subAdmin,
    block: subAdmin.block ?? blockFallback ?? false,
    location: subAdmin.officeLocation || '',
    extensionNo: '',
    botNo: '',
    serverIds: subAdmin.serverId || '',
    telegramUserId: subAdmin.telegram_username || '',
    languageDraft: subAdmin.language || '',
  };
}

/** Caller Allotment — assign caller heads, office/bot/server/telegram/language attributes per caller. */
export function CallerAllotmentPage() {
  const [rows, setRows] = useState<CallerRow[]>([]);
  const [callerHeadOptions, setCallerHeadOptions] = useState<CallerHeadOption[]>([]);
  const [callerHeadMap, setCallerHeadMap] = useState<Record<string, CallerHeadOption[]>>({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [blockTarget, setBlockTarget] = useState<CallerRow | null>(null);
  const [remark, setRemark] = useState('');
  const [blockLoading, setBlockLoading] = useState(false);
  const { next, isCurrent, begin, end } = useRequestGeneration();

  const load = useCallback(async () => {
    const gen = next();
    begin();
    setLoading(true);
    try {
      const res = await secureApi<{ byRole?: RoleGroup[] }>(
        'ops.callerAllotmentSubadmins',
        { filter: {} },
      );
      if (!isCurrent(gen)) return;

      if (!res.ok) {
        toast.error(res.message || 'Failed to load caller allotment data');
        setRows([]);
        setCallerHeadOptions([]);
        return;
      }

      const byRole = res.data?.byRole ?? [];

      const heads = byRole
        .filter((group) => CALLER_HEAD_ROLE_IDS.has(group.roleId))
        .flatMap((group) => group.subAdmins ?? []);

      const callers = byRole
        .filter((group) => CALLER_ROLE_IDS.has(group.roleId))
        .flatMap((group) =>
          (group.subAdmins ?? []).map((subAdmin) => toRow(subAdmin, group.block)),
        )
        .sort((a, b) => Number(a.block) - Number(b.block));

      setCallerHeadOptions(
        heads
          .filter((h) => !h.block)
          .map((h) => ({ id: h._id, name: h.name || h._id })),
      );
      setRows(callers);
      setCallerHeadMap({});
    } finally {
      end();
      if (isCurrent(gen)) setLoading(false);
    }
  }, [next, begin, end, isCurrent]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRowChange = useCallback(
    <K extends keyof CallerRow>(id: string, field: K, value: CallerRow[K]) => {
      setRows((prev) =>
        prev.map((row) => (row._id === id ? { ...row, [field]: value } : row)),
      );
    },
    [],
  );

  const handleCallerHeadChange = useCallback(
    (id: string, selectedIds: string[]) => {
      const selected = callerHeadOptions.filter((opt) => selectedIds.includes(opt.id));
      setCallerHeadMap((prev) => ({ ...prev, [id]: selected }));
    },
    [callerHeadOptions],
  );

  const saveRow = useCallback(
    async (row: CallerRow) => {
      setSavingId(row._id);
      try {
        const requests: Promise<{ ok: boolean; message?: string }>[] = [];

        const selectedHeads = callerHeadMap[row._id];
        if (selectedHeads?.length) {
          requests.push(
            secureApi('ops.updateCallerHead', {
              _id: row._id,
              callerHead: selectedHeads.map((h) => h.name),
            }),
          );
        }

        if (row.location.trim()) {
          requests.push(
            secureApi('ops.updateOfficeLocation', {
              _id: row._id,
              officeLocation: row.location.trim(),
            }),
          );
        }

        const extensionId = row.extensionNo
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean);
        const botIds = row.botNo
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean);

        const attrPayload: Record<string, unknown> = { userId: row._id };
        if (extensionId.length) attrPayload.extensionId = extensionId;
        if (row.serverIds.trim()) attrPayload.serverId = row.serverIds.trim();
        if (botIds.length) attrPayload.botIds = botIds;
        if (row.telegramUserId.trim()) attrPayload.telegramUsername = row.telegramUserId.trim();
        if (Object.keys(attrPayload).length > 1) {
          requests.push(secureApi('ops.updateSubadminAttributes', attrPayload));
        }

        if (row.languageDraft.trim()) {
          requests.push(
            secureApi('ops.updateLanguage', {
              _id: row._id,
              language: row.languageDraft.trim(),
            }),
          );
        }

        if (requests.length === 0) {
          toast.info('Nothing to save for this row');
          return;
        }

        const results = await Promise.all(requests);
        const failed = results.find((r) => !r.ok);
        if (failed) {
          toast.error(failed.message || 'Some updates failed to save');
        } else {
          toast.success('Caller updated successfully');
        }
        void load();
      } finally {
        setSavingId(null);
      }
    },
    [callerHeadMap, load],
  );

  const openBlockDialog = useCallback((row: CallerRow) => {
    setBlockTarget(row);
    setRemark('');
  }, []);

  const submitBlock = useCallback(async () => {
    if (!blockTarget) return;
    if (!remark.trim()) {
      toast.error('Please enter a remark');
      return;
    }
    setBlockLoading(true);
    try {
      const res = await secureApi('ops.blockCaller', {
        _id: blockTarget._id,
        Role_ID: blockTarget.Role_ID,
        status: !blockTarget.block,
        blockReason: remark.trim(),
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to update block status');
        return;
      }
      toast.success(blockTarget.block ? 'Caller unblocked' : 'Caller blocked');
      setBlockTarget(null);
      setRemark('');
      void load();
    } finally {
      setBlockLoading(false);
    }
  }, [blockTarget, remark, load]);

  const columns = useMemo<DataColumn<CallerRow>[]>(
    () => [
      { id: 'index', label: '#', render: (_row, index) => index + 1 },
      { id: 'pseudo', label: 'Pseudo Name', render: (row) => display(row.name) },
      { id: 'realName', label: 'Real Name', render: (row) => display(row.realName) },
      { id: 'empCode', label: 'Emp Code', render: (row) => display(row.empCode) },
      {
        id: 'callerHead',
        label: 'Caller Head',
        className: 'min-w-[220px]',
        render: (row) => (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              Current: {display(row.callerHead)}
            </span>
            <select
              multiple
              className="h-20 min-w-[180px] rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground [color-scheme:dark] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={(callerHeadMap[row._id] || []).map((h) => h.id)}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                handleCallerHeadChange(row._id, selected);
              }}
            >
              {callerHeadOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name}
                </option>
              ))}
            </select>
          </div>
        ),
      },
      {
        id: 'location',
        label: 'Location',
        render: (row) => (
          <SelectField
            value={row.location}
            onChange={(v) => handleRowChange(row._id, 'location', v)}
            options={LOCATION_OPTIONS}
            placeholder="Select"
          />
        ),
      },
      {
        id: 'extension',
        label: 'Extension',
        render: (row) => (
          <Input
            value={row.extensionNo}
            placeholder="e.g. 101,102"
            className="h-8 min-w-[110px]"
            onChange={(e) => handleRowChange(row._id, 'extensionNo', e.target.value)}
          />
        ),
      },
      {
        id: 'botId',
        label: 'Bot ID',
        render: (row) => (
          <Input
            value={row.botNo}
            placeholder="e.g. 1,2,3"
            className="h-8 min-w-[110px]"
            onChange={(e) => handleRowChange(row._id, 'botNo', e.target.value)}
          />
        ),
      },
      {
        id: 'serverId',
        label: 'Server ID',
        render: (row) => (
          <Input
            value={row.serverIds}
            placeholder="Server ID"
            className="h-8 min-w-[100px]"
            onChange={(e) => handleRowChange(row._id, 'serverIds', e.target.value)}
          />
        ),
      },
      {
        id: 'telegramId',
        label: 'Telegram ID',
        render: (row) => (
          <Input
            value={row.telegramUserId}
            placeholder="Telegram ID"
            className="h-8 min-w-[120px]"
            onChange={(e) => handleRowChange(row._id, 'telegramUserId', e.target.value)}
          />
        ),
      },
      {
        id: 'language',
        label: 'Language',
        render: (row) => (
          <SelectField
            value={row.languageDraft}
            onChange={(v) => handleRowChange(row._id, 'languageDraft', v)}
            options={LANGUAGE_OPTIONS}
            placeholder="Select"
          />
        ),
      },
      {
        id: 'action',
        label: 'Action',
        className: 'min-w-[160px]',
        render: (row) => (
          <div className="flex flex-col gap-2">
            <Button
              size="sm"
              onClick={() => void saveRow(row)}
              disabled={savingId === row._id}
            >
              {savingId === row._id ? 'Saving…' : 'Save'}
            </Button>
            <Button
              size="sm"
              variant={row.block ? 'outline' : 'destructive'}
              onClick={() => openBlockDialog(row)}
            >
              {row.block ? 'Un-Block' : 'Block'}
            </Button>
          </div>
        ),
      },
    ],
    [
      callerHeadMap,
      callerHeadOptions,
      handleCallerHeadChange,
      handleRowChange,
      savingId,
      saveRow,
      openBlockDialog,
    ],
  );

  return (
    <ReportPage title="Caller Allotment" onRefresh={() => void load()} loading={loading}>
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row._id}
        loading={loading}
        emptyMessage="No callers found"
        rowClassName={(row) => (row.block ? 'bg-red-500/10 hover:bg-red-500/15' : undefined)}
        minWidth={1600}
      />

      <ReportDialog
        open={Boolean(blockTarget)}
        title={blockTarget?.block ? 'Unblock Caller' : 'Block Caller'}
        onClose={() => setBlockTarget(null)}
        onSubmit={(e) => {
          e.preventDefault();
          void submitBlock();
        }}
        submitLabel={blockLoading ? 'Submitting…' : 'Submit'}
        loading={blockLoading}
      >
        <label className={cn('flex flex-col gap-1')}>
          <span className="text-xs font-medium text-muted-foreground">Remark</span>
          <Input
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="Enter remark"
            autoFocus
          />
        </label>
      </ReportDialog>
    </ReportPage>
  );
}
