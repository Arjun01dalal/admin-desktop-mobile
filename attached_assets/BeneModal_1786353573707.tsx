import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Chip,
  Box,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import axios from "axios";
import { toast } from "react-toastify";
import { API_Endpoint } from "../../../../Configuration/Settings";
import { encryptData } from "../../../../utils/encryptData";

interface BeneModalProps {
  open: boolean;
  onClose: () => void;
  initialBanks?: string[];
  onSuccess?: () => void;
}

const normalizeBankName = (name: string) => name?.trim()?.toLowerCase() ?? "";

const BeneModal = ({
  open,
  onClose,
  initialBanks = [],
  onSuccess,
}: BeneModalProps) => {
  const [banks, setBanks] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"create" | "update">("create");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setBanks(initialBanks);
      setInput("");
      setMode(initialBanks.length ? "update" : "create");
    }
  }, [open, initialBanks]);

  const addBank = () => {
    const value = input.trim();

    if (!value) return;

    if (banks.some((b) => b.toLowerCase() === value.toLowerCase())) {
      setInput("");
      return;
    }

    setBanks((prev) => [...prev, value]);
    setInput("");
  };

  const removeBank = (name: string) => {
    setBanks((prev) => prev.filter((b) => b !== name));
  };

  const removeFromInput = () => {
    const value = input.trim();

    if (!value) return;

    setBanks((prev) =>
      prev.filter((b) => normalizeBankName(b) !== normalizeBankName(value)),
    );
    setInput("");
  };

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  const handleSave = async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();

      if (mode === "create") {
        const response = await axios.post(
          `${API_Endpoint}/change-percentage/available-banks/create`,
          {
            token: encryptData({
              availableBanks: banks,
            }),
          },
          { headers },
        );

        if (!response?.data?.success) {
          throw new Error(response?.data?.message || "Failed to create banks");
        }
      } else {
        const added = banks.filter(
          (bank) =>
            !initialBanks.some(
              (initial) => normalizeBankName(initial) === normalizeBankName(bank),
            ),
        );

        const removed = initialBanks.filter(
          (bank) =>
            !banks.some(
              (current) => normalizeBankName(current) === normalizeBankName(bank),
            ),
        );

        if (!added.length && !removed.length) {
          toast.info("No changes to save");
          onClose();
          return;
        }

        if (added.length) {
          const addResponse = await axios.post(
            `${API_Endpoint}/change-percentage/available-banks/update`,
            {
              token: encryptData({
                action: "add",
                names: added,
              }),
            },
            { headers },
          );

          if (!addResponse?.data?.success) {
            throw new Error(addResponse?.data?.message || "Failed to add banks");
          }
        }

        if (removed.length) {
          const removeResponse = await axios.post(
            `${API_Endpoint}/change-percentage/available-banks/update`,
            {
              token: encryptData({
                action: "remove",
                names: removed,
              }),
            },
            { headers },
          );

          if (!removeResponse?.data?.success) {
            throw new Error(
              removeResponse?.data?.message || "Failed to remove banks",
            );
          }
        }
      }

      toast.success("Available banks updated successfully");
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to update available banks",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      PaperProps={{
        sx: {
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle>Available Banks</DialogTitle>

      <DialogContent>
        <Box mb={3}>
          <ToggleButtonGroup
            fullWidth
            exclusive
            value={mode}
            onChange={(_, value) => {
              if (value) setMode(value);
            }}
          >
            <ToggleButton value="create">Create</ToggleButton>
            <ToggleButton value="update">Update</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Stack direction="row" spacing={1}>
          <TextField
            fullWidth
            size="small"
            label="Bank Name"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                addBank();
              }
            }}
          />

          {mode === "update" && (
            <>
              <Button variant="contained" color="success" onClick={addBank}>
                Add
              </Button>
            </>
          )}
        </Stack>

        <Box mt={3}>
          <Typography
            variant="subtitle2"
            sx={{ mb: 1, fontWeight: 600 }}
          >
            Selected Banks ({banks.length})
          </Typography>

          <Box
            sx={{
              minHeight: 100,
              border: "1px solid #ddd",
              borderRadius: 2,
              p: 1.5,
              display: "flex",
              flexWrap: "wrap",
              gap: 1,
            }}
          >
            {banks.length > 0 ? (
              banks.map((bank, index) => (
                <Chip
                  key={index}
                  label={bank}
                  color="primary"
                  onDelete={() => removeBank(bank)}
                />
              ))
            ) : (
              <Typography
                variant="body2"
                color="text.secondary"
              >
                No bank added
              </Typography>
            )}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={onClose}
          disabled={loading}
        >
          Cancel
        </Button>

        <Button
          variant="contained"
          onClick={handleSave}
          disabled={loading || banks.length === 0}
        >
          {loading ? "Saving..." : "Save Changes"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BeneModal;