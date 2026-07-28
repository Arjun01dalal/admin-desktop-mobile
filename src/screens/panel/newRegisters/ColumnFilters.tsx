import {
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { TableSearchBar } from '@/components/TableSearchBar';
import { DEPOSIT_STATES, PLAY_IN_OPTIONS } from './constants';
import { useNewRegistersFilters } from './FiltersContext';

export function NameFilter() {
  const { searchName, setSearchName, applyFilters } = useNewRegistersFilters();
  return (
    <TableSearchBar
      value={searchName}
      onChange={(e) => setSearchName(e.target.value)}
      onSearch={applyFilters}
      placeholder="Search by name"
    />
  );
}

export function DpIdFilter() {
  const { searchDpId, setSearchDpId, applyFilters } = useNewRegistersFilters();
  return (
    <TableSearchBar
      value={searchDpId}
      onChange={(e) => setSearchDpId(e.target.value)}
      onSearch={applyFilters}
      placeholder="Search by DP Id"
    />
  );
}

export function UserComesFromFilter() {
  const { userComesFrom, setUserComesFrom, applyFilters } = useNewRegistersFilters();
  return (
    <TableSearchBar
      value={userComesFrom}
      onChange={(e) => setUserComesFrom(e.target.value)}
      onSearch={applyFilters}
      placeholder="User Comes from"
    />
  );
}

export function BalanceFilter() {
  const { searchBalance, setSearchBalance, applyFilters } = useNewRegistersFilters();
  return (
    <TableSearchBar
      value={searchBalance}
      onChange={(e) => setSearchBalance(e.target.value)}
      onSearch={applyFilters}
      placeholder="Search by Balance"
    />
  );
}

export function EmptyRecordFilter() {
  const { showEmptyRecord, setShowEmptyRecord } = useNewRegistersFilters();
  return (
    <FormControlLabel
      control={
        <Checkbox
          size="small"
          checked={showEmptyRecord}
          onChange={(e) => setShowEmptyRecord(e.target.checked)}
        />
      }
      label={<Typography variant="caption">Show Empty Record</Typography>}
      sx={{ m: 0, whiteSpace: 'nowrap' }}
    />
  );
}

export function AppNameFilter() {
  const { appClientName, setAppClientName, appOptions } = useNewRegistersFilters();
  return (
    <TextField
      select
      size="small"
      value={appClientName}
      onChange={(e) => setAppClientName(e.target.value)}
      sx={{ minWidth: 90 }}
    >
      <MenuItem value="">All</MenuItem>
      {appOptions.map((name) => (
        <MenuItem key={name} value={name}>
          {name}
        </MenuItem>
      ))}
    </TextField>
  );
}

export function PlayInFilter() {
  const { searchPlayInStatus, setSearchPlayInStatus } = useNewRegistersFilters();
  return (
    <TextField
      select
      size="small"
      label="Select Win In"
      value={searchPlayInStatus}
      onChange={(e) => setSearchPlayInStatus(e.target.value)}
      sx={{ minWidth: 110 }}
      InputLabelProps={{ shrink: true }}
    >
      <MenuItem value="">All</MenuItem>
      {PLAY_IN_OPTIONS.map((opt) => (
        <MenuItem key={opt} value={opt}>
          {opt}
        </MenuItem>
      ))}
    </TextField>
  );
}

export function MobileFilter() {
  const { searchMobile, setSearchMobile, applyFilters } = useNewRegistersFilters();
  return (
    <TableSearchBar
      value={searchMobile}
      onChange={(e) => setSearchMobile(e.target.value)}
      onSearch={applyFilters}
      placeholder="Search by mobile"
    />
  );
}

export function AccNoFilter() {
  const { searchAccNo, setSearchAccNo, applyFilters } = useNewRegistersFilters();
  return (
    <TableSearchBar
      value={searchAccNo}
      onChange={(e) => setSearchAccNo(e.target.value)}
      onSearch={applyFilters}
      placeholder="Search by acc no"
    />
  );
}

export function AadharFilter() {
  const { searchAadharNo, setSearchAadharNo, applyFilters } = useNewRegistersFilters();
  return (
    <TableSearchBar
      value={searchAadharNo}
      onChange={(e) => setSearchAadharNo(e.target.value)}
      onSearch={applyFilters}
      placeholder="Search by aadhar"
    />
  );
}

export function EmailFilter() {
  const { searchEmail, setSearchEmail, applyFilters } = useNewRegistersFilters();
  return (
    <TableSearchBar
      value={searchEmail}
      onChange={(e) => setSearchEmail(e.target.value)}
      onSearch={applyFilters}
      placeholder="Search by email"
    />
  );
}

export function CityFilter() {
  const { searchCity, setSearchCity, applyFilters } = useNewRegistersFilters();
  return (
    <TableSearchBar
      value={searchCity}
      onChange={(e) => setSearchCity(e.target.value)}
      onSearch={applyFilters}
      placeholder="Search by city"
    />
  );
}

export function StateFilter() {
  const { selectedState, setSelectedState, applyFilters } = useNewRegistersFilters();
  return (
    <Stack spacing={0.5} alignItems="flex-start">
      <TextField
        select
        size="small"
        SelectProps={{ multiple: true }}
        value={selectedState}
        onChange={(e) => {
          const value = e.target.value;
          setSelectedState(typeof value === 'string' ? value.split(',') : value);
        }}
        sx={{ minWidth: 140 }}
      >
        {DEPOSIT_STATES.map((state) => (
          <MenuItem key={state} value={state}>
            {state}
          </MenuItem>
        ))}
      </TextField>
      <Button size="small" onClick={applyFilters}>
        Search
      </Button>
    </Stack>
  );
}

export function ReferredFilter() {
  const { searchReferred, setSearchReferred, applyFilters } = useNewRegistersFilters();
  return (
    <TableSearchBar
      value={searchReferred}
      onChange={(e) => setSearchReferred(e.target.value)}
      onSearch={applyFilters}
      placeholder="Search by Referred"
    />
  );
}

export function ReferralCodeFilter() {
  const { searchReferralCodeUser, setSearchReferralCodeUser, applyFilters } =
    useNewRegistersFilters();
  return (
    <TableSearchBar
      value={searchReferralCodeUser}
      onChange={(e) => setSearchReferralCodeUser(e.target.value)}
      onSearch={applyFilters}
      placeholder="Referral Code"
    />
  );
}
