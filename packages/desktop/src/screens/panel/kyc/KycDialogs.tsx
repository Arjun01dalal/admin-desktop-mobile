import type { Dispatch, FormEvent, SetStateAction } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { orangeBtnSx } from './styles';
import type { KycRow } from './types';

type ApproveForm = {
  accountNumber: string;
  ifsc: string;
  aadhaarNumber: string;
  upiId: string;
  comment: string;
  otp: string;
  kycAdminOtp: string;
};

type ManualForm = {
  userBankName: string;
  bankName: string;
  accountNumber: string;
  aadhaarNumber: string;
  upiId: string;
  ifsc: string;
  comment: string;
  otp: string;
  kycAdminOtp: string;
};

type Props = {
  approve: {
    target: KycRow | null;
    step: 'details' | 'otp';
    form: ApproveForm;
    setForm: Dispatch<SetStateAction<ApproveForm>>;
    submitting: boolean;
    close: () => void;
    submit: (e: FormEvent) => void;
  };
  reject: {
    target: KycRow | null;
    otp: string;
    setOtp: (v: string) => void;
    adminOtp: string;
    setAdminOtp: (v: string) => void;
    submitting: boolean;
    close: () => void;
    submit: (e: FormEvent) => void;
  };
  manual: {
    target: KycRow | null;
    form: ManualForm;
    setForm: Dispatch<SetStateAction<ManualForm>>;
    submitting: boolean;
    close: () => void;
    submit: (e: FormEvent) => void;
  };
  enableOtp: {
    open: boolean;
    sent: boolean;
    value: string;
    setValue: (v: string) => void;
    loading: boolean;
    close: () => void;
    send: () => void;
    verify: () => void;
  };
};

