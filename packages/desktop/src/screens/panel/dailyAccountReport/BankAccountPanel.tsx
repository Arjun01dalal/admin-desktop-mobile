import { cn } from '@/lib/utils';
import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'react-toastify';

import { ACCOUNT_TYPES, PAGE_SIZE, isValidAccountNumber, isValidIfsc, omitEmpty } from '@astro/shared/dailyAccountReport';
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

import { createBankAccount, darApiErrorMessage, fetchBankAccounts, updateBankAccount } from './api';
import { DarVirtualTable } from './DarVirtualTable';
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
import type { BankAccount, UpdatedBy } from './api';
import { useDarList } from './useDarList';



const emptyForm = {
  bankName: '',
  accountHolderName: '',
  accountNumber: '',
  ifscCode: '',
  accountType: 'savings',
  displayName: '',
  status: 'active',
};

type FormState = typeof emptyForm & { _id?: string };

type Props = {
  updatedBy: UpdatedBy;
  onSaved: () => void;
  onCountChange?: (count: number) => void;
};

export default function BankAccountPanel({ updatedBy, onSaved, onCountChange }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const list = useDarList<BankAccount>({
    fetchPage: ({ page, search, status }) => fetchBankAccounts({ page, search, status, limit: PAGE_SIZE }),
    errorFallback: 'Failed to load bank accounts',
    onCountChange,
    enabled: open && tab === 1,
  });

  useEffect(() => {
    let cancelled = false;
    fetchBankAccounts({ page: 1, limit: 1 })
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
  }, []);

  const setField = (key: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const openModal = (nextTab = 0) => {
    setForm(emptyForm);
    setTab(nextTab);
    setOpen(true);
  };

  const openEdit = (row: BankAccount) => {
    setForm({
      _id: row._id,
      bankName: row.bankName,
      accountHolderName: row.accountHolderName,
      accountNumber: row.accountNumber,
      ifscCode: row.ifscCode,
      accountType: row.accountType || 'savings',
      displayName: row.displayName,
      status: row.status || 'active',
    });
    setTab(0);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const accountNumber = form.accountNumber.replace(/\s/g, '');
    const ifscCode = form.ifscCode.trim().toUpperCase();

    if (!form.bankName.trim() || !form.accountHolderName.trim()) {
      toast.error('Bank name and account holder are required');
      return;
    }
    if (!isValidAccountNumber(accountNumber)) {
      toast.error('Account number must be 9 to 18 digits');
      return;
    }
    if (!isValidIfsc(ifscCode)) {
      toast.error('Enter a valid IFSC code');
      return;
    }

    const base = {
      bankName: form.bankName.trim(),
      accountHolderName: form.accountHolderName.trim(),
      accountNumber,
      ifscCode,
      accountType: form.accountType || 'savings',
      displayName: form.displayName.trim(),
      updatedBy,
    };

    setSaving(true);
    try {
      if (form._id) {
        await updateBankAccount({ ...base, _id: form._id, status: form.status || 'active' });
        toast.success('Bank account updated');
      } else {
        await createBankAccount(omitEmpty(base));
        toast.success('Bank account created');
      }
      onSaved();
      setForm(emptyForm);
      setTab(1);
      list.afterSave(!form._id);
      fetchBankAccounts({ page: 1, limit: 1 })
        .then((result) => onCountChange?.(result.total))
        .catch(() => undefined);
    } catch (error) {
      toast.error(darApiErrorMessage(error, 'Failed to save bank account'));
    } finally {
      setSaving(false);
    }
  };

  const accountTypes = (ACCOUNT_TYPES as readonly string[]).includes(form.accountType)
    ? ACCOUNT_TYPES
    : [form.accountType, ...ACCOUNT_TYPES];

  return (
    <div className={dar.quickCardCell}>
      <QuickCard
        title="Bank account"
        meta="Create or view ledger accounts"
        actionLabel="Add bank account"
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
          <strong className={dar.dialogTitleStrong}>Bank accounts</strong>
          <span className={dar.dialogTitleSpan}>Create a new account or browse the list.</span>
        </DialogTitle>

        <Tabs
          className={dar.tabs}
          value={tab}
          onChange={(_e, value) => {
            setTab(value);
            if (value === 0 && !form._id) setForm(emptyForm);
          }}
        >
          <Tab label={form._id ? 'Edit' : 'Create'} />
          <Tab label="List" />
        </Tabs>

        {tab === 0 ? (
          <form onSubmit={submit}>
            <DialogContent className={dar.form}>
              <TextField
                label="Bank name"
                value={form.bankName}
                onChange={(event) => setField('bankName', event.target.value)}
                required
                size="small"
              />
              <TextField
                label="Account holder"
                value={form.accountHolderName}
                onChange={(event) => setField('accountHolderName', event.target.value)}
                required
                size="small"
              />
              <TextField
                label="Account number"
                value={form.accountNumber}
                onChange={(event) => setField('accountNumber', event.target.value)}
                required
                size="small"
                inputProps={{ inputMode: 'numeric' }}
              />
              <TextField
                label="IFSC"
                value={form.ifscCode}
                onChange={(event) => setField('ifscCode', event.target.value.toUpperCase())}
                required
                size="small"
              />
              <TextField
                select
                label="Account type"
                value={form.accountType}
                onChange={(event) => setField('accountType', event.target.value)}
                size="small"
              >
                {accountTypes.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Display name"
                value={form.displayName}
                onChange={(event) => setField('displayName', event.target.value)}
                size="small"
                placeholder="HDFC - Ramesh"
              />
              {form._id ? (
                <StatusField
                  value={form.status}
                  onChange={(value) => setField('status', value)}
                  helperText="Use inactive instead of deleting the account"
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
              <Button className={dar.btn} type="submit" variant="contained" disabled={saving}>
                {saving ? 'Saving...' : form._id ? 'Update account' : 'Save account'}
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
                  label="Search bank, holder, account"
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
                        <th className={dar.th}>Bank</th>
                        <th className={dar.th}>Display</th>
                        <th className={dar.th}>Holder</th>
                        <th className={dar.th}>A/C No.</th>
                        <th className={dar.th}>IFSC</th>
                        <th className={dar.th}>Type</th>
                        <th className={dar.th}>Status</th>
                        <th className={cn(dar.th, dar.colAction)}>Action</th>
                      </tr>
                    </thead>
                  }
                  renderRow={(row) => (
                    <>
                      <td className={dar.td}>
                        <span className={dar.name}>{row.bankName || '-'}</span>
                      </td>
                      <td className={dar.td}>{row.displayName || '-'}</td>
                      <td className={dar.td}>{row.accountHolderName || '-'}</td>
                      <td className={dar.td}>
                        <span className={cn(dar.accountNo, dar.mono)}>{row.accountNumber || '-'}</span>
                      </td>
                      <td className={cn(dar.td, dar.mono)}>{row.ifscCode || '-'}</td>
                      <td className={dar.td}>
                        <SoftPill>{row.accountType || '-'}</SoftPill>
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
                <EmptyState title="No bank accounts yet" subtitle="Switch to Create to add the first account." />
              )}

              <Pager
                total={list.total}
                label="accounts"
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
