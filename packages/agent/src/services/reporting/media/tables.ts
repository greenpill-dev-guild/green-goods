import ExcelJS from "exceljs";

/**
 * Spreadsheet and CSV reading with exact cell coordinates. Only visible sheets, rows and columns
 * are read; hidden content is counted and reported, never sent to a model or published. Formula
 * cells keep their cached result but are marked, and totals are computed here from literal
 * numbers only, so a cached or model-reported total never becomes a report value by itself.
 */
export interface TableCell {
  sheet: string;
  ref: string;
  row: number;
  col: number;
  value: string | number | boolean | null;
  formula: boolean;
}

export interface TableExtract {
  sheets: string[];
  cells: TableCell[];
  excluded: { hiddenSheets: string[]; hiddenRows: number; hiddenColumns: number };
  warnings: string[];
}

export type TableResult =
  | { ok: true; table: TableExtract }
  | { ok: false; reason: "too_many_sheets" | "too_many_cells" | "unreadable" | "empty" };

const LIMITS = { maxSheets: 5, maxCells: 10_000, maxCellText: 500 };

function columnName(col: number): string {
  let name = "";
  for (let rest = col; rest > 0; rest = Math.floor((rest - 1) / 26)) {
    name = String.fromCharCode(65 + ((rest - 1) % 26)) + name;
  }
  return name;
}

function columnNumber(name: string): number {
  return [...name.toUpperCase()].reduce((total, char) => total * 26 + (char.charCodeAt(0) - 64), 0);
}

function cellValue(raw: unknown): { value: TableCell["value"]; formula: boolean; error: boolean } {
  if (raw === null || raw === undefined) return { value: null, formula: false, error: false };
  if (typeof raw === "number" || typeof raw === "boolean")
    return { value: raw, formula: false, error: false };
  if (typeof raw === "string")
    return { value: raw.slice(0, LIMITS.maxCellText), formula: false, error: false };
  if (raw instanceof Date) return { value: raw.toISOString(), formula: false, error: false };
  const record = raw as Record<string, unknown>;
  if ("formula" in record || "sharedFormula" in record) {
    const inner = cellValue(record.result);
    return { value: inner.value, formula: true, error: inner.error };
  }
  if (Array.isArray(record.richText)) {
    const text = (record.richText as Array<{ text?: string }>)
      .map((part) => part.text ?? "")
      .join("");
    return { value: text.slice(0, LIMITS.maxCellText), formula: false, error: false };
  }
  if (typeof record.text === "string")
    return { value: record.text.slice(0, LIMITS.maxCellText), formula: false, error: false };
  if ("error" in record) return { value: null, formula: false, error: true };
  return { value: null, formula: false, error: true };
}

export async function readWorkbook(bytes: Uint8Array): Promise<TableResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer);
  } catch {
    return { ok: false, reason: "unreadable" };
  }
  const visible = workbook.worksheets.filter((sheet) => sheet.state === "visible");
  const hiddenSheets = workbook.worksheets
    .filter((sheet) => sheet.state !== "visible")
    .map((sheet) => sheet.name);
  if (visible.length > LIMITS.maxSheets) return { ok: false, reason: "too_many_sheets" };
  const cells: TableCell[] = [];
  const warnings = new Set<string>();
  let hiddenRows = 0;
  const hiddenColumns = new Set<string>();
  for (const sheet of visible) {
    let overflow = false;
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (overflow) return;
      if (row.hidden) {
        hiddenRows += 1;
        return;
      }
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        if (sheet.getColumn(colNumber).hidden) {
          hiddenColumns.add(`${sheet.name}!${columnName(colNumber)}`);
          return;
        }
        if (cell.isMerged && cell.master !== cell) return;
        const { value, formula, error } = cellValue(cell.value);
        if (formula) warnings.add("formula_cells");
        if (error) warnings.add("error_cells");
        if (value === null || value === "") return;
        if (cells.length >= LIMITS.maxCells) {
          overflow = true;
          return;
        }
        cells.push({
          sheet: sheet.name,
          ref: `${columnName(colNumber)}${rowNumber}`,
          row: rowNumber,
          col: colNumber,
          value,
          formula,
        });
      });
    });
    if (overflow) return { ok: false, reason: "too_many_cells" };
  }
  if (cells.length === 0) return { ok: false, reason: "empty" };
  return {
    ok: true,
    table: {
      sheets: visible.map((sheet) => sheet.name),
      cells,
      excluded: { hiddenSheets, hiddenRows, hiddenColumns: hiddenColumns.size },
      warnings: [...warnings],
    },
  };
}

