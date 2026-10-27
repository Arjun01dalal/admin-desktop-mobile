import { cn } from '@/lib/utils';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { toast } from 'react-toastify';

import { formatAllotmentTime, isAbortError } from '@astro/shared/dailyAccountReport';
import {
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Tab,
  Tabs,
  TextField,
} from '@mui/material';

import type { MidAllotment, MidRecord, SubAdminOption, UpdatedBy } from './api';
import { DarVirtualTable } from './DarVirtualTable';
import { EmptyState, QuickCard, SoftPill, StatusPill, TableLoader } from './darUi';
import { dar } from './darStyles';
import {
  allotMid,
  darApiErrorMessage,
  fetchActiveAllotments,
  fetchAllotmentHistory,
  fetchMids,
  loadSubAdminOptions,
  reassignMid,
  revokeMid,
} from './api';

type Props = {
  updatedBy: UpdatedBy;
  midVersion?: number;
  onCountChange?: (count: number) => void;
  onRosterChanged?: () => void;
};

type AssignMode = 'allot' | 'reassign';

type AssignForm = {
  midId: string;
  midLabel: string;
  subAdminId: string;
  subAdminLabel: string;
  remark: string;
};

const emptyAssign: AssignForm = {
  midId: '',
  midLabel: '',
  subAdminId: '',
  subAdminLabel: '',
  remark: '',
};

