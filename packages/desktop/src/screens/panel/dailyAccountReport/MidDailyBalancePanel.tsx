import { cn } from '@/lib/utils';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { toast } from 'react-toastify';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  TextField,
  Tooltip,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  darTodayIstDate,
  dayBalanceStatus,
  formatBalanceAmount,
  isAbortError,
  mergeDaySheetWithAllotments,
  validateBalanceImageFile,
  type BalanceType,
} from '@astro/shared/dailyAccountReport';
import {
  correctDailyBalance,
  darApiErrorMessage,
  fetchActiveAllotments,
  fetchDaySheet,
  getDailyBalanceById,
  loadSubAdminOptions,
  upsertDailyBalance,
} from './api';
import type { DailyBalanceRow, DaySheetItem, SubAdminOption, UpdatedBy } from './api';
import { DarVirtualTable } from './DarVirtualTable';
import { EmptyState, PanelShell, SoftPill, TableLoader } from './darUi';
import { dar } from './darStyles';

type Props = {
  updatedBy: UpdatedBy;
  step?: number | string;
  allotmentVersion?: number;
  /** Allotment managers see every active phone; holders only see their own. */
  viewAllAllotments?: boolean;
};

type EntryMode = 'open' | 'close' | 'correct';

type EntryForm = {
  mode: EntryMode;
  midId: string;
  midLabel: string;
  date: string;
  amount: string;
  remark: string;
  rowId: string;
  existingImageUrl: string;
};

const emptyEntry = (date: string): EntryForm => ({
  mode: 'open',
  midId: '',
  midLabel: '',
  date,
  amount: '',
  remark: '',
  rowId: '',
  existingImageUrl: '',
});

