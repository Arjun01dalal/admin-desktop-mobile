import { Button, MenuItem, TextField } from '@mui/material';
import {
  gameFilterOptions,
  parseGameOption,
  parseTournamentOption,
  selectedGameValue,
  selectedTournamentValue,
  tournamentFilterOptions,
  type FinalBookFilters,
  type FinalBookSortBy,
} from '@astro/shared';

type Props = {
  filters: FinalBookFilters;
  sportName: string;
  tournamentName: string;
  gameName: string;
  sortBy: '' | FinalBookSortBy;
  onSportName: (sportName: string) => void;
  onTournament: (sportName: string, tournamentName: string) => void;
  onGame: (sportName: string, tournamentName: string, gameName: string) => void;
  onSortBy: (sortBy: '' | FinalBookSortBy) => void;
};

const fieldSx = {
  width: 200,
  flex: '0 0 auto',
  '& .MuiSelect-select': {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
};

const selectMenuProps = { MenuProps: { PaperProps: { sx: { maxHeight: 360 } } } };

const sortButtonSx = { flex: '0 0 auto', whiteSpace: 'nowrap', height: 40 };

export function LiveMatchBookFilters({
  filters,
  sportName,
  tournamentName,
  gameName,
  sortBy,
  onSportName,
  onTournament,
  onGame,
  onSortBy,
}: Props) {
  const tournaments = tournamentFilterOptions(filters, sportName);
  const games = gameFilterOptions(filters, sportName, tournamentName);

  return (
    <>
      <TextField
        select
        label="Sport"
        size="small"
        value={sportName}
        onChange={(event) => onSportName(event.target.value)}
        InputLabelProps={{ shrink: true }}
        sx={fieldSx}
        SelectProps={selectMenuProps}
      >
        <MenuItem value="">All sports</MenuItem>
        {filters.sports.map((sport) => (
          <MenuItem key={sport} value={sport}>
            {sport}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        label="Tournament"
        size="small"
        value={selectedTournamentValue(sportName, tournamentName)}
        onChange={(event) => {
          const parsed = parseTournamentOption(event.target.value);
          onTournament(parsed.sportName, parsed.tournamentName);
        }}
        InputLabelProps={{ shrink: true }}
        sx={{ ...fieldSx, width: 240 }}
        SelectProps={selectMenuProps}
      >
        <MenuItem value="">All tournaments</MenuItem>
        {tournaments.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        label="Game"
        size="small"
        value={selectedGameValue(sportName, tournamentName, gameName)}
        onChange={(event) => {
          const parsed = parseGameOption(event.target.value);
          onGame(parsed.sportName, parsed.tournamentName, parsed.gameName);
        }}
        InputLabelProps={{ shrink: true }}
        sx={{ ...fieldSx, width: 280 }}
        SelectProps={selectMenuProps}
      >
        <MenuItem value="">All games</MenuItem>
        {games.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>
      <Button
        variant={sortBy === '' ? 'contained' : 'outlined'}
        color="warning"
        onClick={() => onSortBy('')}
        sx={sortButtonSx}
      >
        A–Z
      </Button>
      <Button
        variant={sortBy === 'betVolume' ? 'contained' : 'outlined'}
        color="warning"
        onClick={() => onSortBy('betVolume')}
        sx={sortButtonSx}
      >
        Bet volume
      </Button>
    </>
  );
}
