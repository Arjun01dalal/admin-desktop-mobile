/**
 * Live Match Total book query shared by desktop and mobile.
 * POST /SubAdmin/final-book-laxmi | final-book-vip | final-book
 */

export type FinalBookType = 'live' | 'all';
export type FinalBookSortBy = 'betVolume';

export type FinalBookTournament = {
  sportName: string;
  tournamentName: string;
};

export type FinalBookGame = {
  sportName: string;
  tournamentName: string;
  gameName: string;
};

export type FinalBookFilters = {
  sports: string[];
  tournaments: FinalBookTournament[];
  games: FinalBookGame[];
};

export type FinalBookSelection = {
  sportName: string;
  tournamentName: string;
  gameName: string;
  sortBy: '' | FinalBookSortBy;
};

export type FinalBookFilterOption = {
  value: string;
  label: string;
  sportName: string;
  tournamentName: string;
  gameName: string;
};

export const EMPTY_FINAL_BOOK_FILTERS: FinalBookFilters = {
  sports: [],
  tournaments: [],
  games: [],
};

const OPTION_SEP = '\u001f';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  values.forEach((value) => {
    if (!value || seen.has(value)) return;
    seen.add(value);
    out.push(value);
  });
  return out;
}

function toDayBound(value: string, bound: 'start' | 'end'): string {
  const day = String(value || '')
    .trim()
    .slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return String(value || '').trim();
  return bound === 'start' ? `${day}T00:00:00` : `${day}T23:59:59`;
}

/** Optional filters are omitted so the API keeps its defaults (live book, A–Z games). */
export function buildFinalBookPayload(input: {
  startDate: string;
  endDate: string;
  bookType: FinalBookType;
  sportName?: string;
  tournamentName?: string;
  gameName?: string;
  sortBy?: '' | FinalBookSortBy;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    startDate: toDayBound(input.startDate, 'start'),
    endDate: toDayBound(input.endDate, 'end'),
    bookType: input.bookType === 'all' ? 'all' : 'live',
  };
  const sportName = String(input.sportName || '').trim();
  const tournamentName = String(input.tournamentName || '').trim();
  const gameName = String(input.gameName || '').trim();
  if (sportName) body.sportName = sportName;
  if (tournamentName) body.tournamentName = tournamentName;
  if (gameName) body.gameName = gameName;
  if (input.sortBy === 'betVolume') body.sortBy = 'betVolume';
  return body;
}

function parseFilters(raw: unknown): FinalBookFilters | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  if (!('sports' in obj) && !('tournaments' in obj) && !('games' in obj)) return null;

  const sports = uniqueStrings(
    (Array.isArray(obj.sports) ? obj.sports : []).map((item) => String(item || '').trim()),
  );

  const tournamentSeen = new Set<string>();
  const tournaments: FinalBookTournament[] = [];
  (Array.isArray(obj.tournaments) ? obj.tournaments : []).forEach((item) => {
    const row = asRecord(item);
    if (!row) return;
    const sportName = String(row.sportName || '').trim();
    const tournamentName = String(row.tournamentName || '').trim();
    if (!sportName || !tournamentName) return;
    const key = `${sportName}${OPTION_SEP}${tournamentName}`;
    if (tournamentSeen.has(key)) return;
    tournamentSeen.add(key);
    tournaments.push({ sportName, tournamentName });
  });

  const gameSeen = new Set<string>();
  const games: FinalBookGame[] = [];
  (Array.isArray(obj.games) ? obj.games : []).forEach((item) => {
    const row = asRecord(item);
    if (!row) return;
    const sportName = String(row.sportName || '').trim();
    const tournamentName = String(row.tournamentName || '').trim();
    const gameName = String(row.gameName || '').trim();
    if (!sportName || !tournamentName || !gameName) return;
    const key = `${sportName}${OPTION_SEP}${tournamentName}${OPTION_SEP}${gameName}`;
    if (gameSeen.has(key)) return;
    gameSeen.add(key);
    games.push({ sportName, tournamentName, gameName });
  });

  return { sports, tournaments, games };
}

const ROW_KEYS = ['data', 'payload', 'result', 'books', 'list', 'rows', 'matches', 'finalBook'];

function firstRowArray(obj: Record<string, unknown>): unknown[] | null {
  for (const key of ROW_KEYS) {
    if (Array.isArray(obj[key])) return obj[key] as unknown[];
  }
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'filters' || !Array.isArray(value)) continue;
    if (value.length === 0 || (value[0] && typeof value[0] === 'object')) return value;
  }
  return null;
}