export default function MidDailyBalancePanel({
  updatedBy,
  step = 4,
  allotmentVersion = 0,
  viewAllAllotments = false,
}: Props) {
  const meId = updatedBy.userId;
  const [date, setDate] = useState(darTodayIstDate());
  const [midFilter, setMidFilter] = useState('');
  const [subAdminFilter, setSubAdminFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<DaySheetItem[]>([]);
  const [phoneCount, setPhoneCount] = useState(0);
  const [holders, setHolders] = useState<SubAdminOption[]>([]);

  const [entryOpen, setEntryOpen] = useState(false);
  const [entry, setEntry] = useState<EntryForm>(() => emptyEntry(darTodayIstDate()));
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailRow, setDetailRow] = useState<DailyBalanceRow | null>(null);

  const loadGenRef = useRef(0);
  const detailGenRef = useRef(0);
  const userNameRef = useRef(updatedBy.userName);
  userNameRef.current = updatedBy.userName;

  // Holder dropdown for managers — once per mount / when allot roster changes.
  useEffect(() => {
    if (!viewAllAllotments) {
      setHolders([]);
      return;
    }
    let cancelled = false;
    loadSubAdminOptions()
      .then((options) => {
        if (!cancelled) setHolders(options);
      })
      .catch(() => {
        if (!cancelled) setHolders([]);
      });
    return () => {
      cancelled = true;
    };
  }, [viewAllAllotments, allotmentVersion]);

  const openDetail = async (rowId?: string) => {
    const id = String(rowId || '').trim();
    if (!id) {
      toast.error('Balance id missing');
      return;
    }
    const gen = ++detailGenRef.current;
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailRow(null);
    try {
      const row = await getDailyBalanceById(id);
      if (gen !== detailGenRef.current) return;
      setDetailRow(row);
    } catch (error) {
      if (gen !== detailGenRef.current) return;
      toast.error(darApiErrorMessage(error, 'Failed to load balance detail'));
      setDetailOpen(false);
    } finally {
      if (gen === detailGenRef.current) setDetailLoading(false);
    }
  };

  const loadSheet = useCallback(async () => {
    if (!viewAllAllotments && !meId) return;

    const gen = ++loadGenRef.current;
    setLoading(true);

    // Holders: only my phones. Managers: optional server-side sub-admin scope.
    const scopeSubAdminId = viewAllAllotments
      ? subAdminFilter.trim() || undefined
      : meId || undefined;

    try {
      const [active, sheet] = await Promise.all([
        fetchActiveAllotments({ ...(scopeSubAdminId ? { subAdminId: scopeSubAdminId } : {}) }),
        fetchDaySheet({ date, ...(scopeSubAdminId ? { subAdminId: scopeSubAdminId } : {}) }),
      ]);
      if (gen !== loadGenRef.current) return;

      const merged = mergeDaySheetWithAllotments({
        allotments: active.items,
        sheetItems: sheet.items,
        date,
        fallbackSubAdminId: meId,
        fallbackSubAdminName: userNameRef.current,
      });

      setItems(merged);
      setPhoneCount(active.total || active.items.length);
    } catch (error) {
      if (gen !== loadGenRef.current) return;
      if (!isAbortError(error)) {
        toast.error(darApiErrorMessage(error, 'Failed to load day sheet'));
      }
      setItems([]);
      setPhoneCount(0);
    } finally {
      if (gen === loadGenRef.current) setLoading(false);
    }
  }, [date, meId, subAdminFilter, viewAllAllotments]);

  useEffect(() => {
    void loadSheet();
    return () => {
      loadGenRef.current += 1;
    };
  }, [loadSheet, allotmentVersion]);

  const openEntry = (item: DaySheetItem, mode: EntryMode, row?: DailyBalanceRow | null) => {
    setEntry({
      mode,
      midId: item.midId,
      midLabel: item.mid || item.midId,
      date: item.date || date,
      amount: row ? String(row.amount) : '',
      remark: mode === 'correct' ? '' : row?.remark || '',
      rowId: row?._id || '',
      existingImageUrl: row?.image?.url || '',
    });
    setImageFile(null);
    setEntryOpen(true);
  };

  const onPickImage = (file: File | null) => {
    if (!file) {
      setImageFile(null);
      return;
    }
    const error = validateBalanceImageFile(file);
    if (error) {
      toast.error(error);
      return;
    }
    setImageFile(file);
  };

  const submitEntry = async (event: FormEvent) => {
    event.preventDefault();
    if (!entry.midId) {
      toast.error('MID is required');
      return;
    }
    const amountNum = Number(String(entry.amount).replace(/,/g, ''));
    if (!Number.isFinite(amountNum) || amountNum < 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (entry.mode === 'correct' && !entry.remark.trim()) {
      toast.error('Remark is required for correction');
      return;
    }

    setSaving(true);
    try {
      if (entry.mode === 'correct') {
        await correctDailyBalance({
          _id: entry.rowId,
          amount: amountNum,
          remark: entry.remark.trim(),
          image: imageFile,
          updatedBy,
        });
        toast.success('Balance corrected');
      } else {
        try {
          await upsertDailyBalance({
            midId: entry.midId,
            type: entry.mode as BalanceType,
            amount: amountNum,
            date: entry.date || date,
            remark: entry.remark.trim() || undefined,
            image: imageFile,
            updatedBy,
          });
          toast.success(entry.mode === 'open' ? 'Opening balance saved' : 'Closing balance saved');
        } catch (error) {
          const status = (error as { status?: number })?.status;
          if (status === 409) {
            const message = darApiErrorMessage(error, 'Already recorded for this day');
            toast.info(`${message}. Update with a remark.`);
            const sheet = await fetchDaySheet({
              date: entry.date || date,
              midId: entry.midId,
              ...(meId ? { subAdminId: meId } : {}),
            });
            const sheetRow = sheet.items.find((row) => row.midId === entry.midId) || sheet.items[0];
            const existing = entry.mode === 'open' ? sheetRow?.open : sheetRow?.close;
            if (existing?._id) {
              setEntry((current) => ({
                ...current,
                mode: 'correct',
                rowId: existing._id,
                amount: String(amountNum),
                existingImageUrl: existing.image?.url || '',
                remark: '',
              }));
              return;
            }
          }
          throw error;
        }
      }
      setEntryOpen(false);
      await loadSheet();
    } catch (error) {
      toast.error(darApiErrorMessage(error, 'Failed to save balance'));
    } finally {
      setSaving(false);
    }
  };

  const midOptions = useMemo(
    () =>
      Array.from(
        new Map(
          items.filter((item) => item.midId).map((item) => [item.midId, item.mid || item.midId]),
        ).entries(),
      ),
    [items],
  );

  const visibleItems = useMemo(
    () => (midFilter ? items.filter((item) => item.midId === midFilter) : items),
    [items, midFilter],
  );

  const holderOptions = useMemo(() => {
    if (holders.length) {
      return holders.map((holder) => [holder.id, holder.label || holder.name || holder.id] as const);
    }
    // Fallback from sheet rows if sub-admin list hasn't loaded yet.
    return Array.from(
      new Map(
        items
          .filter((item) => item.subAdminId)
          .map((item) => [item.subAdminId, item.subAdminName || item.subAdminId]),
      ).entries(),
    );
  }, [holders, items]);

  return (
    <PanelShell
      step={step}
      title="Daily Balances"
      subtitle={
        viewAllAllotments
          ? 'Open / close for allotted phones (IST). Managers see the full roster.'
          : 'Open / close for your allotted phones (IST).'
      }
      actionLabel="Refresh"
      onAction={() => void loadSheet()}
    >
      <div className={dar.balanceToolbar}>
        <TextField
          className={dar.date}
          type="date"
          size="small"
          fullWidth={false}
          label="Date (IST)"
          InputLabelProps={{ shrink: true }}
          value={date}
          onChange={(event) => {
            setDate(event.target.value);
            setMidFilter('');
          }}
        />
        {viewAllAllotments ? (
          <TextField
            className={dar.midFilter}
            select
            size="small"
            fullWidth={false}
            label="Sub-admin"
            value={subAdminFilter}
            SelectProps={{ displayEmpty: true }}
            onChange={(event) => {
              setSubAdminFilter(event.target.value);
              setMidFilter('');
            }}
          >
            <MenuItem value="">All holders</MenuItem>
            {holderOptions.map(([id, label]) => (
              <MenuItem key={id} value={id}>
                {label}
              </MenuItem>
            ))}
          </TextField>
        ) : null}
        <TextField
          className={dar.midFilter}
          select
          size="small"
          fullWidth={false}
          label="MID"
          value={midFilter}
          SelectProps={{ displayEmpty: true }}
          onChange={(event) => setMidFilter(event.target.value)}
        >
          <MenuItem value="">All</MenuItem>
          {midOptions.map(([midId, midLabel]) => (
            <MenuItem key={midId} value={midId}>
              {midLabel}
            </MenuItem>
          ))}
        </TextField>
        <span className={dar.balanceMeta}>
          {phoneCount
            ? `${phoneCount} phone${phoneCount === 1 ? '' : 's'} allotted`
            : 'No phones allotted'}
        </span>
      </div>

      {loading ? (
        <TableLoader />
      ) : visibleItems.length ? (
        <DarVirtualTable
          rows={visibleItems}
          colSpan={8}
          estimateSize={56}
          threshold={20}
          wrapClassName={dar.balanceWrap}
          tableClassName={dar.balanceTable}
          getRowKey={(item, index) => item.midId || `${item.mid}-${index}`}
          head={
            <>
              <colgroup>
                <col className={dar.colSr} />
                <col className={dar.colMid} />
                <col className={dar.colSub} />
                <col className={dar.colDate} />
                <col className={dar.colOpen} />
                <col className={dar.colClose} />
                <col className={dar.colStatus} />
                <col className={dar.colAction} />
              </colgroup>
              <thead>
                <tr>
                  <th className={dar.balanceTh}>Sr. No</th>
                  <th className={dar.balanceTh}>MID</th>
                  <th className={dar.balanceTh}>SubAdmin Details</th>
                  <th className={dar.balanceTh}>Date</th>
                  <th className={dar.balanceTh}>Open</th>
                  <th className={dar.balanceTh}>Close</th>
                  <th className={dar.balanceTh}>Status</th>
                  <th className={dar.balanceTh}>Action</th>
                </tr>
              </thead>
            </>
          }
          renderRow={(item, index) => {
            const status = dayBalanceStatus(item);
            return (
              <>
                <td className={dar.srNo}>{index + 1}</td>
                <td className={dar.balanceTd}>
                  <span className={dar.name}>{item.mid || item.midId}</span>
                </td>
                <td className={dar.balanceTd}>
                  <div className={dar.subadmin}>
                    <span className={dar.subadminName}>{item.subAdminName || '-'}</span>
                    <span className={dar.subadminId}>{item.subAdminId || '-'}</span>
                  </div>
                </td>
                <td className={dar.balanceTd}>{item.date || date || '-'}</td>
                <td className={dar.balanceTd}>
                  {item.open ? (
                    <div className={dar.balanceCell}>
                      <span className={dar.balanceAmount}>{formatBalanceAmount(item.open.amount)}</span>
                      <Tooltip title="Open detail">
                        <IconButton
                          className={dar.infoBtn}
                          size="small"
                          onClick={() => void openDetail(item.open?._id)}
                        >
                          <InfoOutlinedIcon fontSize="inherit" />
                        </IconButton>
                      </Tooltip>
                    </div>
                  ) : (
                    <span className={dar.muted}>—</span>
                  )}
                </td>
                <td className={dar.balanceTd}>
                  {item.close ? (
                    <div className={dar.balanceCell}>
                      <span className={dar.balanceAmount}>{formatBalanceAmount(item.close.amount)}</span>
                      <Tooltip title="Close detail">
                        <IconButton
                          className={dar.infoBtn}
                          size="small"
                          onClick={() => void openDetail(item.close?._id)}
                        >
                          <InfoOutlinedIcon fontSize="inherit" />
                        </IconButton>
                      </Tooltip>
                    </div>
                  ) : item.open ? (
                    <span className={dar.muted}>Pending</span>
                  ) : (
                    <span className={dar.muted}>—</span>
                  )}
                </td>
                <td className={dar.balanceTd}>
                  {status === 'done' ? (
                    <SoftPill>Done</SoftPill>
                  ) : status === 'open' ? (
                    <SoftPill>Open only</SoftPill>
                  ) : (
                    <SoftPill>Not started</SoftPill>
                  )}
                </td>
                <td className={dar.balanceTd}>
                  <div className={dar.actions}>
                    {!item.open ? (
                      <Button className={dar.link} size="small" onClick={() => openEntry(item, 'open')}>
                        Open
                      </Button>
                    ) : null}
                    {item.open && !item.close ? (
                      <Button className={dar.link} size="small" onClick={() => openEntry(item, 'close')}>
                        Close
                      </Button>
                    ) : null}
                    {item.open && item.close ? <span className={dar.muted}>Complete</span> : null}
                  </div>
                </td>
              </>
            );
          }}
        />
      ) : (
        <EmptyState
          title={(midFilter || subAdminFilter) && items.length ? 'No MID match' : 'No phones for today'}
          subtitle={
            (midFilter || subAdminFilter) && items.length
              ? 'Try another filter.'
              : viewAllAllotments
                ? 'Allot a MID to a sub-admin first, then refresh.'
                : 'Ask supervisor to allot a MID to you, then open the day balance.'
          }
        />
      )}

      <Dialog
        open={entryOpen}
        onClose={() => !saving && setEntryOpen(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ className: dar.dialog }} slotProps={{ backdrop: { className: dar.dialogBackdrop } }}
      >
        <form onSubmit={submitEntry}>
          <DialogTitle className={dar.dialogTitle}>
            <strong className={dar.dialogTitleStrong}>
              {entry.mode === 'correct'
                ? 'Correct balance'
                : entry.mode === 'open'
                  ? 'Open balance'
                  : 'Close balance'}
            </strong>
            <span className={dar.dialogTitleSpan}>
              {entry.midLabel}
              {entry.date ? ` · ${entry.date}` : ''}
              {entry.mode === 'correct'
                ? ' · Remark is required'
                : ' · Image optional (jpeg/png/webp ≤10MB)'}
            </span>
          </DialogTitle>
          <DialogContent className={dar.form}>
            <TextField
              className={dar.span2}
              size="small"
              label="Amount"
              type="number"
              required
              value={entry.amount}
              onChange={(event) => setEntry((current) => ({ ...current, amount: event.target.value }))}
              inputProps={{ min: 0, step: '0.01' }}
            />
            <TextField
              className={dar.span2}
              size="small"
              label="Remark"
              required={entry.mode === 'correct'}
              value={entry.remark}
              onChange={(event) => setEntry((current) => ({ ...current, remark: event.target.value }))}
              placeholder={entry.mode === 'correct' ? 'Why are you correcting?' : 'Optional'}
            />
            <div className={cn(dar.span2, dar.fileField)}>
              <label>Screenshot (optional)</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => onPickImage(event.target.files?.[0] || null)}
              />
              {imageFile ? (
                <span className={dar.fileName}>{imageFile.name}</span>
              ) : entry.existingImageUrl ? (
                <a href={entry.existingImageUrl} target="_blank" rel="noreferrer" className={dar.imgLink}>
                  View current image
                </a>
              ) : null}
            </div>
          </DialogContent>
          <DialogActions className={dar.dialogActions}>
            <Button className={dar.btnGhost} onClick={() => setEntryOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button className={dar.btn} type="submit" variant="contained" disabled={saving}>
              {saving ? 'Saving...' : entry.mode === 'correct' ? 'Update' : 'Save'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog
        open={detailOpen}
        onClose={() => {
          detailGenRef.current += 1;
          setDetailOpen(false);
        }}
        fullWidth
        maxWidth="sm"
        PaperProps={{ className: dar.dialog }} slotProps={{ backdrop: { className: dar.dialogBackdrop } }}
      >
        <DialogTitle className={dar.dialogTitle}>
          <strong className={dar.dialogTitleStrong}>Balance detail</strong>
          <span className={dar.dialogTitleSpan}>Open or close entry for this MID</span>
        </DialogTitle>
        <DialogContent className={dar.detailContent}>
          {detailLoading ? (
            <TableLoader />
          ) : detailRow ? (
            <div className={dar.detailCard}>
              <div className={dar.detailHero}>
                <div className={dar.detailHeroTop}>
                  <div>
                    <span className={dar.detailEyebrow}>MID</span>
                    <h3 className={dar.detailHeroTitle}>{detailRow.mid || detailRow.midId || '-'}</h3>
                  </div>
                  <SoftPill>{detailRow.type || '-'}</SoftPill>
                </div>
                <div className={dar.detailAmount}>
                  <span className={dar.detailAmountLabel}>Amount</span>
                  <strong className={dar.detailAmountValue}>{formatBalanceAmount(detailRow.amount)}</strong>
                </div>
              </div>

              <div className={dar.detailBody}>
                <div className={dar.detailField}>
                  <span className={dar.detailFieldLabel}>Date</span>
                  <strong className={dar.detailFieldValue}>{detailRow.date || '-'}</strong>
                </div>
                <div className={dar.detailField}>
                  <span className={dar.detailFieldLabel}>Updated by</span>
                  <strong className={dar.detailFieldValue}>{detailRow.updatedByName || '-'}</strong>
                </div>
                <div className={cn(dar.detailField, dar.detailFieldFull)}>
                  <span className={dar.detailFieldLabel}>SubAdmin Details</span>
                  <strong className={dar.detailFieldValue}>{detailRow.subAdminName || '-'}</strong>
                  <em className={cn(dar.mono, dar.detailFieldId)}>{detailRow.subAdminId || '-'}</em>
                </div>
                <div className={cn(dar.detailField, dar.detailFieldFull)}>
                  <span className={dar.detailFieldLabel}>Remark</span>
                  <strong className={dar.detailFieldValue}>{detailRow.remark || '-'}</strong>
                </div>
                <div className={cn(dar.detailField, dar.detailFieldFull)}>
                  <span className={dar.detailFieldLabel}>Image</span>
                  {detailRow.image?.url ? (
                    <a href={detailRow.image.url} target="_blank" rel="noreferrer" className={dar.detailImage}>
                      <img src={detailRow.image.url} alt="Balance proof" className={dar.detailImageImg} />
                    </a>
                  ) : (
                    <strong className={cn(dar.muted, dar.detailFieldValue)}>No image</strong>
                  )}
                </div>
              </div>

              <div className={dar.detailFooter}>
                <span className={dar.detailFieldLabel}>Id</span>
                <strong className={dar.mono}>{detailRow._id}</strong>
              </div>
            </div>
          ) : (
            <EmptyState title="No detail" subtitle="Balance row not found." />
          )}
        </DialogContent>
        <DialogActions className={dar.dialogActions}>
          {detailRow?._id ? (
            <Button
              className={dar.btnGhost}
              onClick={() => {
                const sheetItem = items.find(
                  (item) => item.open?._id === detailRow._id || item.close?._id === detailRow._id,
                );
                if (!sheetItem) {
                  setDetailOpen(false);
                  return;
                }
                setDetailOpen(false);
                openEntry(sheetItem, 'correct', detailRow);
              }}
            >
              Correct
            </Button>
          ) : null}
          <Button className={dar.btn} variant="contained" onClick={() => setDetailOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </PanelShell>
  );
}
