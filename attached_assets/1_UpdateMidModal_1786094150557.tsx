import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
} from "@mui/material";
import { toast } from "react-toastify";
import { API_Endpoint } from "../../../../Configuration/Settings";
import { encryptData } from "../../../../utils/encryptData";
import "./Deposit.css";

export interface SelectedOrderUpdate {
  orderId: string;
  paymentGatewayName: string;
}

interface SelectFieldConfig {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (event: SelectChangeEvent<string>) => void;
}

interface UpdateMidModalProps {
  open: boolean;
  onClose: () => void;
  selectedOrders: SelectedOrderUpdate[];
  midOptions: { mid: string }[];
  paymentGatewayOptions: string[];
  onSuccess: () => void;
  setLoading: (loading: boolean) => void;
}

const ModalSelect = ({
  id,
  label,
  value,
  options,
  onChange,
  className,
}: SelectFieldConfig & { className?: string }) => (
  <FormControl fullWidth size="medium" className={className}>
    <InputLabel id={`${id}-label`}>{label}</InputLabel>
    <Select
      labelId={`${id}-label`}
      id={id}
      value={value}
      label={label}
      onChange={onChange}
    >
      {options.map((option) => (
        <MenuItem key={`${id}-${option.value}`} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </Select>
  </FormControl>
);

const UpdateMidModal: React.FC<UpdateMidModalProps> = ({
  open,
  onClose,
  selectedOrders,
  midOptions,
  paymentGatewayOptions,
  onSuccess,
  setLoading,
}) => {
  const [selectedMid, setSelectedMid] = useState("");
  const [selectedPaymentGatewayName, setSelectedPaymentGatewayName] =
    useState("");

  useEffect(() => {
    if (open) {
      setSelectedMid("");
      setSelectedPaymentGatewayName("");
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!selectedMid && !selectedPaymentGatewayName) {
      toast.error("Please select mid name or payment gateway name");
      return;
    }

    const updates = selectedOrders.map((order) => ({
      orderId: order.orderId,
      ...(selectedMid && { mid: selectedMid }),
      ...(selectedPaymentGatewayName && {
        paymentGatewayName: selectedPaymentGatewayName,
      }),
    }));

    const token = localStorage.getItem("token");
    setLoading(true);

    try {
      const response = await axios.post(
        `${API_Endpoint}/transaction/update-payment-by-orderId`,
        { token: encryptData({ updates }) },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      toast.success(
        response?.data?.message || "Mid name updated successfully",
      );
      onClose();
      onSuccess();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Failed to update mid name",
      );
    } finally {
      setLoading(false);
    }
  };

  const selectFields: SelectFieldConfig[] = [
    {
      id: "update-mid-select",
      label: "Select Mid Name",
      value: selectedMid,
      options: midOptions.map((gateway) => ({
        value: gateway.mid,
        label: gateway.mid,
      })),
      onChange: (event) => setSelectedMid(event.target.value),
    },
    {
      id: "update-gateway-select",
      label: "Select Payment Gateway Name",
      value: selectedPaymentGatewayName,
      options: paymentGatewayOptions.map((gatewayName) => ({
        value: gatewayName,
        label: gatewayName,
      })),
      onChange: (event) =>
        setSelectedPaymentGatewayName(event.target.value),
    },
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      className="update-mid-modal"
    >
      <DialogTitle>Update Mid Name</DialogTitle>
      <DialogContent>
        <p className="update-mid-modal__info">
          Selected deposits: <strong>{selectedOrders.length}</strong>
        </p>
        <p className="update-mid-modal__note">
          Note: Select the value which you want to change.
        </p>
        {selectFields.map((field, index) => (
          <ModalSelect
            key={field.id}
            {...field}
            className={index > 0 ? "update-mid-modal__field-spacing" : undefined}
          />
        ))}
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSubmit}>
          Update
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UpdateMidModal;