/** RFC 4180 fields with the delimiter taken from the header line. */
export function readCsv(bytes: Uint8Array): TableResult {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "");
  } catch {
    return { ok: false, reason: "unreadable" };
  }
  const header = text.slice(0, text.indexOf("\n") >= 0 ? text.indexOf("\n") : text.length);
  const delimiter = [";", "\t", ","].reduce((best, candidate) =>
    header.split(candidate).length > header.split(best).length ? candidate : best
  );
  const decimalComma = delimiter !== ",";
  const cells: TableCell[] = [];
  const warnings = new Set<string>();
  let row = 1;
  let col = 1;
  let field = "";
  let quoted = false;
  const push = () => {
    const raw = field.trim().slice(0, LIMITS.maxCellText);
    field = "";
    if (raw === "") return true;
    if (cells.length >= LIMITS.maxCells) return false;
    const numeric = decimalComma ? /^-?\d+([.,]\d+)?$/ : /^-?\d+(\.\d+)?$/;
    let value: string | number = raw;
    if (numeric.test(raw)) value = Number(raw.replace(",", "."));
    else if (/^-?[\d.,\s]+$/.test(raw) && /\d/.test(raw)) warnings.add("ambiguous_numbers");
    cells.push({ sheet: "csv", ref: `${columnName(col)}${row}`, row, col, value, formula: false });
    return true;
  };
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === delimiter) {
      if (!push()) return { ok: false, reason: "too_many_cells" };
      col += 1;
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      if (!push()) return { ok: false, reason: "too_many_cells" };
      row += 1;
      col = 1;
    } else field += char;
  }
  if (!push()) return { ok: false, reason: "too_many_cells" };
  if (cells.length === 0) return { ok: false, reason: "empty" };
  return {
    ok: true,
    table: {
      sheets: ["csv"],
      cells,
      excluded: { hiddenSheets: [], hiddenRows: 0, hiddenColumns: 0 },
      warnings: [...warnings],
    },
  };
}

/** Bounded text form for the model: one `Sheet!Ref<TAB>value` line per visible populated cell. */
export function tableText(
  table: TableExtract,
  maxChars = 40_000
): { text: string; complete: boolean } {
  let text = "";
  for (const cell of table.cells) {
    const line = `${cell.sheet}!${cell.ref}\t${String(cell.value)}${cell.formula ? "\t(formula)" : ""}\n`;
    if (text.length + line.length > maxChars) return { text, complete: false };
    text += line;
  }
  return { text, complete: true };
}

export type RangeSum =
  | { ok: true; total: number; counted: number; skipped: string[] }
  | { ok: false; reason: "bad_range" | "no_numbers" };

/** Sums literal numbers in one rectangular range; formula and text cells are listed, not added. */
export function sumRange(table: TableExtract, range: string): RangeSum {
  const match = /^(?:(.+)!)?([A-Z]{1,3})(\d{1,6}):([A-Z]{1,3})(\d{1,6})$/i.exec(range.trim());
  if (!match) return { ok: false, reason: "bad_range" };
  const [, sheetName, fromCol, fromRow, toCol, toRow] = match as unknown as string[];
  const sheet = sheetName?.replace(/^'|'$/g, "") ?? table.sheets[0];
  const [c1, c2] = [columnNumber(fromCol as string), columnNumber(toCol as string)].sort(
    (a, b) => a - b
  );
  const [r1, r2] = [Number(fromRow), Number(toRow)].sort((a, b) => a - b);
  let total = 0;
  let counted = 0;
  const skipped: string[] = [];
  for (const cell of table.cells) {
    if (cell.sheet !== sheet || cell.col < (c1 as number) || cell.col > (c2 as number)) continue;
    if (cell.row < (r1 as number) || cell.row > (r2 as number)) continue;
    if (typeof cell.value === "number" && !cell.formula && Number.isFinite(cell.value)) {
      total += cell.value;
      counted += 1;
    } else skipped.push(`${cell.sheet}!${cell.ref}`);
  }
  if (counted === 0) return { ok: false, reason: "no_numbers" };
  return { ok: true, total: Math.round(total * 1e6) / 1e6, counted, skipped };
}