export default function MidAllotmentPanel({
  updatedBy,
  midVersion = 0,
  onCountChange,
  onRosterChanged,
}: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(0);

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<MidAllotment[]>([]);
  const [rosterMode, setRosterMode] = useState<'all' | 'mine' | 'sub'>('all');
  const [filterSubAdminId, setFilterSubAdminId] = useState('');

  const [activeMids, setActiveMids] = useState<MidRecord[]>([]);
  const [subAdmins, setSubAdmins] = useState<SubAdminOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);

  const [assignMode, setAssignMode] = useState<AssignMode>('allot');
  const [assignForm, setAssignForm] = useState<AssignForm>(emptyAssign);
  const [saving, setSaving] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictMessage, setConflictMessage] = useState('');

  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<MidAllotment | null>(null);
  const [revokeRemark, setRevokeRemark] = useState('');

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRows, setHistoryRows] = useState<MidAllotment[]>([]);
  const [historyTitle, setHistoryTitle] = useState('');

  const onCountRef = useRef(onCountChange);
  onCountRef.current = onCountChange;
  const rosterGenRef = useRef(0);
  const optionsGenRef = useRef(0);
  const optionsLoadedRef = useRef(false);

  const loadRoster = useCallback(async () => {
    const gen = ++rosterGenRef.current;
    setLoading(true);
    try {
      const meId = updatedBy.userId;
      const subAdminId =
        rosterMode === 'mine' ? meId : rosterMode === 'sub' ? filterSubAdminId.trim() || undefined : undefined;
      const result = await fetchActiveAllotments({ subAdminId });
      if (gen !== rosterGenRef.current) return;
      setRows(result.items);
      onCountRef.current?.(result.total);
    } catch (error) {
      if (gen !== rosterGenRef.current) return;
      if (!isAbortError(error)) {
        toast.error(darApiErrorMessage(error, 'Failed to load roster'));
      }
      setRows([]);
      onCountRef.current?.(0);
    } finally {
      if (gen === rosterGenRef.current) setLoading(false);
    }
  }, [updatedBy.userId, rosterMode, filterSubAdminId]);

  const loadOptions = useCallback(async (force = false): Promise<SubAdminOption[]> => {
    if (optionsLoadedRef.current && !force) return [];
    const gen = ++optionsGenRef.current;
    setOptionsLoading(true);
    // Load independently so a MID list failure does not wipe the sub-admin dropdown.
    const midsPromise = fetchMids({ page: 1, limit: 500 })
      .then((result) =>
        result.items.filter((mid) => (mid.status || 'active') === 'active'),
      )
      .catch((): MidRecord[] => []);
    const subsPromise = loadSubAdminOptions().catch((): SubAdminOption[] => []);

    const [mids, subAdminList] = await Promise.all([midsPromise, subsPromise]);
    if (gen !== optionsGenRef.current) return subAdminList;
    setActiveMids(mids);
    setSubAdmins(subAdminList);
    optionsLoadedRef.current = true;
    setOptionsLoading(false);
    return subAdminList;
  }, []);

  useEffect(() => {
    optionsLoadedRef.current = false;
    void loadOptions(true);
    let cancelled = false;
    fetchActiveAllotments({})
      .then((result) => {
        if (!cancelled) onCountRef.current?.(result.total);
      })
      .catch(() => {
        if (!cancelled) onCountRef.current?.(0);
      });
    return () => {
      cancelled = true;
    };
  }, [midVersion, loadOptions]);

  useEffect(() => {
    if (!open || tab !== 1) return;
    void loadRoster();
    return () => {
      rosterGenRef.current += 1;
    };
  }, [open, tab, loadRoster, midVersion]);

  const ensureOptions = async () => {
    const list = await loadOptions(true);
    if (!list.length) toast.error('Sub-admin list could not be loaded');
  };

  const openModal = async (nextTab = 0) => {
    setAssignMode('allot');
    setAssignForm(emptyAssign);
    setTab(nextTab);
    setOpen(true);
    if (nextTab === 0) await ensureOptions();
  };

  const openCreateTab = async () => {
    setAssignMode('allot');
    setAssignForm(emptyAssign);
    setTab(0);
    await ensureOptions();
  };

  const openReassign = async (row: MidAllotment) => {
    setAssignMode('reassign');
    setAssignForm({
      midId: row.midId,
      midLabel: row.mid || row.midId,
      subAdminId: '',
      subAdminLabel: '',
      remark: '',
    });
    setTab(0);
    await ensureOptions();
  };

  const openRevoke = (row: MidAllotment) => {
    setRevokeTarget(row);
    setRevokeRemark('');
    setRevokeOpen(true);
  };

  const openHistory = async (row: MidAllotment) => {
    setHistoryTitle(row.mid || row.midId);
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const result = await fetchAllotmentHistory({ midId: row.midId, page: 1, limit: 20 });
      setHistoryRows(result.items);
    } catch (error) {
      toast.error(darApiErrorMessage(error, 'Failed to load history'));
      setHistoryRows([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const submitAssign = async (forceReassign = false) => {
    if (!assignForm.midId) {
      toast.error('Select a MID');
      return;
    }
    if (!assignForm.subAdminId) {
      toast.error('Select a sub-admin');
      return;
    }

    const body = {
      midId: assignForm.midId,
      subAdminId: assignForm.subAdminId,
      remark: assignForm.remark.trim() || undefined,
      updatedBy,
    };

    setSaving(true);
    try {
      const mode = forceReassign ? 'reassign' : assignMode;
      if (mode === 'reassign') {
        await reassignMid(body);
        toast.success('MID reassigned');
      } else {
        await allotMid(body);
        toast.success('MID allotted');
      }
      setConflictOpen(false);
      setAssignMode('allot');
      setAssignForm(emptyAssign);
      setTab(1);
      await loadRoster();
      onRosterChanged?.();
    } catch (error) {
      const status = (error as { status?: number })?.status;
      const message = darApiErrorMessage(error, 'Allotment failed');
      if (!forceReassign && assignMode === 'allot' && status === 409) {
        setConflictMessage(message);
        setConflictOpen(true);
        return;
      }
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const submitRevoke = async (event: FormEvent) => {
    event.preventDefault();
    if (!revokeTarget?.midId) return;
    setSaving(true);
    try {
      await revokeMid({ midId: revokeTarget.midId, remark: revokeRemark.trim() || undefined, updatedBy });
      toast.success('MID revoked');
      setRevokeOpen(false);
      await loadRoster();
      onRosterChanged?.();
    } catch (error) {
      toast.error(darApiErrorMessage(error, 'Failed to revoke MID'));
    } finally {
      setSaving(false);
    }
  };

  const midOptions = activeMids.map((mid) => ({
    id: mid._id,
    label: [mid.mid, mid.displayName, mid.upiId].filter(Boolean).join(' · '),
  }));

  return (
    <div className={dar.quickCardCell}>
      <QuickCard
        title="MID allotment"
        meta="Allot, reassign, or revoke holders"
        actionLabel="Allot MID"
        onClick={() => void openModal(0)}
      />

      <Dialog
        open={open}
        onClose={() => !saving && setOpen(false)}
        fullWidth
        maxWidth="lg"
        PaperProps={{
          className: cn(dar.dialogWide, tab === 1 && dar.dialogList),
        }}
        slotProps={{ backdrop: { className: dar.dialogBackdrop } }}
      >
        <DialogTitle className={dar.dialogTitle}>
          <strong className={dar.dialogTitleStrong}>MID allotments</strong>
          <span className={dar.dialogTitleSpan}>Create a new allotment or browse the active roster.</span>
        </DialogTitle>

        <Tabs
          className={dar.tabs}
          value={tab}
          onChange={(_e, value) => {
            setTab(value);
            if (value === 0) {
              setAssignMode('allot');
              setAssignForm(emptyAssign);
              void loadOptions(true);
            }
          }}
        >
          <Tab label={assignMode === 'reassign' && tab === 0 ? 'Reassign' : 'Create'} />
          <Tab label="List" />
        </Tabs>

        {tab === 0 ? (
          <>
            <DialogContent className={dar.form}>
              {assignMode === 'allot' ? (
                <Autocomplete
                  className={dar.span2}
                  size="small"
                  options={midOptions}
                  loading={optionsLoading}
                  value={midOptions.find((item) => item.id === assignForm.midId) || null}
                  onChange={(_e, value) =>
                    setAssignForm((current) => ({
                      ...current,
                      midId: value?.id || '',
                      midLabel: value?.label || '',
                    }))
                  }
                  getOptionLabel={(option) => option.label}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  renderInput={(params) => <TextField {...params} label="Active MID" required size="small" />}
                />
              ) : (
                <TextField className={dar.span2} size="small" label="MID" value={assignForm.midLabel} disabled />
              )}
              <Autocomplete
                className={dar.span2}
                size="small"
                options={subAdmins}
                loading={optionsLoading}
                value={subAdmins.find((item) => item.id === assignForm.subAdminId) || null}
                onChange={(_e, value) =>
                  setAssignForm((current) => ({
                    ...current,
                    subAdminId: value?.id || '',
                    subAdminLabel: value?.label || '',
                  }))
                }
                getOptionLabel={(option) => option.label}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={assignMode === 'reassign' ? 'New sub-admin' : 'Sub-admin holder'}
                    required
                    size="small"
                  />
                )}
              />
              <TextField
                className={dar.span2}
                size="small"
                label="Remark"
                value={assignForm.remark}
                onChange={(event) =>
                  setAssignForm((current) => ({ ...current, remark: event.target.value }))
                }
                placeholder="morning shift / phone handed over"
              />
            </DialogContent>
            <DialogActions className={dar.dialogActions}>
              <Button
                className={dar.btnGhost}
                onClick={() => {
                  setAssignMode('allot');
                  setAssignForm(emptyAssign);
                  setTab(1);
                }}
                disabled={saving}
              >
                View list
              </Button>
              <Button
                className={dar.btn}
                variant="contained"
                disabled={saving}
                onClick={() => void submitAssign(false)}
              >
                {saving ? 'Saving...' : assignMode === 'reassign' ? 'Reassign' : 'Allot'}
              </Button>
            </DialogActions>
          </>
        ) : (
          <>
            <DialogContent className={dar.modalList}>
              <div className={dar.toolbarModal}>
                <TextField
                  className={dar.select}
                  select
                  size="small"
                  fullWidth={false}
                  label="Roster"
                  value={rosterMode}
                  onChange={(event) => {
                    const value = event.target.value as 'all' | 'mine' | 'sub';
                    setRosterMode(value);
                    if (value !== 'sub') setFilterSubAdminId('');
                    if (value === 'sub' && !subAdmins.length) void loadOptions();
                  }}
                >
                  <MenuItem value="all">All active</MenuItem>
                  <MenuItem value="mine">My phones</MenuItem>
                  <MenuItem value="sub">By sub-admin</MenuItem>
                </TextField>
                {rosterMode === 'sub' ? (
                  <Autocomplete
                    className={dar.grow}
                    size="small"
                    options={subAdmins}
                    loading={optionsLoading}
                    value={subAdmins.find((item) => item.id === filterSubAdminId) || null}
                    onOpen={() => {
                      if (!subAdmins.length) void loadOptions();
                    }}
                    onChange={(_e, value) => setFilterSubAdminId(value?.id || '')}
                    getOptionLabel={(option) => option.label}
                    isOptionEqualToValue={(a, b) => a.id === b.id}
                    renderInput={(params) => <TextField {...params} label="Filter sub-admin" size="small" />}
                  />
                ) : null}
                <Button className={dar.btnGhost} variant="outlined" onClick={() => void loadRoster()}>
                  Refresh
                </Button>
              </div>

              {loading ? (
                <TableLoader />
              ) : rows.length ? (
                <DarVirtualTable
                  rows={rows}
                  colSpan={7}
                  estimateSize={48}
                  wrapClassName={dar.tableWrapModal}
                  tableClassName={dar.table}
                  getRowKey={(row) => row._id}
                  head={
                    <thead>
                      <tr>
                        <th className={dar.th}>MID</th>
                        <th className={dar.th}>Holder</th>
                        <th className={dar.th}>Emp</th>
                        <th className={dar.th}>Assigned</th>
                        <th className={dar.th}>Remark</th>
                        <th className={dar.th}>Status</th>
                        <th className={cn(dar.th, dar.colAction)}>Action</th>
                      </tr>
                    </thead>
                  }
                  renderRow={(row) => (
                    <>
                      <td className={dar.td}>
                        <span className={dar.name}>{row.mid || row.midId}</span>
                      </td>
                      <td className={dar.td}>{row.subAdminName || row.subAdminId || '-'}</td>
                      <td className={cn(dar.td, dar.mono)}>{row.empCode || '-'}</td>
                      <td className={dar.td}>{formatAllotmentTime(row.assignedAt)}</td>
                      <td className={dar.td}>{row.remark || '-'}</td>
                      <td className={dar.td}>
                        <StatusPill status={row.active ? 'active' : 'inactive'} />
                      </td>
                      <td className={dar.colAction}>
                        <div className={dar.actions}>
                          <Button className={dar.link} size="small" onClick={() => void openReassign(row)}>
                            Reassign
                          </Button>
                          <Button className={dar.link} size="small" onClick={() => openRevoke(row)}>
                            Revoke
                          </Button>
                          <Button className={dar.link} size="small" onClick={() => void openHistory(row)}>
                            History
                          </Button>
                        </div>
                      </td>
                    </>
                  )}
                />
              ) : (
                <EmptyState title="No active allotments" subtitle="Switch to Create to allot a MID." />
              )}

              <div className={dar.pager}>
                <span className={dar.pagerCount}>
                  {rows.length} active allotment{rows.length === 1 ? '' : 's'}
                </span>
              </div>
            </DialogContent>
            <DialogActions className={dar.dialogActions}>
              <Button className={dar.btnGhost} onClick={() => setOpen(false)}>
                Close
              </Button>
              <Button className={dar.btn} variant="contained" onClick={() => void openCreateTab()}>
                Create new
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Dialog
        open={conflictOpen}
        onClose={() => !saving && setConflictOpen(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{ className: dar.dialog }} slotProps={{ backdrop: { className: dar.dialogBackdrop } }}
      >
        <DialogTitle className={dar.dialogTitle}>
          <strong className={dar.dialogTitleStrong}>Already allotted</strong>
          <span className={dar.dialogTitleSpan}>
            {conflictMessage || 'MID is already with someone else.'}
          </span>
        </DialogTitle>
        <DialogActions className={dar.dialogActions}>
          <Button className={dar.btnGhost} onClick={() => setConflictOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button className={dar.btn} variant="contained" disabled={saving} onClick={() => void submitAssign(true)}>
            {saving ? 'Reassigning...' : 'Reassign instead'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={revokeOpen}
        onClose={() => !saving && setRevokeOpen(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{ className: dar.dialog }} slotProps={{ backdrop: { className: dar.dialogBackdrop } }}
      >
        <form onSubmit={submitRevoke}>
          <DialogTitle className={dar.dialogTitle}>
            <strong className={dar.dialogTitleStrong}>Revoke MID</strong>
            <span className={dar.dialogTitleSpan}>
              End holding for <SoftPill>{revokeTarget?.mid || revokeTarget?.midId}</SoftPill> without assigning a
              new holder.
            </span>
          </DialogTitle>
          <DialogContent className={dar.form}>
            <TextField
              className={dar.span2}
              size="small"
              label="Remark"
              value={revokeRemark}
              onChange={(event) => setRevokeRemark(event.target.value)}
              placeholder="phone sent for repair"
            />
          </DialogContent>
          <DialogActions className={dar.dialogActions}>
            <Button className={dar.btnGhost} onClick={() => setRevokeOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button className={dar.btn} type="submit" variant="contained" color="error" disabled={saving}>
              {saving ? 'Revoking...' : 'Revoke'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        fullWidth
        maxWidth="md"
        PaperProps={{ className: dar.dialogWide }} slotProps={{ backdrop: { className: dar.dialogBackdrop } }}
      >
        <DialogTitle className={dar.dialogTitle}>
          <strong className={dar.dialogTitleStrong}>MID timeline</strong>
          <span className={dar.dialogTitleSpan}>{historyTitle}</span>
        </DialogTitle>
        <DialogContent>
          {historyLoading ? (
            <TableLoader />
          ) : historyRows.length ? (
            <DarVirtualTable
              rows={historyRows}
              colSpan={6}
              wrapClassName={dar.tableWrapModal}
              tableClassName={dar.table}
              getRowKey={(row) => row._id}
              head={
                <thead>
                  <tr>
                    <th className={dar.th}>Holder</th>
                    <th className={dar.th}>Assigned</th>
                    <th className={dar.th}>Ended</th>
                    <th className={dar.th}>Reason</th>
                    <th className={dar.th}>Remark</th>
                    <th className={dar.th}>Active</th>
                  </tr>
                </thead>
              }
              renderRow={(row) => (
                <>
                  <td className={dar.td}>
                    {row.subAdminName || row.subAdminId}
                    {row.empCode ? ` · ${row.empCode}` : ''}
                  </td>
                  <td className={dar.td}>{formatAllotmentTime(row.assignedAt)}</td>
                  <td className={dar.td}>{formatAllotmentTime(row.deactivatedAt)}</td>
                  <td className={dar.td}>{row.deactivateReason || '-'}</td>
                  <td className={dar.td}>{row.remark || '-'}</td>
                  <td className={dar.td}>
                    <StatusPill status={row.active ? 'active' : 'inactive'} />
                  </td>
                </>
              )}
            />
          ) : (
            <EmptyState title="No history" subtitle="No allotment rows found for this MID." />
          )}
        </DialogContent>
        <DialogActions className={dar.dialogActions}>
          <Button className={dar.btnGhost} onClick={() => setHistoryOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
