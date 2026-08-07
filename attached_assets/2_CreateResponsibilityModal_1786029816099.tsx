import React, { useState } from "react";
import axios from "axios";

import { Modal, Box, Typography, TextField, Button, Grid } from "@mui/material";

import { API_Endpoint } from "../../../../Configuration/Settings";
import { encryptData } from "../../../../utils/encryptData";

const style = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: {
    xs: "95%",
    sm: 450,
    md: 500,
  },
  maxHeight: "90vh",
  overflowY: "auto",
  bgcolor: "background.paper",
  borderRadius: 2,
  boxShadow: 24,
  p: {
    xs: 2,
    sm: 3,
    md: 4,
  },
};
const CreateResponsibilityModal = ({ open, onClose, userData }: any) => {
  const [formData, setFormData] = useState({
    name: "",
    group: "",
    roleName: "",
    subAdminMobile: "",
  });

  const handleChange = (e: any) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const addResponsibility = async (formData: any) => {
    try {
      if(!formData.name) {
        alert("Name should not be empty");
        return;
      }
      const payload: any = {
        Name: formData.name,
      };

      // Optional fields
      if (formData.group?.trim()) {
        payload.Group = formData.group;
      }

      if (formData.roleName?.trim()) {
        payload.Role_Name = formData.roleName;
      }

      if (formData.subAdminMobile?.trim()) {
        payload.SubAdmin_Mobile = formData.subAdminMobile;
      }

      console.log("payload:::", payload);

      const response = await axios.post(
        `${API_Endpoint}/responsibilities/add`,
        { token: encryptData(payload) },
        { headers: { Authorization: `Bearer ${userData?.token}` } },
      );

      return response.data;
    } catch (error) {
      console.error("Add Responsibility Error:", error);
      throw error;
    }
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        name: formData.name,
        group: formData.group,
        roleName: formData.roleName,
        subAdminMobile: formData.subAdminMobile,
      };

      const res = await addResponsibility(payload);
      onClose?.();
      setFormData({
        name: "",
        group: "",
        roleName: "",
        subAdminMobile: "",
      });
      window.location.reload();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Modal open={open} onClose={onClose} aria-labelledby="responsibility-modal">
      <Box sx={style}>
        <Typography variant="h6" mb={3} textAlign="center" fontWeight={600}>
          Add Responsibility
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              size="small"
              label="Name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              sx={{
                "& .MuiInputBase-root": {
                  minHeight: 52,
                },
              }}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              size="small"
              label="Group"
              name="group"
              value={formData.group}
              onChange={handleChange}
              sx={{
                "& .MuiInputBase-root": {
                  minHeight: 52,
                },
              }}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              size="small"
              label="Role Name"
              name="roleName"
              value={formData.roleName}
              onChange={handleChange}
              sx={{
                "& .MuiInputBase-root": {
                  minHeight: 52,
                },
              }}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              size="small"
              label="Mobile Number"
              name="subAdminMobile"
              value={formData.subAdminMobile}
              onChange={handleChange}
              sx={{
                "& .MuiInputBase-root": {
                  minHeight: 52,
                },
              }}
            />
          </Grid>
        </Grid>

        <Box
          mt={3}
          display="flex"
          gap={2}
          flexDirection={{ xs: "column", sm: "row" }}
          justifyContent="flex-end"
        >
          <Button variant="outlined" onClick={onClose} fullWidth>
            Cancel
          </Button>

          <Button variant="contained" onClick={handleSubmit} fullWidth>
            Submit
          </Button>
        </Box>
      </Box>
    </Modal>
  );
};

export default CreateResponsibilityModal;
