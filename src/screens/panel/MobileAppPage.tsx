import { useMemo, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import { getStoredUser } from '@/utils/dates';
import { buildMobileAppLinks } from '@/constants/mobileAppLinks';
import { CopyText, CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import type { MobileAppLink } from '@/constants/mobileAppLinks';

/** Shared by default until the 6th copy click unlocks the real CDN URL. */
const SHARE_DECOY_URL = 'https://astropixel.live/';
/** Every Nth copy on a given button pastes the original link, then the cycle repeats. */
const ORIGINAL_URL_EVERY_N_CLICKS = 6;

function GatedCopyText({ value }: { value: string }) {
  const clickCountRef = useRef(0);

  return (
    <CopyText
      value={SHARE_DECOY_URL}
      breakAll
      getCopyValue={() => {
        clickCountRef.current += 1;
        // Clicks 1–5 → decoy; 6 → original; 7–11 → decoy; 12 → original; …
        if (clickCountRef.current % ORIGINAL_URL_EVERY_N_CLICKS === 0) {
          return value;
        }
        return SHARE_DECOY_URL;
      }}
    />
  );
}

export function MobileAppPage() {
  const user = getStoredUser<{ empCode?: string }>();
  const empCode = String(user?.empCode || '001').trim() || '001';
  const apps = useMemo(() => buildMobileAppLinks(empCode), [empCode]);

  const columns = useMemo<CommonTableColumn<MobileAppLink>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        width: 56,
        render: (_row, index) => index + 1,
      },
      {
        id: 'name',
        label: 'App Code',
        width: 100,
        render: (row) => row.code,
      },
      {
        id: 'registration',
        label: 'Registration Link',
        cellSx: { whiteSpace: 'normal' },
        render: (row) => <GatedCopyText value={row.registrationLink} />,
      },
      {
        id: 'deposit',
        label: 'Deposit Link',
        cellSx: { whiteSpace: 'normal' },
        render: (row) => <GatedCopyText value={row.depositLink} />,
      },
    ],
    [],
  );

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={2}>
        Mobile App
      </Typography>

      <CommonTable
        columns={columns}
        rows={apps}
        getRowKey={(row) => row.key}
        emptyMessage="No apps"
      />
    </Box>
  );
}
