import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
  Pagination,
} from '@mui/material';
import { todayIST, getStoredUser } from '@/utils/dates';
import { CommonTable } from '@/components/CommonTable';
import { CLIENT_NAMES } from '@/constants/clientNames';
import { DEFAULT_ITEMS_PER_PAGE } from '@/utils/pagination';
import { NewRegistersToolbar } from './newRegisters/NewRegistersToolbar';
import { NewRegistersFiltersProvider } from './newRegisters/FiltersContext';
import { useNewRegistersColumns } from './newRegisters/useNewRegistersColumns';
import { useNewRegistersQuery } from './newRegisters/useNewRegistersQuery';
import { useNewRegistersActions } from './newRegisters/useNewRegistersActions';
import type { UserRow } from './newRegisters/types';

const MAX_REMARK_LENGTH = 500;

export function NewRegistersPage() {
  const admin = getStoredUser<{
    name?: string;
    extensionId?: string[];
    serverId?: string | number;
    clientName?: string | string[];
    allotedApps?: string | string[];
  }>();

  const appOptions = useMemo(() => {
    const allotted = admin?.clientName || admin?.allotedApps;
    if (Array.isArray(allotted) && allotted.length) return allotted.map(String);
    if (typeof allotted === 'string' && allotted) return [allotted];
    return [...CLIENT_NAMES];
  }, [admin?.clientName, admin?.allotedApps]);

  const [startDate, setStartDate] = useState(todayIST);
  const [endDate, setEndDate] = useState(todayIST);
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [campaignName, setCampaignName] = useState('');
  const [blockTarget, setBlockTarget] = useState<UserRow | null>(null);
  const [remark, setRemark] = useState('');

  const [searchName, setSearchName] = useState('');
  const [searchDpId, setSearchDpId] = useState('');
  const [userComesFrom, setUserComesFrom] = useState('');
  const [searchBalance, setSearchBalance] = useState('');
  const [showEmptyRecord, setShowEmptyRecord] = useState(false);
  const [appClientName, setAppClientName] = useState('');
  const [searchPlayInStatus, setSearchPlayInStatus] = useState('');
  const [searchAccNo, setSearchAccNo] = useState('');
  const [searchAadharNo, setSearchAadharNo] = useState('');
  const [searchEmail, setSearchEmail] = useState('');
  const [searchCity, setSearchCity] = useState('');
  const [selectedState, setSelectedState] = useState<string[]>([]);
  const [searchReferred, setSearchReferred] = useState('');
  const [searchReferralCodeUser, setSearchReferralCodeUser] = useState('');
  const [searchMobile, setSearchMobile] = useState('');

  const columnFilters = useMemo(
    () => ({
      searchName,
      searchDpId,
      userComesFrom,
      searchBalance,
      appClientName,
      searchPlayInStatus,
      searchAccNo,
      searchAadharNo,
      searchEmail,
      searchCity,
      selectedState,
      searchReferred,
      searchReferralCodeUser,
      searchMobile,
      showEmptyRecord,
    }),
    [
      searchName,
      searchDpId,
      userComesFrom,
      searchBalance,
      appClientName,
      searchPlayInStatus,
      searchAccNo,
      searchAadharNo,
      searchEmail,
      searchCity,
      selectedState,
      searchReferred,
      searchReferralCodeUser,
      searchMobile,
      showEmptyRecord,
    ],
  );

  const { rows, total, loading, load } = useNewRegistersQuery(
    admin,
    page,
    itemsPerPage,
    startDate,
    endDate,
    columnFilters,
  );
  const deferredRows = useDeferredValue(rows);

  const { dialerLoading, toggleBlock, addToDialer } = useNewRegistersActions(
    admin,
    load,
    page,
  );

  const applyFilters = useCallback(() => {
    setPage(1);
    void load(1);
  }, [load]);

  const columns = useNewRegistersColumns({
    page,
    itemsPerPage,
    setBlockTarget,
  });

  const filtersValue = useMemo(
    () => ({
      searchName,
      setSearchName,
      searchDpId,
      setSearchDpId,
      userComesFrom,
      setUserComesFrom,
      searchBalance,
      setSearchBalance,
      showEmptyRecord,
      setShowEmptyRecord,
      appClientName,
      setAppClientName,
      searchPlayInStatus,
      setSearchPlayInStatus,
      searchAccNo,
      setSearchAccNo,
      searchAadharNo,
      setSearchAadharNo,
      searchEmail,
      setSearchEmail,
      searchCity,
      setSearchCity,
      selectedState,
      setSelectedState,
      searchReferred,
      setSearchReferred,
      searchReferralCodeUser,
      setSearchReferralCodeUser,
      searchMobile,
      setSearchMobile,
      appOptions,
      applyFilters,
    }),
    [
      searchName,
      searchDpId,
      userComesFrom,
      searchBalance,
      showEmptyRecord,
      appClientName,
      searchPlayInStatus,
      searchAccNo,
      searchAadharNo,
      searchEmail,
      searchCity,
      selectedState,
      searchReferred,
      searchReferralCodeUser,
      searchMobile,
      appOptions,
      applyFilters,
    ],
  );

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={2}>
        New Registers
      </Typography>

      <NewRegistersToolbar
        startDate={startDate}
        endDate={endDate}
        itemsPerPage={itemsPerPage}
        campaignName={campaignName}
        total={total}
        loading={loading}
        dialerLoading={dialerLoading}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onItemsPerPageChange={(value) => {
          setItemsPerPage(value);
          setPage(1);
        }}
        onCampaignNameChange={setCampaignName}
        onApply={applyFilters}
        onAddToDialer={() => {
          void addToDialer(campaignName, rows).then((ok) => {
            if (ok) setCampaignName('');
          });
        }}
      />

      <NewRegistersFiltersProvider value={filtersValue}>
        <CommonTable
          columns={columns}
          rows={deferredRows}
          getRowKey={(row, i) => String(row._id || i)}
          loading={loading}
          emptyMessage="No users"
          stickyHeader
          minWidth={3200}
          dense
          virtualize
        />
      </NewRegistersFiltersProvider>

      <Stack alignItems="center" mt={2}>
        <Pagination
          count={Math.max(1, Math.ceil(total / itemsPerPage))}
          page={page}
          onChange={(_e, p) => setPage(p)}
          color="primary"
        />
      </Stack>

      <Dialog open={Boolean(blockTarget)} onClose={() => setBlockTarget(null)}>
        <DialogTitle>
          {blockTarget && (blockTarget.blockUser || blockTarget.block)
            ? 'Unblock'
            : 'Block'}{' '}
          user
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Remark"
            value={remark}
            onChange={(e) => setRemark(e.target.value.slice(0, MAX_REMARK_LENGTH))}
            inputProps={{ maxLength: MAX_REMARK_LENGTH }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBlockTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              void toggleBlock(blockTarget, remark).then((ok) => {
                if (ok) {
                  setBlockTarget(null);
                  setRemark('');
                }
              });
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
