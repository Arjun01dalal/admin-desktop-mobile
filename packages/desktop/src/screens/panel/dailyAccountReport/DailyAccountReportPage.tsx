import { useMemo, useState } from 'react';

import {
  Permissions,
  canAccessDailyAccountReport,
  canManageDarAllotments,
  canManageDarBankAccounts,
  canManageDarMids,
  getSessionUser,
  hasPermission,
} from '@/auth/permissions';

import MidDailyBalancePanel from './MidDailyBalancePanel';
import MidAllotmentPanel from './MidAllotmentPanel';
import BankAccountPanel from './BankAccountPanel';
import { EmptyState } from './darUi';
import { dar } from './darStyles';
import MidPanel from './MidPanel';
import './dailyAccountReport.css';

export function DailyAccountReportPage() {
  const user = getSessionUser();
  const [bankVersion, setBankVersion] = useState(0);
  const [midVersion, setMidVersion] = useState(0);
  const [allotmentVersion, setAllotmentVersion] = useState(0);
  const [bankCount, setBankCount] = useState(0);
  const [midCount, setMidCount] = useState(0);
  const [allotmentCount, setAllotmentCount] = useState(0);

  const canBank = canManageDarBankAccounts(user);
  const canMid = canManageDarMids(user);
  const canAllot = canManageDarAllotments(user);
  const canDailyBalance =
    hasPermission(Permissions.daily_account_report, user) || canBank || canMid || canAllot;
  const hasAnySection = canAccessDailyAccountReport(user);

  const balanceStep = (canBank ? 1 : 0) + (canMid ? 1 : 0) + (canAllot ? 1 : 0) + 1;

  const updatedBy = useMemo(
    () => ({
      userId: String(user?._id || ''),
      userName: String(user?.name || ''),
    }),
    [user?._id, user?.name],
  );

  if (!hasAnySection) {
    return (
      <div className={dar.page}>
        <EmptyState
          title="No section access"
          subtitle="Ask admin to assign daily_account_report or section roles."
        />
      </div>
    );
  }

  return (
    <div className={dar.page}>
      <div className={dar.hero}>
        <div>
          <h1 className={dar.heroTitle}>Daily Account Report</h1>
          <p className={dar.heroSub}>Bank → MID → allotment → daily open/close</p>
        </div>
        <div className={dar.heroMeta}>
          {canBank ? (
            <div className={dar.heroChip}>
              <span>Bank accounts</span>
              <strong className={dar.heroChipValue}>{bankCount}</strong>
            </div>
          ) : null}
          {canMid ? (
            <div className={dar.heroChip}>
              <span>Active MIDs</span>
              <strong className={dar.heroChipValue}>{midCount}</strong>
            </div>
          ) : null}
          {canAllot ? (
            <div className={dar.heroChip}>
              <span>Allotments</span>
              <strong className={dar.heroChipValue}>{allotmentCount}</strong>
            </div>
          ) : null}
        </div>
      </div>

      {canBank || canMid || canAllot ? (
        <div className={dar.quickRow}>
          {canBank ? (
            <BankAccountPanel
              updatedBy={updatedBy}
              onSaved={() => setBankVersion((value) => value + 1)}
              onCountChange={setBankCount}
            />
          ) : null}
          {canMid ? (
            <MidPanel
              updatedBy={updatedBy}
              bankVersion={bankVersion}
              onCountChange={setMidCount}
              onSaved={() => setMidVersion((value) => value + 1)}
            />
          ) : null}
          {canAllot ? (
            <MidAllotmentPanel
              updatedBy={updatedBy}
              midVersion={midVersion}
              onCountChange={setAllotmentCount}
              onRosterChanged={() => setAllotmentVersion((value) => value + 1)}
            />
          ) : null}
        </div>
      ) : null}

      {canDailyBalance ? (
        <MidDailyBalancePanel
          updatedBy={updatedBy}
          step={balanceStep}
          allotmentVersion={allotmentVersion}
          viewAllAllotments={canAllot}
        />
      ) : null}
    </div>
  );
}

export default DailyAccountReportPage;
