import type { ReactNode } from 'react';
import { Box, type SxProps, type Theme } from '@mui/material';
import { useFitTableHeight, type FitTableHeightOptions } from '@/hooks/useFitTableHeight';

type Props = FitTableHeightOptions & {
  /** Table markup. Pass `maxHeight="100%"` to CommonTable so it fills the frame. */
  children: ReactNode;
  /** Pagination / totals row pinned to the bottom of the frame. */
  footer?: ReactNode;
  footerJustify?: 'space-between' | 'center' | 'flex-end' | 'flex-start';
  sx?: SxProps<Theme>;
  footerSx?: SxProps<Theme>;
};

/**
 * Frame that sizes a table to the remaining screen height and keeps its
 * pagination row docked at the bottom instead of scrolling away or sitting
 * under the rows.
 *
 * Replaces per-page `maxHeight="calc(100vh - Npx)"` guesses, which drift out of
 * sync whenever the content above (heading, collapsible filters) changes height.
 */
export function TablePanel({
  children,
  footer,
  footerJustify = 'space-between',
  bottomGap,
  fallbackSubtract,
  sx,
  footerSx,
}: Props) {
  const { ref, height, fits } = useFitTableHeight({ bottomGap, fallbackSubtract });

  return (
    <Box
      ref={ref}
      sx={{
        height,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        ...sx,
      }}
    >
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </Box>

      {footer ? (
        <Box
          sx={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: footerJustify,
            flexWrap: 'wrap',
            gap: 1.5,
            px: 1.5,
            py: 1,
            bgcolor: 'background.paper',
            borderTop: '1px solid',
            borderColor: 'divider',
            // Sticky only while the frame fits the viewport, else it would
            // float on top of the rows instead of sitting below them.
            position: fits ? 'sticky' : 'static',
            bottom: 0,
            zIndex: 5,
            ...footerSx,
          }}
        >
          {footer}
        </Box>
      ) : null}
    </Box>
  );
}
