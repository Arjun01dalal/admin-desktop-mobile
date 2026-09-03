import { useState, type ReactNode } from 'react';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TuneIcon from '@mui/icons-material/Tune';
import {
  Box,
  Collapse,
  IconButton,
  Stack,
  Typography,
  type SxProps,
  type Theme,
} from '@mui/material';

type Props = {
  title: ReactNode;
  children: ReactNode;
  summary?: ReactNode;
  headerActions?: ReactNode;
  defaultOpen?: boolean;
  sx?: SxProps<Theme>;
  contentSx?: SxProps<Theme>;
};

/** Shared heading + collapsible filter/action card used across panel reports. */
export function CollapsibleFilterPanel({
  title,
  children,
  summary,
  headerActions,
  defaultOpen = false,
  sx,
  contentSx,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  const toggle = () => setOpen((value) => !value);

  return (
    <Box
      sx={{
        mb: 1.5,
        width: '100%',
        minWidth: 0,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
        boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
        ...sx,
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggle();
          }
        }}
        sx={{
          minHeight: 46,
          px: 1.5,
          py: 0.75,
          cursor: 'pointer',
          userSelect: 'none',
          borderBottom: open ? '1px solid' : 'none',
          borderColor: 'divider',
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          flexWrap="wrap"
          useFlexGap
          sx={{ minWidth: 0 }}
        >
          <TuneIcon sx={{ color: '#ff9f0a', fontSize: 20 }} />
          <Typography variant="subtitle1" fontWeight={800}>
            {title}
          </Typography>
          {!open && summary ? (
            <Box sx={{ color: 'text.secondary', fontSize: 12, minWidth: 0 }}>{summary}</Box>
          ) : null}
        </Stack>

        <Stack direction="row" alignItems="center" spacing={0.5}>
          {headerActions}
          <IconButton
            size="small"
            aria-label={open ? 'Collapse filters' : 'Expand filters'}
            onClick={(event) => {
              event.stopPropagation();
              toggle();
            }}
          >
            {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </Stack>
      </Stack>

      <Collapse in={open} timeout="auto" unmountOnExit>
        <Box sx={{ p: 1.5, ...contentSx }}>{children}</Box>
      </Collapse>
    </Box>
  );
}
