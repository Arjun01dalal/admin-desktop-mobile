import { toast } from 'react-toastify';
import ExcelJS from 'exceljs';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function toUint8Array(raw: unknown): Uint8Array {
  if (raw instanceof Uint8Array) return raw;
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  if (Array.isArray(raw)) return Uint8Array.from(raw as number[]);
  throw new Error('Unexpected workbook buffer');
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunk = 0x2000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function fallbackAnchorDownload(bytes: Uint8Array, filename: string): boolean {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const blob = new Blob([buffer], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 40_000);
  return true;
}

export type SaveWorkbookResult = 'ok' | 'empty' | 'canceled' | 'error';

async function persistSheetFile(bytes: Uint8Array, filename: string): Promise<SaveWorkbookResult> {
  const save = window.gcalc?.saveDownload;
  if (typeof save === 'function') {
    try {
      const res = await save(filename, bytesToBase64(bytes));
      if (res?.ok) {
        toast.success('Sheet downloaded');
        return 'ok';
      }
      if (res?.canceled) return 'canceled';
      toast.error(res?.message || 'Failed to save sheet');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save sheet');
      return 'error';
    }
    return 'error';
  }

  fallbackAnchorDownload(bytes, filename);
  toast.success('Sheet downloaded');
  return 'ok';
}

/** Build an .xlsx and save it via OS Save dialog (or browser download). */
export async function saveWorkbook(
  rows: Record<string, unknown>[],
  opts: { sheetName: string; filename: string; emptyMessage?: string },
): Promise<SaveWorkbookResult> {
  if (!rows.length) {
    toast.warn(opts.emptyMessage || 'No data to export');
    return 'empty';
  }
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(opts.sheetName.slice(0, 31));
    const columns = Object.keys(rows[0]);
    worksheet.addRow(columns);
    rows.forEach((row) => {
      worksheet.addRow(columns.map((column) => row[column] ?? ''));
    });
    const bytes = toUint8Array(await workbook.xlsx.writeBuffer());
    return persistSheetFile(bytes, opts.filename);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to build sheet');
    return 'error';
  }
}
