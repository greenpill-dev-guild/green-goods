import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { createDocumentTools } from "../../services/reporting/media/documents";
import { LocalToolError } from "../../services/reporting/media/subprocess";

/**
 * The real Poppler path on generated PDFs, skipped where `pdfinfo` is not installed. LibreOffice
 * conversion is disabled here; only its refusal is checked, because isolation must be proven in
 * the worker image before it is enabled.
 */
function available(command: string): boolean {
  try {
    execFileSync(command, ["-v"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** A minimal, valid PDF with `pages` blank pages and a correct cross-reference table. */
function pdf(pages: number): Uint8Array {
  const objects: string[] = [];
  const kids = Array.from({ length: pages }, (_, index) => `${3 + index} 0 R`).join(" ");
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pages} >>`);
  for (let index = 0; index < pages; index += 1) {
    objects.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>");
  }
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(body);
}

describe.skipIf(!available("pdfinfo"))("document tools with Poppler", () => {
  const tools = createDocumentTools();

  it("counts pages and refuses documents over the page budget", async () => {
    expect(await tools.inspectPdf(pdf(3))).toEqual({ ok: true, pages: 3 });
    expect(await tools.inspectPdf(pdf(21))).toEqual({
      ok: false,
      reason: "too_many_pages",
      pages: 21,
    });
  });

  it("reports damaged PDFs as unreadable", async () => {
    expect(await tools.inspectPdf(new TextEncoder().encode("%PDF-1.4 not really"))).toEqual({
      ok: false,
      reason: "unreadable",
    });
  });
});

describe("office conversion", () => {
  it("reports conversion as unavailable when LibreOffice is not installed", async () => {
    const tools = createDocumentTools({ libreOfficeBin: "/nonexistent/soffice" });
    await expect(tools.convertToPdf(new Uint8Array([1]), "docx")).rejects.toMatchObject(
      new LocalToolError("unavailable")
    );
  });
});
