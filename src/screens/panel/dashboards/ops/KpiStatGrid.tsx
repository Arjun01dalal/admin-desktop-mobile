import { Box, Paper, Typography } from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { useNavigate } from 'react-router-dom';
import type { KpiItem } from './types';

type Props = {
  items: KpiItem[];
};

/** KPI tile grid — main Dashboard only (VIP/Combined skip). */
export function KpiStatGrid({ items }: Props) {
  const navigate = useNavigate();
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
        return (
          <Paper
            key={item.id}
            onClick={
              clickable
                ? () => navigate(item.href!, { state: item.state })
                : undefined
            }
            sx={{
              p: 2,
              bgcolor: '#1a1a1f',
              cursor: clickable ? 'pointer' : 'default',
              border: '1px solid',
              borderColor: 'rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              '&:hover': clickable ? { borderColor: 'warning.main' } : undefined,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant={item.headingOnly ? 'subtitle1' : 'caption'}
                color={item.headingOnly ? 'warning.main' : 'text.secondary'}
                fontWeight={800}
                sx={{
                  textTransform: item.headingOnly ? 'none' : 'uppercase',
                  letterSpacing: item.headingOnly ? 0 : 0.4,
                }}
              >
                {item.label}
              </Typography>
              {!item.headingOnly && (
                <Typography
                  variant="h6"
                  fontWeight={800}
                  mt={0.5}
                  sx={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {item.prefix}
                  {typeof item.value === 'number'
                    ? item.value.toLocaleString('en-IN')
                    : item.value}
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
          </Paper>
        );
      })}
    </Box>
  );
}
