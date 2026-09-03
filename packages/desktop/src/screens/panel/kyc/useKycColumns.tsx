import { useMemo } from 'react';
import { Button, Chip, MenuItem, Stack, TextField, Typography } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import PhoneInTalkOutlinedIcon from '@mui/icons-material/PhoneInTalkOutlined';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import { type CommonTableColumn } from '@/components/CommonTable';
import { appCodeForName } from '@/constants/clientNames';
import { formatDisplayDate } from '@/utils/dates';
import { CLIENT_NAMES } from '@/screens/panel/shared/clientNames';
import { display, maskMobile } from '@/screens/panel/shared';
import { KycColumnFilter } from './FiltersContext';
import { filterFieldSx, orangeBtnSx } from './styles';
import type { KycRow } from './types';

export type UseKycColumnsParams = {
  page: number;
  pageSize: number;
  canShowMobile: boolean;
  appClientName: string;
  setAppClientName: (value: string) => void;
  setPage: (page: number) => void;
  verifyingId: string | null;
  verifyUpi: (row: KycRow) => void;
  connectToDialer: (row: KycRow) => void;
  calledId: string;
  callingId: string | null;
  openApprove: (row: KycRow) => void;
  openReject: (row: KycRow) => void;
  openManual: (row: KycRow) => void;
  rejectSubmitting: boolean;
  manualSubmitting: boolean;
  isNightLockActive: boolean;
};

