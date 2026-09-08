/** Row/form shapes and pure helpers for the Banners screen. */

export type Row = {
  _id?: string;
  imagePath?: string;
  gameName?: string;
  gameId?: string;
  providerName?: string;
  provider?: string;
  category?: string;
  type?: string;
  status?: boolean;
  position?: number;
  [key: string]: unknown;
};

export type AddForm = {
  imageDataUrl: string;
  fileName: string;
  desktopLink: string;
  gameName: string;
  mobilePage: string;
  mobileOptions: string;
  type: string;
  category: string;
  bonusTitle: string;
  bonusSubtitle: string;
};

export const EMPTY_ADD: AddForm = {
  imageDataUrl: '',
  fileName: '',
  desktopLink: '',
  gameName: '',
  mobilePage: '',
  mobileOptions: '',
  type: '',
  category: '',
  bonusTitle: '',
  bonusSubtitle: '',
};

export const POSITION_OPTIONS = Array.from({ length: 25 }, (_, i) => i + 1);

export function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

export function isGameBanner(row: Row): boolean {
  if (row.type === 'game') return true;
  if (String(row.category || '') === 'gameLaunch') return true;
  return Boolean(String(row.gameId || '').trim());
}

export function bannerGameId(row: Row): string {
  return String(row.gameId || '').trim();
}

export function bannerProvider(row: Row): string {
  return String(row.providerName || row.provider || '').trim();
}

export function asList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['payload', 'items', 'data']) {
      const v = obj[key];
      if (Array.isArray(v)) return v as T[];
      if (v && typeof v === 'object' && Array.isArray((v as Record<string, unknown>).items)) {
        return (v as Record<string, unknown>).items as T[];
      }
    }
  }
  return [];
}
