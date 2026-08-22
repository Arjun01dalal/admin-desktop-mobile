/** Ludo admin RTP list parser — GET /Ludo/admin/rtp. */

export type LudoRtpRow = {
  gameId: string;
  rtp: number | string;
  gameName?: string;
};

export function parseLudoRtpList(data: unknown): LudoRtpRow[] {
  if (data == null) return [];

  if (Array.isArray(data)) {
    return data.map(normalizeLudoRtpRow).filter((row) => row.gameId);
  }

  if (typeof data !== 'object') return [];

  const obj = data as Record<string, unknown>;
  const nested = obj.payload ?? obj.data;
  if (nested && typeof nested === 'object') {
    const fromNested = parseLudoRtpList(nested);
    if (fromNested.length) return fromNested;
  }

  for (const key of ['items', 'games', 'rtp', 'rows'] as const) {
    if (Array.isArray(obj[key])) {
      return (obj[key] as unknown[])
        .map(normalizeLudoRtpRow)
        .filter((row) => row.gameId);
    }
  }

  const skip = new Set(['success', 'message', 'payload', 'data', 'status', 'error']);
  const entries = Object.entries(obj).filter(([key]) => !skip.has(key));
  if (
    entries.length &&
    entries.every(([, value]) => typeof value === 'number' || typeof value === 'string')
  ) {
    return entries.map(([gameId, rtp]) => ({ gameId, rtp }));
  }

  return [];
}

function normalizeLudoRtpRow(item: unknown): LudoRtpRow {
  if (!item || typeof item !== 'object') {
    return { gameId: '', rtp: '' };
  }
  const row = item as Record<string, unknown>;
  const gameId = String(
    row.gameId ?? row.game_id ?? row.id ?? row._id ?? row.game ?? '',
  ).trim();
  const rtp = row.rtp ?? row.RTP ?? row.value ?? row.rtpValue ?? '';
  const gameNameRaw = row.gameName ?? row.name ?? row.game_name;
  return {
    gameId,
    rtp: typeof rtp === 'number' || typeof rtp === 'string' ? rtp : String(rtp ?? ''),
    gameName: gameNameRaw != null && String(gameNameRaw).trim() ? String(gameNameRaw) : undefined,
  };
}

export function formatLudoRtp(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (Number.isFinite(n)) return String(n);
  return String(value);
}