export function useKycColumns({
  page,
  pageSize,
  canShowMobile,
  appClientName,
  setAppClientName,
  setPage,
  verifyingId,
  verifyUpi,
  connectToDialer,
  calledId,
  callingId,
  openApprove,
  openReject,
  openManual,
  rejectSubmitting,
  manualSubmitting,
  isNightLockActive,
}: UseKycColumnsParams): CommonTableColumn<KycRow>[] {
  return useMemo<CommonTableColumn<KycRow>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        width: 56,
        render: (_row, index) => (page - 1) * pageSize + index + 1,
      },
      {
        id: 'name',
        label: 'Name',
        filter: <KycColumnFilter field="name" placeholder="Search name" />,
        render: (row) => (
          <Typography variant="body2" fontWeight={600}>
            {display(row.name)}
          </Typography>
        ),
      },
      {
        id: 'dpId',
        label: 'Dp Id',
        filter: <KycColumnFilter field="dpId" placeholder="Search dp id" />,
        render: (row) => row._id || '—',
      },
      {
        id: 'appCode',
        label: 'App Code',
        filter: (
          <TextField
            select
            size="small"
            fullWidth
            value={appClientName}
            onChange={(e) => {
              setAppClientName(e.target.value);
              setPage(1);
            }}
            sx={filterFieldSx}
          >
            <MenuItem value="">All</MenuItem>
            {CLIENT_NAMES.map((name) => (
              <MenuItem key={name} value={name}>
                {appCodeForName(name)}
              </MenuItem>
            ))}
          </TextField>
        ),
        render: (row) => appCodeForName(row.clientName),
      },
      {
        id: 'mobile',
        label: 'Mobile',
        filter: <KycColumnFilter field="mobile" placeholder="Search mobile" />,
        render: (row) => maskMobile(row.mobile, canShowMobile),
      },
      {
        id: 'aadhaar',
        label: 'Aadhar',
        filter: <KycColumnFilter field="aadhaarNumber" placeholder="Search aadhar" />,
        render: (row) => display(row.aadhaarNumber),
      },
      {
        id: 'account',
        label: 'Account',
        filter: <KycColumnFilter field="accountNumber" placeholder="Search account" />,
        render: (row) => display(row.accountNumber),
      },
      {
        id: 'ifsc',
        label: 'IFSC',
        render: (row) => display(row.ifsc),
      },
      {
        id: 'upi',
        label: 'UPI',
        render: (row) => (
          <Stack direction="column" spacing={0.5} alignItems="center" justifyContent="center">
            <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
              {display(row.upiId)}
            </Typography>
            {row.upiId ? (
              <Button
                size="small"
                variant="outlined"
                startIcon={<VerifiedUserOutlinedIcon sx={{ fontSize: 14 }} />}
                disabled={verifyingId === row._id}
                onClick={() => void verifyUpi(row)}
                sx={{
                  textTransform: 'none',
                  fontSize: 11,
                  py: 0.25,
                  minWidth: 0,
                  borderColor: 'rgba(255,255,255,0.28)',
                  color: '#e8e8ea',
                }}
              >
                Verify
              </Button>
            ) : null}
          </Stack>
        ),
      },
      {
        id: 'status',
        label: 'Status',
        width: 110,
        render: (row) => (
          <Chip
            size="small"
            label={row.kyc ? 'Approved' : 'Pending'}
            color={row.kyc ? 'success' : 'default'}
            sx={{ fontWeight: 600, fontSize: 11 }}
          />
        ),
      },
      {
        id: 'date',
        label: 'Date',
        render: (row) => (row.createdOn ? formatDisplayDate(row.createdOn) : '—'),
      },
      {
        id: 'checkBy',
        label: 'Check By',
        render: (row) => display(row.kycRejectCheckBy?.name || row.kycManualCheckBy?.name),
      },
      {
        id: 'crossCheckBy',
        label: 'Cross Check By',
        render: (row) =>
          display(row.kycRejectCrossCheckBy?.name || row.kycManualCrossCheckBy?.name),
      },
      {
        id: 'actions',
        label: 'Actions',
        width: 280,
        render: (row) => {
          const called = calledId !== '' && calledId === row._id;
          return (
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap justifyContent="center">
              <Button
                size="small"
                variant="contained"
                startIcon={<PhoneInTalkOutlinedIcon sx={{ fontSize: 14 }} />}
                disabled={isNightLockActive || callingId === row._id}
                onClick={() => void connectToDialer(row)}
                sx={{
                  ...orangeBtnSx,
                  fontSize: 11,
                  px: 1,
                  py: 0.25,
                  minWidth: 0,
                  height: 28,
                  textTransform: 'none',
                }}
              >
                {callingId === row._id ? 'Calling…' : 'Call'}
              </Button>
              {called ? (
                <>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<CheckCircleOutlineIcon sx={{ fontSize: 14 }} />}
                    disabled={isNightLockActive}
                    onClick={() => openApprove(row)}
                    sx={{
                      ...orangeBtnSx,
                      fontSize: 11,
                      px: 1,
                      py: 0.25,
                      minWidth: 0,
                      height: 28,
                      textTransform: 'none',
                    }}
                  >
                    Approve
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    color="error"
                    startIcon={<CancelOutlinedIcon sx={{ fontSize: 14 }} />}
                    disabled={isNightLockActive || rejectSubmitting || manualSubmitting}
                    onClick={() => void openReject(row)}
                    sx={{ textTransform: 'none', fontSize: 11, px: 1, py: 0.25, minWidth: 0 }}
                  >
                    Reject
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={isNightLockActive || rejectSubmitting || manualSubmitting}
                    onClick={() => void openManual(row)}
                    sx={{
                      textTransform: 'none',
                      fontSize: 11,
                      px: 1,
                      py: 0.25,
                      minWidth: 0,
                      borderColor: 'rgba(255,255,255,0.28)',
                      color: '#e8e8ea',
                    }}
                  >
                    Manual
                  </Button>
                </>
              ) : null}
            </Stack>
          );
        },
      },
    ],
    [
      canShowMobile,
      page,
      pageSize,
      verifyingId,
      verifyUpi,
      connectToDialer,
      calledId,
      callingId,
      openApprove,
      openReject,
      openManual,
      rejectSubmitting,
      manualSubmitting,
      isNightLockActive,
      appClientName,
      setAppClientName,
      setPage,
    ],
  );
}
