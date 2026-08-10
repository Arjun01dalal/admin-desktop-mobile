import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { toast } from "react-toastify";

import { removeAvailableBanks } from "./beneficiaryUtils";
import SearchBar from "../../../../Components/SearchBox/Search";
import "./AddBenePopup.css";

type AddBenePopupProps = {
  open: boolean;
  onClose: () => void;
  userId?: string;
  transactionId?: string;
  bankOptions: string[];
  beneficiaryAccounts?: string[];
  selectedBanks: string[];
  onSelect: (bankName: string) => void;
  onSubmit: () => void;
  onBeneficiaryRemoved?: () => void;
  loading?: boolean;
  error?: boolean;
  helperText?: string;
};

const normalizeName = (name: string) => name?.trim()?.toLowerCase() ?? "";

const isBeneficiaryAdded = (bank: string, beneficiaryAccounts: string[] = []) =>
  beneficiaryAccounts.some(
    (name) => normalizeName(name) === normalizeName(bank),
  );

const AddBenePopup = ({
  open,
  onClose,
  bankOptions,
  beneficiaryAccounts = [],
  selectedBanks,
  onSelect,
  onSubmit,
  onBeneficiaryRemoved,
  loading = false,
  error = false,
  helperText = "",
}: AddBenePopupProps) => {
  const [localBeneficiaryAccounts, setLocalBeneficiaryAccounts] = useState<
    string[]
  >([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingBene, setDeletingBene] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setLocalBeneficiaryAccounts([]);
      setSearchQuery("");
      return;
    }

    // Use beneficiaryAccounts from the withdrawal row — never call User/getAll
    setLocalBeneficiaryAccounts(beneficiaryAccounts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, beneficiaryAccounts.join("|")]);

  const addedBeneficiaryAccounts = useMemo(() => {
    if (localBeneficiaryAccounts.length > 0) {
      return localBeneficiaryAccounts;
    }
    return beneficiaryAccounts;
  }, [localBeneficiaryAccounts, beneficiaryAccounts]);

  const filteredBankOptions = useMemo(() => {
    const query = normalizeName(searchQuery);
    if (!query) return bankOptions;

    return bankOptions.filter((bank) => normalizeName(bank).includes(query));
  }, [bankOptions, searchQuery]);

  const handleSelect = (bank: string) => {
    if (isBeneficiaryAdded(bank, addedBeneficiaryAccounts)) return;
    onSelect(bank);
  };

  const handleDeleteBene = async (
    bank: string,
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();

    if (deletingBene || loading) return;

    setDeletingBene(bank);

    try {
      const response = await removeAvailableBanks([bank]);

      if (response?.data?.success === false) {
        throw new Error(response?.data?.message || "Failed to remove bank");
      }

      setLocalBeneficiaryAccounts((prev) => {
        const currentList = prev.length > 0 ? prev : beneficiaryAccounts;
        return currentList.filter(
          (name) => normalizeName(name) !== normalizeName(bank),
        );
      });

      if (selectedBanks.includes(bank)) {
        onSelect(bank);
      }

      onBeneficiaryRemoved?.();
      toast.success("Bank removed successfully");
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to remove bank",
      );
    } finally {
      setDeletingBene(null);
    }
  };

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      className="add-bene-popup"
      PaperProps={{ sx: { borderRadius: 2 } }}
    >
      <DialogTitle
        sx={{
          pb: 1,
          fontSize: { xs: "1rem", sm: "1.15rem" },
          textAlign: "center",
        }}
      >
        Select Bank Account Name
      </DialogTitle>

      <DialogContent dividers>
        <Typography className="add-bene-note" variant="body2">
          <span className="add-bene-note-green">Green</span> indicates that the
          user has been added to the beneficiary list in the bank account.
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 2, textAlign: "center" }}
        >
          Choose one or more banks from the list below
        </Typography>

        {selectedBanks.length > 0 && (
          <Typography
            variant="caption"
            color="primary"
            sx={{ mb: 1.5, display: "block", textAlign: "center" }}
          >
            {selectedBanks.length} bank(s) selected
          </Typography>
        )}

        <Box className="add-bene-search">
          <SearchBar
            value={searchQuery}
            onChange={(e: any) => setSearchQuery(e.target.value)}
            onSearch={() => undefined}
            placeholder="Search bank name..."
          />
        </Box>

        <Grid container spacing={1.5} className="add-bene-grid">
          {filteredBankOptions.map((bank) => {
            const alreadyAdded = isBeneficiaryAdded(
              bank,
              addedBeneficiaryAccounts,
            );
            const isSelected = selectedBanks.includes(bank);
            const isDeleting = deletingBene === bank;

            return (
              <Grid item xs={12} sm={6} key={bank}>
                <Box
                  className={`add-bene-option ${
                    alreadyAdded ? "is-added" : ""
                  } ${isSelected ? "is-selected" : ""}`}
                  onClick={() => handleSelect(bank)}
                >
                  <Checkbox
                    checked={alreadyAdded || isSelected}
                    disabled={alreadyAdded || loading || Boolean(deletingBene)}
                    size="small"
                    sx={{ p: 0.5 }}
                  />
                  <Typography
                    variant="body2"
                    className="add-bene-option-label"
                    title={bank}
                  >
                    {bank}
                  </Typography>
                  {alreadyAdded && (
                    <IconButton
                      size="small"
                      className="add-bene-delete-btn"
                      disabled={loading || Boolean(deletingBene)}
                      onClick={(event) => handleDeleteBene(bank, event)}
                    >
                      {isDeleting ? (
                        <CircularProgress size={14} color="inherit" />
                      ) : (
                        <DeleteOutlineIcon fontSize="small" />
                      )}
                    </IconButton>
                  )}
                </Box>
              </Grid>
            );
          })}
        </Grid>

        {filteredBankOptions.length === 0 && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 2, textAlign: "center" }}
          >
            No banks found
          </Typography>
        )}

        {error && helperText && (
          <Typography color="error" variant="caption" sx={{ mt: 1.5 }}>
            {helperText}
          </Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={onSubmit}
          disabled={loading || selectedBanks.length === 0}
        >
          {loading ? <CircularProgress size={20} color="inherit" /> : "Submit"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddBenePopup;
