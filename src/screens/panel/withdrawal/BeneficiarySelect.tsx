import { memo } from 'react';
import { FormControl, MenuItem, Select } from '@mui/material';

type Props = {
  beneficiaryAccounts: string[];
  selectId: string;
};

/** Compact dropdown listing beneficiary account names (old BeneficiarySelect). */
export const BeneficiarySelect = memo(function BeneficiarySelect({
  beneficiaryAccounts,
  selectId,
}: Props) {
  const hasBeneficiaries = beneficiaryAccounts.length > 0;

  return (
    <FormControl fullWidth size="small" disabled={!hasBeneficiaries} sx={{ minWidth: 140 }}>
      <Select
        id={selectId}
        displayEmpty
        value={hasBeneficiaries ? beneficiaryAccounts[0] : ''}
        renderValue={(selected) => {
          if (!hasBeneficiaries) return 'No Bene';
          if (beneficiaryAccounts.length === 1) return String(selected);
          return `${beneficiaryAccounts.length} Bene(s)`;
        }}
        sx={{
          fontSize: 11,
          bgcolor: '#121218',
          '& .MuiSelect-select': {
            py: 0.85,
            px: 1,
            fontSize: 11,
            lineHeight: 1.3,
            whiteSpace: 'normal',
            wordBreak: 'break-word',
          },
          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#2a2a32' },
        }}
        MenuProps={{
          PaperProps: {
            sx: { maxHeight: 220, bgcolor: '#1a1a1f' },
          },
        }}
      >
        {beneficiaryAccounts.map((bene, idx) => (
          <MenuItem
            key={`${bene}-${idx}`}
            value={bene}
            sx={{ fontSize: 11, whiteSpace: 'normal', wordBreak: 'break-word' }}
          >
            {bene}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
});
