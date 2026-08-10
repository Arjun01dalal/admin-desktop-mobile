import React, { memo } from "react";
import {
  FormControl,
  MenuItem,
  Select,
} from "@mui/material";

type Props = {
  beneficiaryAccounts: string[];
  selectId: string;
};

const BeneficiarySelect = ({ beneficiaryAccounts, selectId }: Props) => {
  const hasBeneficiaries = beneficiaryAccounts.length > 0;

  return (
    <FormControl
      fullWidth
      size="small"
      disabled={!hasBeneficiaries}
      sx={{ minWidth: 155 }}
    >
      <Select
        id={selectId}
        displayEmpty
        value={hasBeneficiaries ? beneficiaryAccounts[0] : ""}
        renderValue={(selected) => {
          if (!hasBeneficiaries) return "No Bene";
          if (beneficiaryAccounts.length === 1) return selected;
          return `${beneficiaryAccounts.length} Bene(s)`;
        }}
        sx={{
          fontSize: 11,
          backgroundColor: "transparent",
          "& .MuiOutlinedInput-notchedOutline": {
            backgroundColor: "transparent",
          },
          "& .MuiSelect-select": {
            py: 1.1,
            px: 1,
            fontSize: 11,
            lineHeight: 1.3,
            whiteSpace: "normal",
            wordBreak: "break-word",
            userSelect: "none",
            WebkitUserSelect: "none",
          },
          "&.Mui-focused .MuiSelect-select": {
            backgroundColor: "transparent",
          },
        }}
        MenuProps={{
          PaperProps: {
            sx: { maxHeight: 220 },
          },
          MenuListProps: {
            sx: {
              "& .MuiMenuItem-root.Mui-selected": {
                backgroundColor: "action.hover",
              },
              "& .MuiMenuItem-root.Mui-selected:hover": {
                backgroundColor: "action.selected",
              },
            },
          },
        }}
      >
        {beneficiaryAccounts.map((bene, idx) => (
          <MenuItem
            key={`${bene}-${idx}`}
            value={bene}
            sx={{ fontSize: 11, whiteSpace: "normal", wordBreak: "break-word" }}
          >
            {bene}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default memo(BeneficiarySelect);
