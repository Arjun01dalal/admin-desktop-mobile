import { cn } from '@/lib/utils';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { toast } from 'react-toastify';
import {
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
import { MID_SOURCES, PAGE_SIZE, bankOptionLabel, omitEmpty, sourceLabel } from '@astro/shared/dailyAccountReport';
import { createMid, darApiErrorMessage, fetchBankAccounts, fetchMids, updateMid } from './api';
import type { BankAccount, MidRecord, UpdatedBy } from './api';
import { DarVirtualTable } from './DarVirtualTable';
import { useDarList } from './useDarList';
import {
  EmptyState,
  Pager,
  QuickCard,
  SoftPill,
  StatusField,
  StatusFilter,
  StatusPill,
  TableLoader,
} from './darUi';
import { dar } from './darStyles';

const emptyForm = {
  mid: '',
  displayName: '',
  phoneNumber: '',
  upiId: '',
  bankAccountId: '',
  source: 'manual',
  sourceAccountId: '',
  status: 'active',
};

type FormState = typeof emptyForm & { _id?: string };

type Props = {
  updatedBy: UpdatedBy;
  bankVersion: number;
  onCountChange?: (count: number) => void;
  onSaved?: () => void;
};

export default function MidPanel({ updatedBy, bankVersion, onCountChange, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(0);
  const [sourceFilter, setSourceFilter] = useState('');
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const list = useDarList<MidRecord>({
    fetchPage: ({ page, search, status, source }) =>
      fetchMids({ page, search, status, source, limit: PAGE_SIZE }),
    errorFallback: 'Failed to load MIDs',
    onCountChange,
    source: sourceFilter,
    enabled: open && tab === 1,
  });

  const bankMap = useMemo(() => {
    const map = new Map<string, BankAccount>();
    banks.forEach((account) => map.set(account._id, account));
    return map;
  }, [banks]);

  const loadBanks = () => {
    fetchBankAccounts({ page: 1, limit: 200 })
      .then((result) => setBanks(result.items))
      .catch(() => setBanks([]));
  };

  // Refresh bank choices only while the modal is open (create/edit + list labels).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchBankAccounts({ page: 1, limit: 200 })
      .then((result) => {
        if (!cancelled) setBanks(result.items);
      })
      .catch(() => {
        if (!cancelled) setBanks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [bankVersion, open]);

  useEffect(() => {
    let cancelled = false;
    fetchMids({ page: 1, limit: 1, status: 'active' })
      .then((result) => {
        if (!cancelled) onCountChange?.(result.total);
      })
      .catch(() => {
        if (!cancelled) onCountChange?.(0);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankVersion]);

  const resolveBankLabel = (row: MidRecord) => {
    if (row.bankLabel) return row.bankLabel;
    const match = bankMap.get(row.bankAccountId);
    return match ? bankOptionLabel(match) : row.bankAccountId || '-';
  };

  const bankChoices = useMemo(() => {
    if (form._id) return banks;
    const active = banks.filter((account) => account.status !== 'inactive');
    return active.length ? active : banks;
  }, [banks, form._id]);

  const setField = (key: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const openModal = (nextTab = 0) => {
    loadBanks();
    setForm(emptyForm);
    setTab(nextTab);
    setOpen(true);
  };

  const openEdit = (row: MidRecord) => {
    loadBanks();
    setForm({
      _id: row._id,
      mid: row.mid,
      displayName: row.displayName,
      phoneNumber: row.phoneNumber,
      upiId: row.upiId,
      bankAccountId: row.bankAccountId,
      source: row.source || 'manual',
      sourceAccountId: row.sourceAccountId,
      status: row.status || 'active',
    });
    setTab(0);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form._id && !form.mid.trim()) {
      toast.error('MID is required');
      return;
    }
    if (!form.bankAccountId) {
      toast.error('Select a bank account');
      return;
    }

    const body: Record<string, unknown> = {
      displayName: form.displayName.trim(),
      phoneNumber: form.phoneNumber.trim(),
      upiId: form.upiId.trim(),
      bankAccountId: form.bankAccountId,
      source: form.source || 'manual',
      updatedBy,
    };

    if (form.source === 'manual') {
      if (form._id) body.sourceAccountId = '';
    } else {
      body.sourceAccountId = form.sourceAccountId.trim();
    }

    setSaving(true);
    try {
      if (form._id) {
        await updateMid({ ...body, _id: form._id, status: form.status || 'active' });
        toast.success('MID updated');
      } else {
        await createMid(omitEmpty({ ...body, mid: form.mid.trim() }));
        toast.success('MID created');
      }
      onSaved?.();
      setForm(emptyForm);
      setTab(1);
      list.afterSave(!form._id);
    } catch (error) {
      toast.error(darApiErrorMessage(error, 'Failed to save MID'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={dar.quickCardCell}>
      <QuickCard
        title="MID mapping"
        meta="Link MID / UPI to a bank account"
        actionLabel="Add MID"
        onClick={() => openModal(0)}
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
          <strong className={dar.dialogTitleStrong}>MID mapping</strong>
          <span className={dar.dialogTitleSpan}>Create a MID or browse mapped accounts.</span>
        </DialogTitle>

        <Tabs
          className={dar.tabs}
          value={tab}
          onChange={(_e, value) => {
            setTab(value);
            if (value === 0 && !form._id) {
              setForm(emptyForm);
              loadBanks();
            }
          }}
        >
          <Tab label={form._id ? 'Edit' : 'Create'} />
          <Tab label="List" />
        </Tabs>

        {tab === 0 ? (
          <form onSubmit={submit}>
            <DialogContent className={dar.form}>
              <TextField
                label="MID"
                value={form.mid}
                onChange={(event) => setField('mid', event.target.value)}
                required
                size="small"
                disabled={Boolean(form._id)}
              />
              <TextField
                label="Display name"
                value={form.displayName}
                onChange={(event) => setField('displayName', event.target.value)}
                size="small"
              />
              <TextField
                label="Phone"
                value={form.phoneNumber}
                onChange={(event) => setField('phoneNumber', event.target.value)}
                size="small"
              />
              <TextField
                label="UPI id"
                value={form.upiId}
                onChange={(event) => setField('upiId', event.target.value)}
                size="small"
              />
              <TextField
                className={dar.span2}
                select
                label="Bank account"
                value={form.bankAccountId}
                onChange={(event) => setField('bankAccountId', event.target.value)}
                required
                size="small"
                helperText={bankChoices.length ? 'Select a bank account' : 'Create a bank account first'}
              >
                {form.bankAccountId && !bankMap.has(form.bankAccountId) ? (
                  <MenuItem value={form.bankAccountId}>{form.bankAccountId}</MenuItem>
                ) : null}
                {bankChoices.map((account) => (
                  <MenuItem key={account._id} value={account._id}>
                    {bankOptionLabel(account)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Source"
                value={form.source}
                onChange={(event) => setField('source', event.target.value)}
                size="small"
              >
                {MID_SOURCES.map((item) => (
                  <MenuItem key={item} value={item}>
                    {sourceLabel(item)}
                  </MenuItem>
                ))}
              </TextField>
              {form.source !== 'manual' ? (
                <TextField
                  label="Source account id"
                  value={form.sourceAccountId}
                  onChange={(event) => setField('sourceAccountId', event.target.value)}
                  size="small"
                />
              ) : null}
              {form._id ? (
                <StatusField
                  value={form.status}
                  onChange={(value) => setField('status', value)}
                  helperText="Use inactive instead of deleting the MID"
                />
              ) : null}
            </DialogContent>
            <DialogActions className={dar.dialogActions}>
              <Button
                className={dar.btnGhost}
                onClick={() => {
                  setForm(emptyForm);
                  setTab(1);
                }}
                disabled={saving}
              >
                View list
              </Button>
              <Button
                className={dar.btn}
                type="submit"
                variant="contained"
                disabled={saving || (!form._id && !bankChoices.length)}
              >
                {saving ? 'Saving...' : form._id ? 'Update MID' : 'Save MID'}
              </Button>
            </DialogActions>
          </form>
        ) : (
          <>
            <DialogContent className={dar.modalList}>
              <form
                className={dar.toolbarModal}
                onSubmit={(event) => {
                  event.preventDefault();
                  list.applySearch();
                }}
              >
                <TextField
                  className={dar.grow}
                  size="small"
                  fullWidth={false}
                  label="Search MID, name, UPI, phone"
                  sx={{ flex: 1, minWidth: 200 }}
                  value={list.search}
                  onChange={(event) => list.setSearch(event.target.value)}
                />
                <StatusFilter
                  value={list.status}
                  onChange={(value) => {
                    list.setStatus(value);
                    list.setPage(1);
                  }}
                />
                <TextField
                  className={dar.select}
                  select
                  size="small"
                  fullWidth={false}
                  label="Source"
                  value={sourceFilter}
                  SelectProps={{ displayEmpty: true }}
                  onChange={(event) => {
                    setSourceFilter(event.target.value);
                    list.setPage(1);
                  }}
                >
                  <MenuItem value="">All</MenuItem>
                  {MID_SOURCES.map((item) => (
                    <MenuItem key={item} value={item}>
                      {sourceLabel(item)}
                    </MenuItem>
                  ))}
                </TextField>
                <Button className={dar.btnGhost} type="submit" variant="outlined">
                  Search
                </Button>
              </form>

              {list.loading ? (
                <TableLoader />
              ) : list.rows.length ? (
                <DarVirtualTable
                  rows={list.rows}
                  colSpan={8}
                  wrapClassName={dar.tableWrapModal}
                  tableClassName={dar.table}
                  getRowKey={(row) => row._id}
                  head={
                    <thead>
                      <tr>
                        <th className={dar.th}>MID</th>
                        <th className={dar.th}>Display</th>
                        <th className={dar.th}>UPI</th>
                        <th className={dar.th}>Phone</th>
                        <th className={dar.th}>Bank</th>
                        <th className={dar.th}>Source</th>
                        <th className={dar.th}>Status</th>
                        <th className={cn(dar.th, dar.colAction)}>Action</th>
                      </tr>
                    </thead>
                  }
                  renderRow={(row) => (
                    <>
                      <td className={dar.td}>
                        <span className={dar.name}>{row.mid || '-'}</span>
                      </td>
                      <td className={dar.td}>{row.displayName || '-'}</td>
                      <td className={cn(dar.td, dar.mono)}>{row.upiId || '-'}</td>
                      <td className={cn(dar.td, dar.mono)}>{row.phoneNumber || '-'}</td>
                      <td className={dar.td}>{resolveBankLabel(row)}</td>
                      <td className={dar.td}>
                        <SoftPill>{sourceLabel(row.source)}</SoftPill>
                      </td>
                      <td className={dar.td}>
                        <StatusPill status={row.status} />
                      </td>
                      <td className={dar.colAction}>
                        <Button className={dar.link} size="small" onClick={() => openEdit(row)}>
                          Edit
                        </Button>
                      </td>
                    </>
                  )}
                />
              ) : (
                <EmptyState title="No MIDs yet" subtitle="Switch to Create after adding a bank account." />
              )}

              <Pager
                total={list.total}
                label="MIDs"
                page={list.page}
                pages={list.pages}
                onPrev={() => list.setPage((value) => value - 1)}
                onNext={() => list.setPage((value) => value + 1)}
              />
            </DialogContent>
            <DialogActions className={dar.dialogActions}>
              <Button className={dar.btnGhost} onClick={() => setOpen(false)}>
                Close
              </Button>
              <Button
                className={dar.btn}
                variant="contained"
                onClick={() => {
                  setForm(emptyForm);
                  loadBanks();
                  setTab(0);
                }}
              >
                Create new
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </div>
  );
}
