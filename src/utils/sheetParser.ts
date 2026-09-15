import ExcelJS from "exceljs";
import { parse } from "csv-parse/sync";

export type SheetRow = Record<string, string>;

async function parseExcel(buffer: Buffer): Promise<SheetRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? "").trim();
  });

  const rows: SheetRow[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    if (row.cellCount === 0) continue;
    const isEmpty = row.values && (row.values as unknown[]).every((v) => v === null || v === undefined || v === "");
    if (isEmpty) continue;

    const record: SheetRow = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber];
      if (header) record[header] = String(cell.value ?? "").trim();
    });
    rows.push(record);
  }
  return rows;
}

function parseCsv(buffer: Buffer): SheetRow[] {
  const records = parse(buffer, {
    columns: (header: string[]) => header.map((h) => h.trim()),
    skip_empty_lines: true,
    trim: true,
  }) as SheetRow[];
  return records;
}

export async function parseSpreadsheet(
  buffer: Buffer,
  originalName: string,
  mimetype: string
): Promise<SheetRow[]> {
  const isCsv = mimetype.includes("csv") || /\.csv$/i.test(originalName);
  if (isCsv) return parseCsv(buffer);
  return parseExcel(buffer);
}
