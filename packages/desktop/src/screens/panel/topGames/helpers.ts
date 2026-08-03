import type { GameRow, TopGameItem, TopGamesDoc } from './types';

export function getImageUrl(item: TopGameItem): string {
  if (item?.imagePath) return item.imagePath;

  const images = item?.images || [];
  const preferred =
    images.find((img) => img.type === 'logo-square') ||
    images.find((img) => img.type === 'banner') ||
    images.find((img) => img.type === 'logo-round') ||
    images[0];

  return preferred?.url || '';
}

export function getGameName(item: TopGameItem): string {
  return item.Name || item.gameName || '-';
}

export function getProviderName(item: TopGameItem): string {
  return item.providerName || item.provider?.name || '-';
}

export function formatDateValue(value?: string | { $date?: string }): string {
  if (!value) return '-';
  const raw = typeof value === 'string' ? value : value.$date;
  if (!raw) return '-';
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
}

/** QtechIndian -> Qtech Indian */
export function formatCategoryLabel(key: string): string {
  if (!key || key === 'All') return key || 'All';
  return key
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
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
