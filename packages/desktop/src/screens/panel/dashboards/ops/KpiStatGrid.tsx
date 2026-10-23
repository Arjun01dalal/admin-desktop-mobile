import { Box, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

import { isNegativeMetricValue } from '@astro/shared/opsDashboard';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { useRevealCodes } from '@/context/useRevealCodes';

import { toDisplayText } from './jyotishMapping';
import type { KpiItem } from './types';

type Props = {
  items: KpiItem[];
};

const tileSx = {
  p: 2,
  bgcolor: 'background.paper',
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 2,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 1,
  width: '100%',
  textAlign: 'left' as const,
  textDecoration: 'none',
  color: 'inherit',
  boxSizing: 'border-box' as const,
};

/** KPI tile grid — main Dashboard metrics; VIP/Combined show Panchang & Gochar. */
export function KpiStatGrid({ items }: Props) {
  useRevealCodes();
  if (items.length === 0) return null;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, 1fr)',
          md: 'repeat(3, 1fr)',
          lg: 'repeat(4, 1fr)',
        },
        gap: 1.5,
        mb: 2,
        width: '100%',
      }}
    >
      {items.map((item) => {
        const clickable = Boolean(item.href);
        const body = (
          <>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant={item.headingOnly ? 'subtitle1' : 'caption'}
                color={item.headingOnly || clickable ? 'warning.main' : 'text.secondary'}
                fontWeight={800}
                sx={{
                  textTransform: item.headingOnly ? 'none' : 'uppercase',
                  letterSpacing: item.headingOnly ? 0 : 0.4,
                  textDecoration: clickable && !item.headingOnly ? 'underline' : 'none',
                  textUnderlineOffset: 2,
                }}
              >
                {toDisplayText(item.label)}
              </Typography>
              {!item.headingOnly && (
                <Typography
                  variant="h6"
                  fontWeight={800}
                  mt={0.5}
                  color={isNegativeMetricValue(item.value) ? 'error.main' : 'inherit'}
                  sx={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {item.prefix}
                  {typeof item.value === 'number' ? item.value.toLocaleString('en-IN') : item.value}
                </Typography>
              )}
            </Box>
            {item.headingOnly && (
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 1,
                  bgcolor: 'warning.main',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <ShoppingCartIcon sx={{ color: '#111', fontSize: 18 }} />
              </Box>
            )}
          </>
        );

        if (clickable && item.href) {
          return (
            <Box
              key={item.id}
              component={RouterLink}
              to={item.href}
              state={item.state}
              sx={{
                ...tileSx,
                cursor: 'pointer',
                '&:hover': { borderColor: 'warning.main' },
              }}
            >
              {body}
            </Box>
          );
        }

        return (
          <Box key={item.id} sx={tileSx}>
            {body}
          </Box>
        );
      })}
    </Box>
  );
}