export function KycDialogs({ approve, reject, manual, enableOtp }: Props) {
  return (
    <>
      <Dialog open={Boolean(approve.target)} onClose={approve.close} fullWidth maxWidth="xs">
        <form onSubmit={approve.submit}>
          <DialogTitle>
            Approve KYC{approve.target?.name ? ` — ${approve.target.name}` : ''}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} pt={1}>
              {approve.step === 'details' ? (
                <>
                  <TextField
                    label="Account Number"
                    size="small"
                    fullWidth
                    value={approve.form.accountNumber}
                    onChange={(e) =>
                      approve.setForm((prev) => ({
                        ...prev,
                        accountNumber: e.target.value,
                      }))
                    }
                  />
                  <TextField
                    label="IFSC"
                    size="small"
                    fullWidth
                    value={approve.form.ifsc}
                    onChange={(e) =>
                      approve.setForm((prev) => ({
                        ...prev,
                        ifsc: e.target.value.toUpperCase(),
                      }))
                    }
                  />
                  <TextField
                    label="Aadhar Number"
                    size="small"
                    fullWidth
                    value={approve.form.aadhaarNumber}
                    onChange={(e) =>
                      approve.setForm((prev) => ({
                        ...prev,
                        aadhaarNumber: e.target.value,
                      }))
                    }
                  />
                  <TextField
                    label="UPI ID"
                    size="small"
                    fullWidth
                    value={approve.form.upiId}
                    onChange={(e) =>
                      approve.setForm((prev) => ({ ...prev, upiId: e.target.value }))
                    }
                  />
                </>
              ) : (
                <>
                  <TextField
                    label="Customer OTP (6 digit)"
                    size="small"
                    fullWidth
                    required
                    autoFocus
                    inputProps={{ maxLength: 6, inputMode: 'numeric', pattern: '[0-9]*' }}
                    value={approve.form.otp}
                    onChange={(e) =>
                      approve.setForm((prev) => ({
                        ...prev,
                        otp: e.target.value.replace(/\D/g, '').slice(0, 6),
                      }))
                    }
                  />
                  <TextField
                    label="Admin OTP"
                    size="small"
                    fullWidth
                    required
                    value={approve.form.kycAdminOtp}
                    onChange={(e) =>
                      approve.setForm((prev) => ({
                        ...prev,
                        kycAdminOtp: e.target.value,
                      }))
                    }
                  />
                  <TextField
                    label="Comment (For KYC Updation)"
                    size="small"
                    fullWidth
                    required
                    value={approve.form.comment}
                    onChange={(e) =>
                      approve.setForm((prev) => ({ ...prev, comment: e.target.value }))
                    }
                  />
                </>
              )}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={approve.close} disabled={approve.submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={approve.submitting}
              sx={orangeBtnSx}
            >
              {approve.submitting ? 'Saving…' : approve.step === 'details' ? 'Send OTP' : 'Approve'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={Boolean(reject.target)} onClose={reject.close} fullWidth maxWidth="xs">
        <form onSubmit={reject.submit}>
          <DialogTitle>
            Reject KYC{reject.target?.name ? ` — ${reject.target.name}` : ''}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} pt={1}>
              <TextField
                label="Customer OTP"
                size="small"
                fullWidth
                required
                autoFocus
                value={reject.otp}
                onChange={(e) => reject.setOtp(e.target.value)}
              />
              <TextField
                label="Admin OTP"
                size="small"
                fullWidth
                required
                value={reject.adminOtp}
                onChange={(e) => reject.setAdminOtp(e.target.value)}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={reject.close} disabled={reject.submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" color="error" disabled={reject.submitting}>
              {reject.submitting ? 'Saving…' : 'Reject'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={Boolean(manual.target)} onClose={manual.close} fullWidth maxWidth="sm">
        <form onSubmit={manual.submit}>
          <DialogTitle>
            Manual KYC Update{manual.target?.name ? ` — ${manual.target.name}` : ''}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} pt={1}>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="User Bank Name"
                  size="small"
                  fullWidth
                  required
                  value={manual.form.userBankName}
                  onChange={(e) =>
                    manual.setForm((prev) => ({ ...prev, userBankName: e.target.value }))
                  }
                />
                <TextField
                  label="Bank Name"
                  size="small"
                  fullWidth
                  required
                  value={manual.form.bankName}
                  onChange={(e) =>
                    manual.setForm((prev) => ({ ...prev, bankName: e.target.value }))
                  }
                />
              </Stack>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Account No"
                  size="small"
                  fullWidth
                  required
                  value={manual.form.accountNumber}
                  onChange={(e) =>
                    manual.setForm((prev) => ({ ...prev, accountNumber: e.target.value }))
                  }
                />
                <TextField
                  label="Aadhar No"
                  size="small"
                  fullWidth
                  required
                  value={manual.form.aadhaarNumber}
                  onChange={(e) =>
                    manual.setForm((prev) => ({ ...prev, aadhaarNumber: e.target.value }))
                  }
                />
              </Stack>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="UPI ID"
                  size="small"
                  fullWidth
                  required
                  value={manual.form.upiId}
                  onChange={(e) => manual.setForm((prev) => ({ ...prev, upiId: e.target.value }))}
                />
                <TextField
                  label="IFSC"
                  size="small"
                  fullWidth
                  required
                  value={manual.form.ifsc}
                  onChange={(e) =>
                    manual.setForm((prev) => ({
                      ...prev,
                      ifsc: e.target.value.toUpperCase(),
                    }))
                  }
                />
              </Stack>
              <TextField
                label="Customer OTP"
                size="small"
                fullWidth
                required
                value={manual.form.otp}
                onChange={(e) => manual.setForm((prev) => ({ ...prev, otp: e.target.value }))}
              />
              <TextField
                label="Admin OTP"
                size="small"
                fullWidth
                required
                value={manual.form.kycAdminOtp}
                onChange={(e) =>
                  manual.setForm((prev) => ({ ...prev, kycAdminOtp: e.target.value }))
                }
              />
              <TextField
                label="Comment"
                size="small"
                fullWidth
                required
                value={manual.form.comment}
                onChange={(e) => manual.setForm((prev) => ({ ...prev, comment: e.target.value }))}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={manual.close} disabled={manual.submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={manual.submitting} sx={orangeBtnSx}>
              {manual.submitting ? 'Saving…' : 'Save'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={enableOtp.open} onClose={enableOtp.close} fullWidth maxWidth="xs">
        <DialogTitle>OTP Verification</DialogTitle>
        <DialogContent>
          <Stack spacing={2} pt={1}>
            {!enableOtp.sent ? (
              <Typography color="text.secondary">OTP will be sent to super-admin</Typography>
            ) : (
              <TextField
                label="Enter OTP"
                size="small"
                fullWidth
                autoFocus
                value={enableOtp.value}
                onChange={(e) => enableOtp.setValue(e.target.value)}
                inputProps={{ maxLength: 4 }}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={enableOtp.close} disabled={enableOtp.loading}>
            Close
          </Button>
          {!enableOtp.sent ? (
            <Button
              variant="contained"
              disabled={enableOtp.loading}
              onClick={() => void enableOtp.send()}
              sx={orangeBtnSx}
            >
              {enableOtp.loading ? 'Sending…' : 'Send OTP'}
            </Button>
          ) : (
            <Button
              variant="contained"
              disabled={enableOtp.loading}
              onClick={() => void enableOtp.verify()}
              sx={orangeBtnSx}
            >
              {enableOtp.loading ? 'Verifying…' : 'Verify OTP'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
