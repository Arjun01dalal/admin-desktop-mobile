import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import type { RoleOption, SubAdminEditType } from './usersHelpers';
import type { UserRow } from './utils';

type BlockProps = {
  target: UserRow | null;
  nextStatus: boolean;
  remark: string;
  setRemark: (v: string) => void;
  otp: string;
  setOtp: (v: string) => void;
  otpSending: boolean;
  actionBusyId: string;
  close: () => void;
  resendOtp: () => void;
  confirm: () => void;
  maxRemark: number;
};

type DumpProps = {
  target: UserRow | null;
  reason: string;
  setReason: (v: string) => void;
  actionBusyId: string;
  close: () => void;
  confirm: () => void;
  maxRemark: number;
};

type SubEditProps = {
  edit: { id: string; type: SubAdminEditType } | null;
  value: string;
  setValue: (v: string) => void;
  busy: boolean;
  close: () => void;
  submit: () => void;
};

type RoleProps = {
  id: string | null;
  value: string;
  setValue: (v: string) => void;
  options: RoleOption[];
  busy: boolean;
  close: () => void;
  submit: () => void;
};

type RealNameProps = {
  targetId: string | null;
  value: string;
  setValue: (v: string) => void;
  busy: boolean;
  close: () => void;
  submit: () => void;
};

type BlockCallerProps = {
  target: UserRow | null;
  next: boolean;
  remark: string;
  setRemark: (v: string) => void;
  otp: string;
  setOtp: (v: string) => void;
  busy: boolean;
  close: () => void;
  confirm: () => void;
  maxRemark: number;
};

type Props = {
  block: BlockProps;
  dump: DumpProps;
  subEdit: SubEditProps;
  role: RoleProps;
  realName: RealNameProps;
  blockCaller: BlockCallerProps;
};

export function UsersDialogs({
  block,
  dump,
  subEdit,
  role,
  realName,
  blockCaller,
}: Props) {
  return (
    <>
      <Dialog open={Boolean(block.target)} onClose={block.close}>
        <DialogTitle>
          {block.nextStatus ? 'Block' : 'Unblock'} user
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {block.otpSending
              ? 'Sending OTP to SuperAdmin…'
              : 'Enter OTP and remark to continue.'}
          </Typography>
          <TextField
            autoFocus
            fullWidth
            required
            label="Please enter OTP"
            value={block.otp}
            onChange={(e) =>
              block.setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))
            }
            inputMode="numeric"
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            required
            label="Please enter remark"
            value={block.remark}
            onChange={(e) => block.setRemark(e.target.value.slice(0, block.maxRemark))}
            inputProps={{ maxLength: block.maxRemark }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2, gap: 1, flexWrap: 'wrap' }}>
          <Button onClick={block.close}>Cancel</Button>
          <Button
            variant="outlined"
            disabled={block.otpSending}
            onClick={() => void block.resendOtp()}
          >
            Resend OTP
          </Button>
          <Button
            variant="contained"
            disabled={block.actionBusyId === block.target?._id || block.otpSending}
            onClick={() => void block.confirm()}
          >
            Submit
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(dump.target)} onClose={dump.close}>
        <DialogTitle>Confirm</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1.5 }}>
            Are you sure you want to dump this user?
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Reason"
            variant="outlined"
            value={dump.reason}
            onChange={(e) => dump.setReason(e.target.value.slice(0, dump.maxRemark))}
            inputProps={{ maxLength: dump.maxRemark }}
          />
        </DialogContent>
        <DialogActions>
          <Button color="secondary" onClick={dump.close}>
            No
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={dump.actionBusyId === dump.target?._id}
            onClick={() => void dump.confirm()}
          >
            Yes
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(subEdit.edit)}
        onClose={() => !subEdit.busy && subEdit.close()}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          Edit{' '}
          {subEdit.edit?.type === 'name'
            ? 'Name'
            : subEdit.edit?.type === 'mobile'
              ? 'Mobile'
              : subEdit.edit?.type === 'empCode'
                ? 'Emp Code'
                : 'Telegram ID'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label={
              subEdit.edit?.type === 'name'
                ? 'Name'
                : subEdit.edit?.type === 'mobile'
                  ? 'Mobile'
                  : subEdit.edit?.type === 'empCode'
                    ? 'Emp Code'
                    : 'Telegram Username'
            }
            value={subEdit.value}
            onChange={(e) => subEdit.setValue(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={subEdit.close} disabled={subEdit.busy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={subEdit.busy}
            onClick={() => void subEdit.submit()}
            sx={{ bgcolor: '#ff9f0a', color: '#1a1200', fontWeight: 700 }}
          >
            {subEdit.busy ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(role.id)}
        onClose={() => !role.busy && role.close()}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Edit Role</DialogTitle>
        <DialogContent>
          <TextField
            select
            fullWidth
            size="small"
            label="Role"
            value={role.value}
            onChange={(e) => role.setValue(e.target.value)}
            sx={{ mt: 1 }}
          >
            {role.options.map((r) => (
              <MenuItem key={r._id} value={r._id}>
                {r.Name || r.name || r._id}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={role.close} disabled={role.busy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={role.busy}
            onClick={() => void role.submit()}
            sx={{ bgcolor: '#ff9f0a', color: '#1a1200', fontWeight: 700 }}
          >
            {role.busy ? 'Saving…' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(realName.targetId)}
        onClose={() => !realName.busy && realName.close()}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Add Real Name</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Real Name"
            value={realName.value}
            onChange={(e) => realName.setValue(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={realName.close} disabled={realName.busy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={realName.busy}
            onClick={() => void realName.submit()}
            sx={{ bgcolor: '#ff9f0a', color: '#1a1200', fontWeight: 700 }}
          >
            {realName.busy ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(blockCaller.target)}
        onClose={() => !blockCaller.busy && blockCaller.close()}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          {blockCaller.next ? 'Block Caller' : 'Un Block Caller'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="OTP"
            value={blockCaller.otp}
            onChange={(e) =>
              blockCaller.setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))
            }
            sx={{ mt: 1, mb: 2 }}
          />
          <TextField
            fullWidth
            size="small"
            label="Remark"
            value={blockCaller.remark}
            onChange={(e) =>
              blockCaller.setRemark(e.target.value.slice(0, blockCaller.maxRemark))
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={blockCaller.close} disabled={blockCaller.busy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={blockCaller.busy}
            onClick={() => void blockCaller.confirm()}
            sx={{ bgcolor: '#ff9f0a', color: '#1a1200', fontWeight: 700 }}
          >
            {blockCaller.busy ? 'Saving…' : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
