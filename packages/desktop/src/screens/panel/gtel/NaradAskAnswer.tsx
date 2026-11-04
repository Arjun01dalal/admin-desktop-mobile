/**
 * Renders Narad Ask answer — text + polished markdown tables.
 */
import { useMemo } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { parseNaradAskBlocks } from '@astro/shared/naradAskMarkdown';

type Props = {
  answer: string;
};

export function NaradAskAnswer({ answer }: Props) {
  const blocks = useMemo(() => parseNaradAskBlocks(answer), [answer]);

  return (
    <Box
      sx={{
        mt: 2,
        p: 1.75,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'action.hover',
        maxHeight: 420,
        overflow: 'auto',
      }}
    >
      <Typography fontSize={12} color="text.secondary" fontWeight={800} mb={0.75}>
        ANSWER
      </Typography>
      {blocks.map((block, idx) => {
        if (block.type === 'table') {
          return (
            <TableContainer
              key={`t-${idx}`}
              sx={{
                mt: 1.25,
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: 'divider',
                overflow: 'auto',
              }}
            >
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {block.headers.map((h, i) => (
                      <TableCell
                        key={`h-${i}`}
                        sx={{
                          fontWeight: 800,
                          bgcolor: 'rgba(255,159,10,0.16)',
                          whiteSpace: 'nowrap',
                          fontSize: 12,
                        }}
                      >
                        {h || '—'}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {block.rows.map((row, rIdx) => (
                    <TableRow key={`r-${rIdx}`} hover>
                      {row.map((cell, cIdx) => (
                        <TableCell
                          key={`c-${rIdx}-${cIdx}`}
                          sx={{
                            fontSize: 12.5,
                            fontWeight: cIdx === 0 ? 700 : 500,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {cell || '—'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          );
        }

        return (
          <Typography
            key={`p-${idx}`}
            sx={{
              mt: idx === 0 ? 0.5 : 1.25,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: 13,
              fontWeight: 600,
              lineHeight: 1.5,
            }}
          >
            {block.text}
          </Typography>
        );
      })}
    </Box>
  );
}
