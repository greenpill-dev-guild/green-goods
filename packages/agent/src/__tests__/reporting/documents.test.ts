import { execFileSync } from "node:child_process";
import { access, mkdir, readFile, stat, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createDocumentTools } from "../../services/reporting/media/documents";
import { LocalToolError, type runTool } from "../../services/reporting/media/subprocess";
import { zip } from "./support/media";

/**
 * Real Poppler proof when installed; an injected process adapter verifies Office sandbox requests,
 * output bounds and cleanup. Actual LibreOffice fidelity and Linux namespace isolation require
 * separate container proof: the process adapter below does not execute the converter.
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
  function office(kind: "docx" | "xlsx", extra: Array<{ name: string; text: string }> = []) {
    return zip({
      "[Content_Types].xml": "<Types/>",
      [kind === "docx" ? "word/document.xml" : "xl/workbook.xml"]: "<document/>",
      ...Object.fromEntries(extra.map(({ name, text }) => [name, text])),
    });
  }

  function converter(output: Uint8Array = pdf(3), failure?: LocalToolError) {
    const calls: Array<{ command: string; args: string[]; cwd: string; profile: string }> = [];
    const run: typeof runTool = async (command, args, options) => {
      const profile = await readFile(
        join(options.cwd, "profile/user/registrymodifications.xcu"),
        "utf8"
      );
      calls.push({ command, args, cwd: options.cwd, profile });
      expect(
        (
          await stat(join(options.cwd, "input.docx")).catch(() =>
            stat(join(options.cwd, "input.xlsx"))
          )
        ).mode & 0o777
      ).toBe(0o600);
      if (failure) throw failure;
      await mkdir(join(options.cwd, "out"), { recursive: true });
      await writeFile(join(options.cwd, "out/input.pdf"), output);
      return "converted";
    };
    return { calls, tools: createDocumentTools({ run, sandboxBin: "/test/bwrap" }) };
  }

  it.each([
    "docx",
    "xlsx",
  ] as const)("converts safe %s in an isolated, bounded process and removes private files", async (kind) => {
    const { calls, tools } = converter();
    expect(await tools.convertToPdf(office(kind), kind)).toEqual(pdf(3));
    const call = calls[0];
    expect(call?.command).toBe("/test/bwrap");
    expect(call?.args).toEqual(
      expect.arrayContaining([
        "--unshare-net",
        "--unshare-user",
        "--unshare-pid",
        "--die-with-parent",
        "--clearenv",
        "--as=805306368",
        "--cpu=60",
        "--fsize=10485760",
        "--core=0",
        "-env:UserInstallation=file:///work/profile",
        "--convert-to",
        kind === "docx" ? "pdf:writer_pdf_Export" : "pdf:calc_pdf_Export",
      ])
    );
    expect(call?.args).not.toContain("/data");
    expect(call?.args).not.toContain("/app");
    expect(call?.profile).toContain('oor:name="DisableMacrosExecution"');
    expect(call?.profile).toContain('oor:name="DisableActiveContent"');
    expect(call?.profile).toContain('oor:name="MacroSecurityLevel"');
    await expect(access(call!.cwd)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it.each([
    [{ name: "word/vbaProject.bin", text: "macro" }],
    [
      {
        name: "word/_rels/document.xml.rels",
        text: '<Relationship TargetMode="External" Target="https://private.test"/>',
      },
    ],
    [{ name: "word/embeddings/oleObject1.bin", text: "active" }],
  ])("rejects active or external Office content before starting a process", async (extra) => {
    const { calls, tools } = converter();
    await expect(tools.convertToPdf(office("docx", [extra]), "docx")).rejects.toMatchObject({
      reason: "failed",
    });
    expect(calls).toHaveLength(0);
  });

  it("rejects oversized inputs and converted outputs and cleans up after converter failure", async () => {
    const oversized = converter();
    await expect(
      oversized.tools.convertToPdf(new Uint8Array(10 * 1024 * 1024 + 1), "docx")
    ).rejects.toMatchObject({ reason: "too_large" });
    expect(oversized.calls).toHaveLength(0);
    const output = converter(new Uint8Array(10 * 1024 * 1024 + 1));
    await expect(output.tools.convertToPdf(office("docx"), "docx")).rejects.toMatchObject({
      reason: "too_large",
    });
    await expect(access(output.calls[0]!.cwd)).rejects.toMatchObject({ code: "ENOENT" });
    const failed = converter(pdf(1), new LocalToolError("timeout"));
    await expect(failed.tools.convertToPdf(office("docx"), "docx")).rejects.toMatchObject({
      reason: "timeout",
    });
    await expect(access(failed.calls[0]!.cwd)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("reports conversion as unavailable when LibreOffice is not installed", async () => {
    const tools = createDocumentTools({ sandboxBin: "/nonexistent/bwrap" });
    await expect(tools.convertToPdf(office("docx"), "docx")).rejects.toMatchObject(
      new LocalToolError("unavailable")
    );
  });

  it("refuses a converter's symlink output and never retries without the sandbox", async () => {
    const calls: string[] = [];
    const run: typeof runTool = async (command, _args, { cwd }) => {
      calls.push(command);
      await writeFile(join(cwd, "other.pdf"), pdf(1));
      await symlink(join(cwd, "other.pdf"), join(cwd, "out/input.pdf"));
      return "converted";
    };
    await expect(
      createDocumentTools({ run, sandboxBin: "/test/bwrap" }).convertToPdf(office("docx"), "docx")
    ).rejects.toMatchObject({ reason: "failed" });
    expect(calls).toEqual(["/test/bwrap"]);
  });
});
