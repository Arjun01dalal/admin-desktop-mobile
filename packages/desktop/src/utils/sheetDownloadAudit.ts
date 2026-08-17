import { secureApi } from '@/api/secureClient';
import { getStoredUser } from '@/utils/dates';

export type SheetDownloadFilter = {
  mid?: string;
  type?: string;
  [key: string]: unknown;
};

type GeoHint = {
  lat?: number | string | null;
  long?: number | string | null;
  city?: string | null;
  state?: string | null;
};

/**
 * Fire-and-forget sheet download audit — mirrors Laxmi OtpModal `sendSheetData`.
 * Call before/while triggering any Excel export.
 */
export function logSheetDownload(
  filter: SheetDownloadFilter,
  geo?: GeoHint,
): void {
  const user = getStoredUser<{ _id?: string; name?: string }>();
  void secureApi('reports.sheetDownloadAuditCreate', {
    downloadedBy: {
      name: user?.name || '',
      userId: user?._id || '',
      ...(geo?.lat != null && geo.lat !== '' ? { lat: geo.lat } : {}),
      ...(geo?.long != null && geo.long !== '' ? { long: geo.long } : {}),
      ...(geo?.city ? { city: geo.city } : {}),
      ...(geo?.state ? { state: geo.state } : {}),
    },
    filter: {
      mid: filter.mid || 'All',
      type: filter.type || 'Sheet',
      ...filter,
    },
  });
}
