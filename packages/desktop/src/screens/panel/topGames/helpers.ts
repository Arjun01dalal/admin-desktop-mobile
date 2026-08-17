import type { GameRow, TopGameItem, TopGamesDoc } from './types';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';
import { replaceS3WithCloudfront } from '@/utils/cdnUrl';

export function getImageUrl(item: TopGameItem): string {
  if (item?.imagePath) return replaceS3WithCloudfront(item.imagePath);

  const images = item?.images || [];
  const preferred =
    images.find((img) => img.type === 'logo-square') ||
    images.find((img) => img.type === 'banner') ||
    images.find((img) => img.type === 'logo-round') ||
    images[0];

  return replaceS3WithCloudfront(preferred?.url || '');
}

export function getGameName(item: TopGameItem): string {
  return item.Name || item.gameName || '-';
}

export function getProviderName(item: TopGameItem): string {
  const raw = item.providerName || item.provider?.name || '-';
  return raw === '-' ? raw : toDisplayText(raw);
}

export function formatDateValue(value?: string | { $date?: string }): string {
  if (!value) return '-';
  const raw = typeof value === 'string' ? value : value.$date;
  if (!raw) return '-';
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
}

/** QtechIndian -> Ketu Indian (via toDisplayText) */
export function formatCategoryLabel(key: string): string {
  if (!key) return key || 'All';
  if (key === 'All') return toDisplayText('All');
  const spaced = key
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return toDisplayText(spaced);
}

export function normalizePayload(payload: unknown): TopGamesDoc {
  if (!payload || typeof payload !== 'object') return { data: {} };

  const obj = payload as Record<string, unknown>;
  if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
    return obj as TopGamesDoc;
  }

  if (!Array.isArray(payload)) {
    const looksLikeCategoryMap = Object.values(obj).every(
      (val) => Array.isArray(val) || val == null,
    );
    return looksLikeCategoryMap
      ? { data: obj as Record<string, TopGameItem[]> }
      : { data: { All: [payload as TopGameItem] } };
  }

  if (Array.isArray(payload)) return { data: { All: payload as TopGameItem[] } };
  return { data: {} };
}

export function mapCategoryGames(
  category: string,
  items: TopGameItem[] = [],
): GameRow[] {
  return items.map((item, index) => ({
    ...item,
    _categoryKey: category,
    _position: index + 1,
  }));
}

export function buildGameRows(
  data: Record<string, TopGameItem[]>,
  selectedCategory: string,
  search: string,
): GameRow[] {
  const list =
    selectedCategory === 'All'
      ? Object.entries(data).flatMap(([category, items]) =>
          mapCategoryGames(category, items),
        )
      : mapCategoryGames(selectedCategory, data[selectedCategory] || []);

  const query = search.trim().toLowerCase();
  if (!query) return list;

  return list.filter((item) =>
    [getGameName(item), item.gameId || '', getProviderName(item)]
      .join(' ')
      .toLowerCase()
      .includes(query),
  );
}

export function unpackCatalogGames(raw: unknown): Array<{
  gameId: string;
  gameName: string;
  providerName: string;
}> {
  const payload =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? ((raw as { payload?: unknown; items?: unknown }).payload ??
        (raw as { items?: unknown }).items ??
        raw)
      : raw;
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { items?: unknown })?.items)
      ? ((payload as { items: unknown[] }).items)
      : [];

  const unique = new Map<
    string,
    { gameId: string; gameName: string; providerName: string }
  >();
  items.forEach((item) => {
    const row = (item || {}) as Record<string, unknown>;
    const provider =
      (row.provider as { name?: string } | undefined) || undefined;
    const gameId = row.gameId ?? row.Game_Code ?? row.id;
    const gameName = row.Name ?? row.gameName ?? row.name ?? gameId;
    const providerName =
      row.providerName ??
      provider?.name ??
      row.Provider_Name ??
      row.Provider_ID ??
      '';
    if (gameId == null || gameId === '') return;
    const normalized = {
      gameId: String(gameId),
      gameName: String(gameName || gameId),
      providerName: String(providerName || 'Unknown'),
    };
    unique.set(`${normalized.providerName}:${normalized.gameId}`, normalized);
  });

  return Array.from(unique.values()).sort((a, b) =>
    a.gameName.localeCompare(b.gameName),
  );
}
