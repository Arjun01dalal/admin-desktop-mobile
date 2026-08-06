import React, { useState } from "react";
import axios from "axios";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";

import { API_Endpoint } from "../../../../Configuration/Settings";
import { encryptData } from "../../../../utils/encryptData";

const CloneRoleModal = ({
  open,
  onClose,
  roles = [],
  userData,
}:any) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    Name: "",
    Reference_Role_ID: "",
  });

  const handleChange = (field:any, value:any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async () => {
    if (!formData.Name.trim()) return;

    try {
      setLoading(true);

      const payload:any = {
        Name: formData.Name.trim(),
      };

      if (formData.Reference_Role_ID) {
        payload.Reference_Role_ID = formData.Reference_Role_ID;
      }

       const response = await axios.post(
        `${API_Endpoint}/roles/clone`,
        { token: encryptData(payload) },
        { headers: { Authorization: `Bearer ${userData?.token}` } },
      );

      setFormData({
        Name: "",
        Reference_Role_ID: "",
      });
      window?.location?.reload();
      onClose();
      
    } catch (error) {
      console.error("Clone Role Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: 3,
          width: {
            xs: "95%",
            sm: "100%",
          },
        },
      }}
    >
      <DialogTitle>
        <Typography variant="h6" fontWeight={600}>
          Clone Role
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} mt={1}>
          <TextField
            label="Role Name"
            placeholder="Enter role name"
            fullWidth
            required
            value={formData.Name}
            onChange={(e) => handleChange("Name", e.target.value)}
          />

          <FormControl fullWidth>
            <InputLabel>Reference Role</InputLabel>
            <Select
              value={formData.Reference_Role_ID}
              label="Reference Role"
              onChange={(e) =>
                handleChange("Reference_Role_ID", e.target.value)
              }
            >
              <MenuItem value="">
                <em>Create Empty Role</em>
              </MenuItem>

              {roles.map((role:any) => (
                <MenuItem key={role._id} value={role._id}>
                  {role.Name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} variant="outlined">
          Cancel
        </Button>

        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!formData.Name || loading}
        >
          {loading ? "Creating..." : "Create Role"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CloneRoleModal;