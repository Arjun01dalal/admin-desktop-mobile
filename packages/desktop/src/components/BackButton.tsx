import { useLocation, useNavigate } from 'react-router-dom';
import { Button, type ButtonProps } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

type Props = {
  /** Fallback parent route used only when no previous history entry exists. */
  to?: string;
  label?: string;
} & Omit<ButtonProps, 'onClick' | 'startIcon'>;

/** Shared Back control for pages reached via in-app navigation. */
export function BackButton({ to, label = 'Back', sx, ...rest }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <Button
      variant="contained"
      size="small"
      startIcon={<ArrowBackIcon />}
      onClick={() => {
        // MemoryRouter's initial entry has the "default" key. For every
        // in-app navigation, go back to the exact previous page (including
        // its filters/state); use the mapped parent only for a direct entry.
        if (location.key !== 'default') navigate(-1);
        else if (to) navigate(to, { replace: true });
      }}
      sx={{ flexShrink: 0, fontWeight: 600, ...sx }}
      {...rest}
    >
      {label}
    </Button>
  );
}
