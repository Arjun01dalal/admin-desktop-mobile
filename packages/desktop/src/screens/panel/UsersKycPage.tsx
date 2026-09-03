import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Pagination, Typography } from '@mui/material';
import { canAccessNavItem, hasPermission, Permissions } from '@/auth/permissions';
import { CommonTable } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { RESP_SHOW_MOBILE } from '@/screens/panel/callerResponsibility/constants';
import { KycDialogs } from '@/screens/panel/kyc/KycDialogs';
import { KycFiltersProvider, type KycFiltersCtx } from '@/screens/panel/kyc/FiltersContext';
import { KycToolbar } from '@/screens/panel/kyc/KycToolbar';
import { useKycActions } from '@/screens/panel/kyc/useKycActions';
import { useKycColumns } from '@/screens/panel/kyc/useKycColumns';
import { useKycNightLock } from '@/screens/panel/kyc/useKycNightLock';
import { useKycQuery } from '@/screens/panel/kyc/useKycQuery';

export function UsersKycPage() {
  const navigate = useNavigate();
  const canShowMobile = hasPermission(RESP_SHOW_MOBILE);
  const canViewKyc = canAccessNavItem({
    id: 'usersKyc',
    permission: Permissions.View_KYCs,
  });

  const { isNightLockActive, unlockNightLock } = useKycNightLock();
  const query = useKycQuery();
  const actions = useKycActions({
    reload: query.reload,
    unlockNightLock,
  });

  const columns = useKycColumns({
    page: query.page,
    pageSize: query.pageSize,
    canShowMobile,
    appClientName: query.appClientName,
    setAppClientName: query.setAppClientName,
    setPage: query.setPage,
    verifyingId: actions.verifyingId,
    verifyUpi: actions.verifyUpi,
    connectToDialer: actions.connectToDialer,
    calledId: actions.calledId,
    callingId: actions.callingId,
    openApprove: actions.openApprove,
    openReject: actions.openReject,
    openManual: actions.openManual,
    rejectSubmitting: actions.rejectSubmitting,
    manualSubmitting: actions.manualSubmitting,
    isNightLockActive,
  });

  const filtersCtx = useMemo<KycFiltersCtx>(
    () => ({
      draftFilters: query.draftFilters,
      setDraftField: query.setDraftField,
      search: query.search,
    }),
    [query.draftFilters, query.setDraftField, query.search],
  );

  if (!canViewKyc) {
    return (
      <Box>
        <Typography variant="h5" fontWeight={700} mb={2}>
          KYC
        </Typography>
        <Typography variant="body2" color="text.secondary">
          You do not have permission to view this page.
        </Typography>
      </Box>
    );
  }

  return (
    <KycFiltersProvider value={filtersCtx}>
      <Box>
        {query.error ? (
          <Typography variant="body2" color="error" mb={2}>
            {query.error}
          </Typography>
        ) : null}

        <KycToolbar
          startDate={query.startDate}
          endDate={query.endDate}
          pageSize={query.pageSize}
          loading={query.loading}
          isNightLockActive={isNightLockActive}
          onStartDateChange={query.setStartDate}
          onEndDateChange={query.setEndDate}
          onPageSizeChange={(size) => {
            query.setPageSize(size);
            query.setPage(1);
          }}
          onApply={query.applyDates}
          onRefresh={() => void query.reload()}
          onKycList={() => navigate('/kycList')}
          onEnableKycFlow={actions.enableOtp.openDialog}
        />

        <TablePanel
          footer={
            <>
              <Typography variant="body2" color="text.secondary">
                Total: {query.total}
              </Typography>
              <Pagination
                count={Math.max(1, query.totalPages)}
                page={query.page}
                onChange={(_e, p) => query.setPage(p)}
                color="primary"
                disabled={query.loading}
              />
            </>
          }
        >
          <CommonTable
            columns={columns}
            rows={query.rows}
            getRowKey={(row, i) => row._id || i}
            loading={query.loading}
            emptyMessage="No KYC records found"
            stickyHeader
            dense
            minWidth={1500}
            maxHeight="100%"
          />
        </TablePanel>

        <KycDialogs
          approve={actions.approve}
          reject={actions.reject}
          manual={actions.manual}
          enableOtp={actions.enableOtp}
        />
      </Box>
    </KycFiltersProvider>
  );
}
