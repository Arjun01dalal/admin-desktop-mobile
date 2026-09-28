import { useCallback, useMemo, type ReactNode } from 'react';
import {
  Box,
  Button,
  Checkbox,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { type CommonTableColumn } from '@/components/CommonTable';
import { appCodeForName } from '@/constants/clientNames';
import {
  formatAmount,
  formatDisplayDate,
  formatDisplayTime,
} from '@/utils/dates';
import { display } from '@/screens/panel/shared';
import { CallingBtn } from '@/screens/panel/users/CallingBtn';
import type { UserRow } from '@/screens/panel/users/utils';
import {
  actionBtnSx,
  filterSelectSx,
} from '@/screens/panel/transactions/shared';
import {
  type WithdrawalRow,
  type ValidationItem,
  DELAY_REASONS,
} from '@/screens/panel/withdrawal/types';
import {
  orderIdOf,
  extractBeneficiaryAccounts,
  sendToBankName,
  canLockRow,
  canUnlockRow,
  canShowApproveAction,
  canRejectRow,
  isTerminal,
  pendingAgeColor,
  withdrawalRowBg,
  maskAccount,
  maskIfsc,
} from '@/screens/panel/withdrawal/logic';
import { BeneficiarySelect } from '@/screens/panel/withdrawal/BeneficiarySelect';
import { personCell, Copyable, UserNameMidReportCell } from '@/screens/panel/withdrawal/withdrawalCells';
import type { Dispatch, SetStateAction } from 'react';
import type { NavigateFunction } from 'react-router-dom';

const BOT_CHECK_HIDDEN_STATUSES = new Set(['Cancel', 'Rejected', 'Reverse', 'Failed']);

export type WithdrawalColumnFilterSlots = Partial<
  Record<
    | 'userName'
    | 'mobile'
    | 'clientName'
    | 'empCode'
    | 'amount'
    | 'state'
    | 'city'
    | 'playedGames'
    | 'status'
    | 'transactionId'
    | 'dp_id'
    | 'accountNo'
    | 'ifscCode'
    | 'mid',
    ReactNode
  >
>;

export type WithdrawalColumnCtx = {
  page: number;
  pageSize: number;
  canAct: boolean;
  canReject: boolean;
  canReverse: boolean;
  canWhatsApp: boolean;
  canDelay: boolean;
  canOpenUserReport: boolean;
  hideContact: boolean;
  busyId: string;
  empCodeNameMap: Record<string, string>;
  selectedIds: string[];
  filterOf: (key: keyof NonNullable<WithdrawalColumnFilterSlots>) => ReactNode;
  toCallingItem: (row: WithdrawalRow) => UserRow;
  openWhatsApp: (row: WithdrawalRow) => void;
  handleLock: (row: WithdrawalRow) => void | Promise<void>;
  handleUnlock: (row: WithdrawalRow) => void | Promise<void>;
  openAction: (row: WithdrawalRow, status: string) => void;
  openQrApprove: (row: WithdrawalRow) => void;
  toggleSelect: (orderId: string, checked: boolean) => void;
  renderCheckCell: (row: WithdrawalRow, kind: 'first' | 'second') => ReactNode;
  setDelayReason: (row: WithdrawalRow, reason: string) => void | Promise<void>;
  navigate: NavigateFunction;
  isLightMode: boolean;
  setMidReportRow: Dispatch<SetStateAction<WithdrawalRow | null>>;
  setMidReportOpen: Dispatch<SetStateAction<boolean>>;
  setBeneRow: Dispatch<SetStateAction<WithdrawalRow | null>>;
  setBeneOpen: Dispatch<SetStateAction<boolean>>;
  setBotItems: Dispatch<SetStateAction<ValidationItem[]>>;
  setBotOpen: Dispatch<SetStateAction<boolean>>;
};

export function useWithdrawalColumns(ctx: WithdrawalColumnCtx) {
  const columns = useMemo<CommonTableColumn<WithdrawalRow>[]>(() => {
    const showActionsCol = ctx.canAct || ctx.canReject || ctx.canReverse;

    const cols: CommonTableColumn<WithdrawalRow>[] = [
      {
        id: 'select',
        label: '#',
        width: 64,
        stickyLeft: true,
        render: (row, index) => {
          const id = orderIdOf(row);
          const status = String(row.status || '');
          const showBulkCheckbox =
            ctx.canAct &&
            Boolean(id) &&
            status !== 'Approved' &&
            status !== 'Cancel' &&
            status !== 'Rejected' &&
            status !== 'Reverse' &&
            status !== 'Failed';
          return (
            <Stack direction="row" spacing={0.25} alignItems="center" justifyContent="center">
              {showBulkCheckbox ? (
                <Checkbox
                  size="small"
                  checked={ctx.selectedIds.includes(id)}
                  onChange={(e) => ctx.toggleSelect(id, e.target.checked)}
                  sx={{ color: '#ff9f0a', p: 0.25 }}
                />
              ) : null}
              <span>{(ctx.page - 1) * ctx.pageSize + index + 1}</span>
            </Stack>
          );
        },
      },
      {
        id: 'userName',
        label: 'User Name',
        width: 148,
        stickyLeft: true,
        cellSx: { py: '6px !important', px: 0.75 },
        filter: ctx.filterOf('userName'),
        render: (row) => (
          <UserNameMidReportCell
            row={row}
            canOpenUserReport={ctx.canOpenUserReport}
            onOpenMidReport={(target) => {
              ctx.setMidReportRow(target);
              ctx.setMidReportOpen(true);
            }}
            onOpenUserReport={(target, label, userId) => {
              ctx.navigate(
                `/users/report/${encodeURIComponent(userId)}/${encodeURIComponent(
                  target.userName || target.accountHolderName || label,
                )}`,
              );
            }}
          />
        ),
      },
      {
        id: 'sendToBank',
        label: 'Name (Send to Bank)',
        width: 140,
        stickyLeft: true,
        render: (row) => sendToBankName(row),
      },
      ...(!ctx.hideContact
        ? [
            {
              id: 'mobile',
              label: 'Mobile',
              width: 180,
              filter: ctx.filterOf('mobile'),
              render: (row: WithdrawalRow) => (
                <CallingBtn
                  item={ctx.toCallingItem(row)}
                  campaignName="WITHDRAWAL ALL APP"
                  reasonList="Withdrawal"
                  hideBotCall
                />
              ),
            } satisfies CommonTableColumn<WithdrawalRow>,
          ]
        : []),
      ...(ctx.canWhatsApp
        ? [
            {
              id: 'whatsapp',
              label: 'WhatsApp',
              width: 72,
              render: (row: WithdrawalRow) =>
                String(row.status || '').toLowerCase() === 'pending' ? (
                  <Box
                    component="button"
                    type="button"
                    onClick={() => ctx.openWhatsApp(row)}
                    sx={{
                      border: 0,
                      bgcolor: 'transparent',
                      p: 0,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      lineHeight: 0,
                    }}
                    aria-label="Open WhatsApp"
                  >
                    <Box
                      component="img"
                      src="https://img.icons8.com/?size=1200&id=16713&format=jpg"
                      alt="WhatsApp"
                      sx={{ width: 36, height: 36, borderRadius: 1 }}
                    />
                  </Box>
                ) : (
                  '—'
                ),
            } satisfies CommonTableColumn<WithdrawalRow>,
          ]
        : []),
      {
        id: 'clientName',
        label: 'App Name',
        filter: ctx.filterOf('clientName'),
        render: (row) => appCodeForName(row.clientName),
      },
      {
        id: 'empCode',
        label: 'Emp Code',
        width: 110,
        filter: ctx.filterOf('empCode'),
        render: (row) => {
          const code = String(row.empCode || '').trim();
          const empName = code ? ctx.empCodeNameMap[code] : '';
          return (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                lineHeight: 1.3,
              }}
            >
              <span>{code || '—'}</span>
              {empName ? (
                <Typography
                  component="span"
                  sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 500 }}
                >
                  {empName}
                </Typography>
              ) : null}
            </Box>
          );
        },
      },
      {
        id: 'amount',
        label: 'Amount',
        width: 100,
        filter: ctx.filterOf('amount'),
        render: (row) => {
          const raw = row.amount ?? row.Amount;
          return (
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#ff9f0a' }}>
              {formatAmount(raw ?? 0)}
            </Typography>
          );
        },
      },
      {
        id: 'beneficiary',
        label: 'Beneficiary Acc',
        width: 175,
        cellSx: {
          maxWidth: 175,
          overflow: 'hidden',
          whiteSpace: 'normal',
          verticalAlign: 'middle',
        },
        render: (row) => {
          const list = extractBeneficiaryAccounts(row);
          return (
            <Stack
              spacing={0.75}
              alignItems="stretch"
              sx={{ width: '100%', maxWidth: 165, mx: 'auto' }}
            >
              <BeneficiarySelect
                beneficiaryAccounts={list}
                selectId={`bene-select-${orderIdOf(row) || row._id || ''}`}
              />
              {ctx.canAct ? (
                <Button
                  size="small"
                  variant="contained"
                  sx={{ ...actionBtnSx, fontSize: 10 }}
                  onClick={() => {
                    ctx.setBeneRow(row);
                    ctx.setBeneOpen(true);
                  }}
                >
                  Add Bene
                </Button>
              ) : null}
            </Stack>
          );
        },
      },
      {
        id: 'state',
        label: 'State',
        filter: ctx.filterOf('state'),
        render: (row) => display(row.state),
      },
      {
        id: 'city',
        label: 'City',
        filter: ctx.filterOf('city'),
        render: (row) => display(row.city),
      },
      {
        id: 'bank',
        label: 'User Bank Name',
        render: (row) => display(row.userBankName || row.bankName),
      },
      {
        id: 'winIn',
        label: 'Win In',
        filter: ctx.filterOf('playedGames'),
        render: (row) => display(row.playedGames),
      },
      {
        id: 'status',
        label: 'Status',
        filter: ctx.filterOf('status'),
        render: (row) => display(row.status),
      },
      {
        id: 'date',
        label: 'Date',
        render: (row) => (
          <Typography
            variant="body2"
            sx={{ fontSize: 12, color: pendingAgeColor(row.createdOn) || 'inherit' }}
          >
            {formatDisplayDate(row.createdOn) || '—'}
          </Typography>
        ),
      },
      {
        id: 'time',
        label: 'Time',
        render: (row) => (
          <Typography
            variant="body2"
            sx={{ fontSize: 12, color: pendingAgeColor(row.createdOn) || 'inherit' }}
          >
            {formatDisplayTime(row.createdOn) || '—'}
          </Typography>
        ),
      },
      {
        id: 'commission',
        label: 'Commission Amount',
        render: (row) => formatAmount(row.commissionAmount ?? 0),
      },
      {
        id: 'transactionId',
        label: 'Transaction Id',
        filter: ctx.filterOf('transactionId'),
        render: (row) => display(orderIdOf(row)),
      },
      {
        id: 'dpId',
        label: 'DP Id',
        filter: ctx.filterOf('dp_id'),
        render: (row) => display(row.dp_id),
      },
      {
        id: 'accountNo',
        label: 'Account No',
        filter: ctx.filterOf('accountNo'),
        render: (row) => <Copyable value={row.accountNo} masked={maskAccount(row.accountNo)} />,
      },
      {
        id: 'bankName',
        label: 'Bank Name',
        render: (row) => display(row.bankName || row.userBankName),
      },
      {
        id: 'ifscCode',
        label: 'IFSC',
        filter: ctx.filterOf('ifscCode'),
        render: (row) => <Copyable value={row.ifscCode} masked={maskIfsc(row.ifscCode)} />,
      },
      {
        id: 'botCheck',
        label: 'Check By Bot',
        width: 120,
        render: (row) => {
          if (BOT_CHECK_HIDDEN_STATUSES.has(String(row.status || ''))) return null;
          if (!row.validationCheckedAt) return '—';
          return (
            <Stack spacing={0.5} alignItems="center">
              <Typography variant="body2" sx={{ fontSize: 11 }}>
                {formatDisplayDate(row.validationCheckedAt)}{' '}
                {formatDisplayTime(row.validationCheckedAt)}
                <br />
                Pass Points:- {row.passedPoints ?? 0}/{row.totalPoints ?? '—'}
              </Typography>
              <Button
                size="small"
                variant="contained"
                sx={{ ...actionBtnSx, fontSize: 10 }}
                onClick={() => {
                  ctx.setBotItems(row.validationResults || []);
                  ctx.setBotOpen(true);
                }}
              >
                Bot Report
              </Button>
            </Stack>
          );
        },
      },
      {
        id: 'lockBy',
        label: 'Lock By',
        render: (row) => (row.lockBy?.name ? personCell(row.lockBy.name, row.lockBy.date) : '—'),
      },
      {
        id: 'checkBy',
        label: 'Check By',
        width: 140,
        render: (row) => ctx.renderCheckCell(row, 'first'),
      },
      ...(ctx.canDelay
        ? [
            {
              id: 'delaySelect',
              label: 'Select Delay Reason',
              width: 180,
              render: (row: WithdrawalRow) =>
                isTerminal(row) ? (
                  '—'
                ) : (
                  <TextField
                    select
                    size="small"
                    fullWidth
                    value=""
                    onChange={(e) => void ctx.setDelayReason(row, e.target.value)}
                    sx={filterSelectSx}
                  >
                    <MenuItem value="">Select</MenuItem>
                    {DELAY_REASONS.map((r) => (
                      <MenuItem key={r} value={r}>
                        {r}
                      </MenuItem>
                    ))}
                  </TextField>
                ),
            } satisfies CommonTableColumn<WithdrawalRow>,
            {
              id: 'delayReason',
              label: 'Delay Reason',
              width: 160,
              render: (row: WithdrawalRow) => {
                const d = row.delayReason;
                if (!d?.reason) return '—';
                return (
                  <Box
                    sx={{
                      fontSize: 10,
                      textAlign: 'left',
                      border: '1px solid rgba(255,159,10,0.4)',
                      borderRadius: 1,
                      p: 0.75,
                      bgcolor: 'rgba(255,159,10,0.08)',
                    }}
                  >
                    <div>
                      <b>Name:</b> {d.name || '—'}
                    </div>
                    <div>
                      <b>Reason:</b> {d.reason}
                    </div>
                    <div>
                      <b>Date:</b> {formatDisplayDate(d.date)} {formatDisplayTime(d.date)}
                    </div>
                  </Box>
                );
              },
            } satisfies CommonTableColumn<WithdrawalRow>,
          ]
        : []),
      {
        id: 'crossCheckBy',
        label: 'Cross Check By',
        width: 140,
        render: (row) => ctx.renderCheckCell(row, 'second'),
      },
      {
        id: 'provider',
        label: 'Withdrawal Provider',
        filter: ctx.filterOf('mid'),
        render: (row) => {
          if (String(row.status || '').toLowerCase() !== 'approved') return '—';
          const provider = display(row.withdrewalProviderName || row.paymentGatewayName, '');
          const mid = row.mid != null && row.mid !== '' ? String(row.mid) : '';
          if (!provider && !mid) return '—';
          return mid ? `${provider} - ${mid}` : provider;
        },
      },
    ];

    if (showActionsCol) {
      cols.push({
        id: 'actions',
        label: 'Actions',
        width: 240,
        render: (row) => {
          const orderId = orderIdOf(row);
          const busy = ctx.busyId === orderId;
          const buttons: {
            key: string;
            label: string;
            onClick: () => void;
            disabled?: boolean;
          }[] = [];

          if (ctx.canAct) {
            if (canUnlockRow(row)) {
              buttons.push({
                key: 'unlock',
                label: 'Unlock',
                onClick: () => void ctx.handleUnlock(row),
                disabled: busy,
              });
            } else if (canLockRow(row)) {
              buttons.push({
                key: 'lock',
                label: 'Lock',
                onClick: () => void ctx.handleLock(row),
                disabled: busy,
              });
            }
          }
          if (ctx.canAct && canShowApproveAction(row)) {
            buttons.push(
              { key: 'approve', label: 'Approve', onClick: () => ctx.openAction(row, 'Approved') },
              {
                key: 'manual',
                label: 'Manual',
                onClick: () => ctx.openAction(row, 'Manual Approved'),
              },
              { key: 'qr', label: 'QR Code', onClick: () => ctx.openQrApprove(row) },
              { key: 'hold', label: 'On Hold', onClick: () => ctx.openAction(row, 'on hold') },
            );
          }
          if (ctx.canReject && canRejectRow(row)) {
            buttons.push({
              key: 'reject',
              label: 'Reject',
              onClick: () => ctx.openAction(row, 'Rejected'),
            });
          }
          if (ctx.canReverse && row.status !== 'Cancel') {
            buttons.push({
              key: 'reverse',
              label: 'Reverse',
              onClick: () => ctx.openAction(row, 'Reverse'),
            });
          }

          return (
            <Stack
              direction="row"
              flexWrap="wrap"
              gap={0.5}
              justifyContent="center"
              sx={{ maxWidth: 230 }}
            >
              {buttons.map((b) => (
                <Button
                  key={b.key}
                  size="small"
                  variant="contained"
                  disabled={b.disabled}
                  onClick={b.onClick}
                  sx={actionBtnSx}
                >
                  {b.label}
                </Button>
              ))}
            </Stack>
          );
        },
      });
    }

    cols.push(
      {
        id: 'updatedBy',
        label: 'Updated By',
        render: (row) =>
          personCell(
            row.action ? `${row.action.status || ''} by ${row.action.name || ''}` : '—',
            row.updatedOn,
          ),
      },
      {
        id: 'pnlBefore',
        label: 'PnL Before Withdrawal',
        render: (row) => (
          <Box
            component="span"
            sx={{
              px: 0.75,
              py: 0.25,
              borderRadius: 0.5,
              bgcolor: Number(row.pnl ?? 0) >= 0 ? 'rgba(76,175,80,0.25)' : 'rgba(244,67,54,0.25)',
            }}
          >
            {formatAmount(row.pnl ?? 0)}
          </Box>
        ),
      },
      {
        id: 'pnlAfter',
        label: 'PnL After Withdrawal',
        render: (row) => formatAmount(row.afterWithdrawalPnl ?? 0),
      },
    );

    return cols;
  }, [
    ctx.page,
    ctx.pageSize,
    ctx.canAct,
    ctx.canReject,
    ctx.canReverse,
    ctx.canWhatsApp,
    ctx.canDelay,
    ctx.canOpenUserReport,
    ctx.hideContact,
    ctx.busyId,
    ctx.empCodeNameMap,
    ctx.selectedIds,
    ctx.filterOf,
    ctx.toCallingItem,
    ctx.openWhatsApp,
    ctx.handleLock,
    ctx.handleUnlock,
    ctx.openAction,
    ctx.openQrApprove,
    ctx.toggleSelect,
    ctx.renderCheckCell,
    ctx.setDelayReason,
    ctx.navigate,
    ctx.setMidReportRow,
    ctx.setMidReportOpen,
    ctx.setBeneRow,
    ctx.setBeneOpen,
    ctx.setBotItems,
    ctx.setBotOpen,
  ]);

  const getRowSx = useCallback(
    (row: WithdrawalRow) => {
      const bg = withdrawalRowBg(row, ctx.isLightMode ? 'light' : 'dark');
      if (!bg) return undefined;
      const text = ctx.isLightMode ? '#1a1a1f' : '#e8e8ea';
      const border = ctx.isLightMode
        ? 'rgba(0, 0, 0, 0.10) !important'
        : 'rgba(255, 255, 255, 0.12) !important';
      return {
        bgcolor: `${bg} !important`,
        '& td': {
          bgcolor: `${bg} !important`,
          color: `${text} !important`,
          borderColor: border,
        },
        '& td[data-sticky-left="true"]': {
          bgcolor: `${bg} !important`,
          backgroundColor: `${bg} !important`,
          zIndex: '30 !important',
        },
        '& .MuiTypography-root': { color: 'inherit !important' },
        '& .MuiIconButton-root': { color: text },
      };
    },
    [ctx.isLightMode],
  );
  return { columns, getRowSx };
}
