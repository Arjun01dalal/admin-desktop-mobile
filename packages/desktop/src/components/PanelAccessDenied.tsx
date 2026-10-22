import { Box, Typography } from '@mui/material';

type Props = {
  title: string;
  message?: string;
};

/** Shared deny screen for route/page-level permission checks. */
export function PanelAccessDenied({
  title,
  message = 'You do not have permission to view this page.',
}: Props) {
  return (
    <Box sx={{ p: 1.5 }}>
      <Typography variant="h6" fontWeight={800} mb={1}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
    </Box>
  );
}
