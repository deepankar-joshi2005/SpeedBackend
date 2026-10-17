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

// Pulls the value of a top-level `Q_MAP = {...}` / `Q_DATA_ALL = {...}` style
// assignment out of the quiz HTML's inline <script>. We can't just regex up to
// the next `;` because solution HTML inside the object can itself contain
// semicolons, so this walks the source counting braces (while skipping over
// string literals) to find the matching close.
function extractJsonVar(source: string, varName: string): unknown {
  const marker = new RegExp(`\\b${varName}\\s*=\\s*`).exec(source);
  if (!marker) return null;

  let i = marker.index + marker[0].length;
  while (i < source.length && source[i] !== "{" && source[i] !== "[") i++;
  if (i >= source.length) return null;

  const openChar = source[i];
  const closeChar = openChar === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let stringChar = "";
  let escaped = false;
  let end = -1;

  for (let j = i; j < source.length; j++) {
    const ch = source[j];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === stringChar) inString = false;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
    } else if (ch === openChar) {
      depth++;
    } else if (ch === closeChar) {
      depth--;
      if (depth === 0) {
        end = j;
        break;
      }
    }
  }
  if (end === -1) return null;

  return JSON.parse(source.slice(i, end + 1));
}

function htmlToPlainText(html: string | undefined | null): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface QMapEntry {
  correct: number;
  pos: number;
  neg: number;
  si: number;
}

interface QDataEntry {
  n: number;
  si: number;
  text: string;
  comp?: string;
  opts: string[];
  cidx: number;
  sol: string;
  pos?: number;
  neg?: number;
}

const OPTION_LETTERS = ["A", "B", "C", "D"];

// Testbook-style single-file mock-test exports embed all question/option/
// answer/solution data as a clean JS object literal (`Q_MAP` + `Q_DATA_ALL`)
// inside one <script> tag, so this reshapes that object into the same
// SheetRow[] the CSV/Excel importer already produces instead of scraping markup.
export function parseHtmlQuiz(buffer: Buffer): SheetRow[] {
  const html = buffer.toString("utf-8");

  const qMap = extractJsonVar(html, "Q_MAP") as Record<string, QMapEntry> | null;
  const qDataAll = extractJsonVar(html, "Q_DATA_ALL") as Record<string, QDataEntry[]> | null;
  const secNames = extractJsonVar(html, "SEC_NAMES") as string[] | null;

  if (!qMap || !qDataAll || !Array.isArray(qDataAll.en) || qDataAll.en.length === 0) {
    throw new Error(
      "Could not find quiz data in this HTML file. Expected an embedded Q_MAP/Q_DATA_ALL dataset."
    );
  }

  const hiByNumber = new Map((qDataAll.hi ?? []).map((q) => [q.n, q]));

  return qDataAll.en.map((q): SheetRow => {
    const meta = qMap[String(q.n)];
    const hi = hiByNumber.get(q.n);
    const correctIdx = meta?.correct ?? q.cidx;
    const marksValue = meta?.pos || q.pos || 2;
    const subject = secNames?.[q.si] || `Section ${q.si + 1}`;

    const questionText = [htmlToPlainText(q.comp), htmlToPlainText(q.text)]
      .filter(Boolean)
      .join("\n\n");
    const questionTextHindi = hi
      ? [htmlToPlainText(hi.comp), htmlToPlainText(hi.text)].filter(Boolean).join("\n\n")
      : "";

    return {
      Subject: subject,
      Topic: "",
      Question: questionText,
      "Option A": htmlToPlainText(q.opts?.[0]),
      "Option B": htmlToPlainText(q.opts?.[1]),
      "Option C": htmlToPlainText(q.opts?.[2]),
      "Option D": htmlToPlainText(q.opts?.[3]),
      "Correct Answer": OPTION_LETTERS[correctIdx] ?? "",
      Explanation: htmlToPlainText(q.sol),
      Marks: String(marksValue),
      "Question Hindi": questionTextHindi,
      "Option A Hindi": hi ? htmlToPlainText(hi.opts?.[0]) : "",
      "Option B Hindi": hi ? htmlToPlainText(hi.opts?.[1]) : "",
      "Option C Hindi": hi ? htmlToPlainText(hi.opts?.[2]) : "",
      "Option D Hindi": hi ? htmlToPlainText(hi.opts?.[3]) : "",
      "Explanation Hindi": hi ? htmlToPlainText(hi.sol) : "",
    };
  });
}

export async function parseSpreadsheet(
  buffer: Buffer,
  originalName: string,
  mimetype: string
): Promise<SheetRow[]> {
  const isCsv = mimetype.includes("csv") || /\.csv$/i.test(originalName);
  if (isCsv) return parseCsv(buffer);

  const isHtml = mimetype.includes("html") || /\.html?$/i.test(originalName);
  if (isHtml) return parseHtmlQuiz(buffer);

  return parseExcel(buffer);
}
