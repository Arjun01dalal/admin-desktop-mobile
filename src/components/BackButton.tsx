import { useNavigate } from 'react-router-dom';
import { Button, type ButtonProps } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

type Props = {
  /** Parent route. When omitted, uses browser/history back. */
  to?: string;
  label?: string;
} & Omit<ButtonProps, 'onClick' | 'startIcon'>;

/** Shared Back control for pages reached via in-app navigation. */
export function BackButton({ to, label = 'Back', sx, ...rest }: Props) {
  const navigate = useNavigate();
  return (
    <Button
      variant="contained"
      size="small"
      startIcon={<ArrowBackIcon />}
      onClick={() => {
        if (to) navigate(to);
        else navigate(-1);
      }}
      sx={{ flexShrink: 0, fontWeight: 600, ...sx }}
      {...rest}
    >
      {label}
    </Button>
  );
}
