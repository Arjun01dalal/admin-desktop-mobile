import type { WithdrawalRow } from './types';
import { TERMINAL_STATUSES } from './types';

export function orderIdOf(row: WithdrawalRow): string {
  return row.orderId || row.transactionId || '';
}

export function midLabel(m: {
  paymentGatewayName?: string;
  name?: string;
  mid?: string | number;
}): string {
  return `${m.paymentGatewayName || m.name || '—'} - ${m.mid ?? ''}`;
}

export function extractBeneficiaryAccounts(row: WithdrawalRow): string[] {
  const accounts = row.beneficiaryAccounts;
  if (Array.isArray(accounts)) return accounts.map(String).filter(Boolean);
  if (typeof accounts === 'string' && accounts.trim()) return [accounts.trim()];
  return [];
}

export function sendToBankName(row: WithdrawalRow): string {
  // Old panel: accountHolderName.slice(0,6)-dp_id.slice(-6)
  const name = String(row.accountHolderName || row.userName || '').slice(0, 6);
  const dp = String(row.dp_id || '').slice(-6);
  if (!name && !dp) return '—';
  return `${name}${dp ? `-${dp}` : ''}`;
}

export function displayUserName(row: WithdrawalRow): string {
  return String(row.accountHolderName || row.userName || '').trim() || '—';
}

export {
  resolveWithdrawalReportUserId,
  showWithdrawalMidReport,
} from '@astro/shared/depositWithdrawalReport';

export function bothChecksOk(row: WithdrawalRow): boolean {
  return Boolean(row.checkBy?.status && row.crossCheckBy?.status);
}

export function isTerminal(row: WithdrawalRow): boolean {
  return TERMINAL_STATUSES.has(row.status || '');
}

/** Lock only after both checks OK (old Withdrawal). */
export function canLockRow(row: WithdrawalRow): boolean {
  if (isTerminal(row)) return false;
  if (row.status === 'IN PROGRESS') return false;
  return bothChecksOk(row);
}

export function canUnlockRow(row: WithdrawalRow): boolean {
  return row.status === 'IN PROGRESS' || row.status === 'Lock';
}

/** Approve / Manual / QR when IN PROGRESS or Lock + both checks. */
export function canShowApproveAction(row: WithdrawalRow): boolean {
  if (isTerminal(row)) return false;
  if (row.status === 'IN PROGRESS') return true;
  if ((row.status === 'Lock' || row.status === 'Pending') && bothChecksOk(row)) {
    return true;
  }
  return bothChecksOk(row) || ['on hold', 'Processing', 'IN PROGRESS'].includes(row.status || '');
}

export function canRejectRow(row: WithdrawalRow): boolean {
  if (row.status === 'Approved' || row.status === 'Rejected' || row.status === 'Reverse') {
    return false;
  }
  if (row.status === 'on hold') return true;
  return bothChecksOk(row) || Boolean(row.checkBy?.status) || Boolean(row.crossCheckBy?.status);
}

export function pendingAgeColor(createdOn?: string): string | undefined {
  if (!createdOn) return undefined;
  const ms = Date.now() - new Date(createdOn).getTime();
  if (!Number.isFinite(ms) || ms < 0) return undefined;
  const hours = ms / (1000 * 60 * 60);
  if (hours <= 1) return '#29b6f6';
  if (hours <= 2) return '#ffa726';
  return '#ef5350';
}

export function withdrawalRowBg(
  row: WithdrawalRow,
  mode: 'light' | 'dark' = 'dark',
): string | undefined {
  const status = row.status || '';
  const light = mode === 'light';
  // Opaque tints so sticky name columns stay solid while others scroll.
  // Light mode uses pale pastel fills so dark greens/reds don't flood the table.
  if (status === 'Approved') return light ? '#e3f6ea' : '#14352a';
  if (status === 'Rejected' || status === 'Failed' || status === 'Cancel') {
    return light ? '#fde8e8' : '#3d1b1b';
  }
  if (status === 'Reverse') return light ? '#f3e8fb' : '#2e1b3d';
  if (status === 'on hold') return light ? '#fff6e0' : '#3d3520';
  if (status === 'IN PROGRESS' || status === 'Processing') {
    return light ? '#e8f0fb' : '#1b2a3d';
  }
  if (
    row.validationCheckedAt &&
    Number(row.passedPoints ?? 0) >= 13 &&
    !TERMINAL_STATUSES.has(status)
  ) {
    return light ? '#fff3e0' : '#3d2e14';
  }
  return undefined;
}

export function maskAccount(value?: string): string {
  const s = String(value || '');
  if (s.length <= 4) return s || '—';
  return `${'*'.repeat(Math.max(0, s.length - 4))}${s.slice(-4)}`;
}

export function maskIfsc(value?: string): string {
  const s = String(value || '');
  if (s.length <= 4) return s || '—';
  return `${s.slice(0, 4)}${'*'.repeat(Math.max(0, s.length - 4))}`;
}
