import { Box } from '@mui/material';
import { ProviderMetricCard } from './ProviderMetricCard';
import type { ProviderCardModel, ProviderFilter } from './types';

type Props = {
  cards: ProviderCardModel[];
  filterBy: ProviderFilter;
};

/** Filters provider cards by Filter By dropdown and renders the grid. */
export function ProviderCardGrid({ cards, filterBy }: Props) {
  const visible = cards.filter((c) => c.filters.includes(filterBy));

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, 1fr)',
          lg: 'repeat(3, 1fr)',
        },
        gap: 1.5,
        width: '100%',
      }}
    >
      {visible.map((card) => (
        <ProviderMetricCard key={card.id} card={card} />
      ))}
    </Box>
  );
}
