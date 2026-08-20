import { secureApi } from '../api/client';
import { getSessionUser } from '../auth/permissions';

export type SheetDownloadFilter = {
  mid?: string;
  type?: string;
  [key: string]: unknown;
};

/** Fire-and-forget audit so Sheet Download Report gets a row (Laxmi sendSheetData). */
export function logSheetDownload(filter: SheetDownloadFilter): void {
  const user = getSessionUser();
  void secureApi('reports.sheetDownloadAuditCreate', {
    downloadedBy: {
      name: user?.name || '',
      userId: user?._id || '',
    },
    filter: {
      mid: filter.mid || 'All',
      type: filter.type || 'Sheet',
      ...filter,
    },
  });
}
