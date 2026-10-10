import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { detectType } from "../../services/reporting/media/detect";
import { readCsv, readWorkbook, sumRange } from "../../services/reporting/media/tables";
import { zip } from "./support/media";

/** Byte-level detection and table reading on hand-built fixtures. */
const DOCX_TYPES = "<Types/>";

describe("format detection", () => {
  it("identifies Office files from their contents, not their names", () => {
    expect(
      detectType(zip({ "[Content_Types].xml": DOCX_TYPES, "word/document.xml": "<w/>" }))
    ).toMatchObject({
      kind: "docx",
    });
    expect(
      detectType(zip({ "[Content_Types].xml": DOCX_TYPES, "xl/workbook.xml": "<wb/>" }))
    ).toMatchObject({
      kind: "xlsx",
    });
    expect(detectType(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0]))).toEqual({
      kind: "unsupported",
      reason: "legacy_office",
    });
  });

  it("refuses external relationships, encrypted entries and archives that expand too far", () => {
    const external = zip({
      "word/document.xml": "<w/>",
      "word/_rels/document.xml.rels":
        '<Relationships><Relationship TargetMode="External" Target="http://example.test/x.png"/></Relationships>',
    });
    expect(detectType(external)).toEqual({ kind: "unsupported", reason: "external_content" });

    const bomb = zip({ "word/document.xml": "a".repeat(2_000_000) });
    expect(detectType(bomb)).toEqual({ kind: "unsupported", reason: "archive_limits" });

    const encrypted = zip({ "word/document.xml": "<w/>" });
    const view = new DataView(encrypted.buffer);
    const central = encrypted.length - 22 - (46 + "word/document.xml".length);
    view.setUint16(central + 8, 1, true);
    expect(detectType(encrypted)).toEqual({ kind: "unsupported", reason: "encrypted" });
  });

  it("recognizes CSV only when rows share a delimiter", () => {
    expect(detectType(new TextEncoder().encode("plot;seedlings\nnorth;5\nsouth;4\n"))).toEqual({
      kind: "csv",
      mime: "text/csv",
    });
    expect(detectType(new TextEncoder().encode("just a note about the fence"))).toEqual({
      kind: "unsupported",
      reason: "unknown_format",
    });
  });
});

describe("table reading", () => {
  it("reads quoted CSV fields and decimal commas with exact cell references", () => {
    const result = readCsv(
      new TextEncoder().encode('plot;area;notes\nnorth;1,5;"fence; east"\nsouth;2;x\n')
    );
    if (!result.ok) throw new Error("expected a table");
    const cell = (ref: string) => result.table.cells.find((entry) => entry.ref === ref)?.value;
    expect(cell("B2")).toBe(1.5);
    expect(cell("C2")).toBe("fence; east");
    expect(sumRange(result.table, "B2:B3")).toEqual({
      ok: true,
      total: 3.5,
      counted: 2,
      skipped: [],
    });
  });

  it("flags grouped numbers instead of guessing their meaning", () => {
    const result = readCsv(new TextEncoder().encode('plot,count\nnorth,"1,234"\n'));
    if (!result.ok) throw new Error("expected a table");
    expect(result.table.warnings).toContain("ambiguous_numbers");
    expect(result.table.cells.find((cell) => cell.ref === "B2")?.value).toBe("1,234");
  });

  it("skips hidden rows and never sums formula results", async () => {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet("Data");
    sheet.addRow(["Plot", "Count"]);
    sheet.addRow(["A", 2]);
    sheet.addRow(["B", 3]).hidden = true;
    sheet.addRow(["Total", { formula: "SUM(B2:B3)", result: 5 }]);
    const result = await readWorkbook(new Uint8Array(await book.xlsx.writeBuffer()));
    if (!result.ok) throw new Error("expected a table");
    expect(result.table.excluded.hiddenRows).toBe(1);
    expect(result.table.warnings).toContain("formula_cells");
    expect(sumRange(result.table, "Data!B2:B4")).toEqual({
      ok: true,
      total: 2,
      counted: 1,
      skipped: ["Data!B4"],
    });
    expect(sumRange(result.table, "not a range")).toEqual({ ok: false, reason: "bad_range" });
  });

  it("refuses workbooks beyond the cell budget rather than reading part of them", () => {
    const rows = Array.from({ length: 5_100 }, (_, index) => `${index},${index}`).join("\n");
    expect(readCsv(new TextEncoder().encode(`a,b\n${rows}`))).toEqual({
      ok: false,
      reason: "too_many_cells",
    });
  });
});
