import ExcelJS from 'exceljs';

const MAX_SPREADSHEET_ROWS = 100_000;

type ReadSpreadsheetOptions = {
  allSheets?: boolean;
  maxRows?: number;
};

function cellValue(value: ExcelJS.CellValue): unknown {
  if (value == null || typeof value !== 'object') return value;
  if ('result' in value) return value.result;
  if ('text' in value) return value.text;
  return String(value);
}

function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((values) => values.some((value) => value.trim()));
}

function rowsFromValues(values: unknown[][]): Record<string, unknown>[] {
  const headers = (values[0] || []).map((value, index) => {
    const header = String(value ?? '').trim();
    return header || `Column ${index + 1}`;
  });
  return values
    .slice(1)
    .map((valuesRow) =>
      Object.fromEntries(headers.map((header, index) => [header, valuesRow[index] ?? ''])),
    );
}

function worksheetRows(worksheet: ExcelJS.Worksheet): Record<string, unknown>[] {
  const values: unknown[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const rowValues: unknown[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      rowValues.push(cellValue(cell.value));
    });
    values.push(rowValues);
  });
  return rowsFromValues(values);
}

export async function readSpreadsheetRows(
  file: File,
  options: ReadSpreadsheetOptions = {},
): Promise<Record<string, unknown>[]> {
  const name = file.name.toLowerCase();
  const maxRows = Math.min(options.maxRows || MAX_SPREADSHEET_ROWS, MAX_SPREADSHEET_ROWS);
  let rows: Record<string, unknown>[];

  if (name.endsWith('.csv')) {
    rows = rowsFromValues(csvRows(await file.text()));
  } else if (name.endsWith('.xlsx')) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const worksheets = options.allSheets ? workbook.worksheets : workbook.worksheets.slice(0, 1);
    rows = worksheets.flatMap(worksheetRows);
  } else {
    throw new Error('Only .xlsx and .csv files are supported');
  }

  if (rows.length > maxRows) {
    throw new Error(`Spreadsheet exceeds max ${maxRows} rows`);
  }
  return rows;
}