/** Book rows plus the new `filters` catalog (sports, tournaments, games). */
export function parseFinalBookResponse(raw: unknown): {
  rows: unknown[];
  filters: FinalBookFilters;
} {
  if (Array.isArray(raw)) {
    return { rows: raw, filters: EMPTY_FINAL_BOOK_FILTERS };
  }
  const root = asRecord(raw);
  if (!root) return { rows: [], filters: EMPTY_FINAL_BOOK_FILTERS };

  const nested = asRecord(root.data);
  const filters =
    parseFilters(root.filters) ||
    (nested ? parseFilters(nested.filters) : null) ||
    EMPTY_FINAL_BOOK_FILTERS;
  const rows = firstRowArray(root) || (nested ? firstRowArray(nested) : null) || [];
  return { rows, filters };
}

export function sameFinalBookFilters(a: FinalBookFilters, b: FinalBookFilters): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function tournamentsForSport(
  filters: FinalBookFilters,
  sportName: string,
): FinalBookTournament[] {
  const sport = sportName.trim();
  if (!sport) return filters.tournaments;
  return filters.tournaments.filter((row) => row.sportName === sport);
}

export function gamesForSelection(
  filters: FinalBookFilters,
  sportName: string,
  tournamentName: string,
): FinalBookGame[] {
  const sport = sportName.trim();
  const tournament = tournamentName.trim();
  return filters.games.filter((row) => {
    if (sport && row.sportName !== sport) return false;
    if (tournament && row.tournamentName !== tournament) return false;
    return true;
  });
}

/**
 * Drop a selection only when that catalog is present and no longer contains it.
 * An empty catalog (response still loading, or filters omitted) keeps the choice.
 */
export function reconcileFinalBookSelection(
  filters: FinalBookFilters,
  selection: FinalBookSelection,
): FinalBookSelection {
  let sportName = selection.sportName.trim();
  let tournamentName = selection.tournamentName.trim();
  let gameName = selection.gameName.trim();
  const sortBy = selection.sortBy === 'betVolume' ? 'betVolume' : '';

  if (sportName && filters.sports.length > 0 && !filters.sports.includes(sportName)) {
    sportName = '';
    tournamentName = '';
    gameName = '';
  }

  const tournaments = tournamentsForSport(filters, sportName);
  if (
    tournamentName &&
    tournaments.length > 0 &&
    !tournaments.some(
      (row) =>
        row.tournamentName === tournamentName && (!sportName || row.sportName === sportName),
    )
  ) {
    tournamentName = '';
    gameName = '';
  }

  const games = gamesForSelection(filters, sportName, tournamentName);
  if (
    gameName &&
    games.length > 0 &&
    !games.some(
      (row) =>
        row.gameName === gameName &&
        (!sportName || row.sportName === sportName) &&
        (!tournamentName || row.tournamentName === tournamentName),
    )
  ) {
    gameName = '';
  }

  return { sportName, tournamentName, gameName, sortBy };
}

export function tournamentFilterOptions(
  filters: FinalBookFilters,
  sportName: string,
): FinalBookFilterOption[] {
  return tournamentsForSport(filters, sportName).map((row) => ({
    value: `${row.sportName}${OPTION_SEP}${row.tournamentName}`,
    label: sportName.trim() ? row.tournamentName : `${row.tournamentName} · ${row.sportName}`,
    sportName: row.sportName,
    tournamentName: row.tournamentName,
    gameName: '',
  }));
}

export function gameFilterOptions(
  filters: FinalBookFilters,
  sportName: string,
  tournamentName: string,
): FinalBookFilterOption[] {
  const tournamentSelected = Boolean(tournamentName.trim());
  return gamesForSelection(filters, sportName, tournamentName).map((row) => ({
    value: `${row.sportName}${OPTION_SEP}${row.tournamentName}${OPTION_SEP}${row.gameName}`,
    label: tournamentSelected ? row.gameName : `${row.gameName} · ${row.tournamentName}`,
    sportName: row.sportName,
    tournamentName: row.tournamentName,
    gameName: row.gameName,
  }));
}

export function selectedTournamentValue(sportName: string, tournamentName: string): string {
  if (!tournamentName.trim()) return '';
  return `${sportName.trim()}${OPTION_SEP}${tournamentName.trim()}`;
}

export function selectedGameValue(
  sportName: string,
  tournamentName: string,
  gameName: string,
): string {
  if (!gameName.trim()) return '';
  return `${sportName.trim()}${OPTION_SEP}${tournamentName.trim()}${OPTION_SEP}${gameName.trim()}`;
}

export function parseTournamentOption(value: string): { sportName: string; tournamentName: string } {
  const [sportName = '', tournamentName = ''] = String(value || '').split(OPTION_SEP);
  return { sportName, tournamentName };
}

export function parseGameOption(value: string): {
  sportName: string;
  tournamentName: string;
  gameName: string;
} {
  const [sportName = '', tournamentName = '', gameName = ''] = String(value || '').split(
    OPTION_SEP,
  );
  return { sportName, tournamentName, gameName };
}
