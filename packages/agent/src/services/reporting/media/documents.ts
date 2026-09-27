import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { LocalToolError, runTool, withWorkspace } from "./subprocess";

/**
 * Local document tooling with hard bounds (see `subprocess.ts`). PDFs are inspected with Poppler
 * so page coverage is known before any model call; Word and Excel files can be converted to PDF by
 * LibreOffice when that capability is enabled.
 */
export interface DocumentTools {
  inspectPdf(bytes: Uint8Array): Promise<PdfInspection>;
  convertToPdf(bytes: Uint8Array, kind: "docx" | "xlsx"): Promise<Uint8Array>;
}

export type PdfInspection =
  | { ok: true; pages: number }
  | { ok: false; reason: "encrypted" | "too_many_pages" | "unreadable"; pages?: number };

const DOCUMENT_LIMITS = { maxPdfPages: 20, maxBytes: 10 * 1024 * 1024, timeoutMs: 60_000 };

export function createDocumentTools(options: {
  popplerBin?: string;
  libreOfficeBin?: string;
  conversionEnabled: boolean;
}): DocumentTools {
  const pdfinfo = options.popplerBin ? join(options.popplerBin, "pdfinfo") : "pdfinfo";
  const soffice = options.libreOfficeBin ?? "soffice";
  return {
    async inspectPdf(bytes) {
      return withWorkspace("gg-reporting-doc-", async (dir) => {
        await writeFile(join(dir, "input.pdf"), bytes, { mode: 0o600 });
        let info: string;
        try {
          info = await runTool(pdfinfo, ["input.pdf"], {
            cwd: dir,
            timeoutMs: 15_000,
            maxOutput: 64 * 1024,
          });
        } catch (error) {
          if (error instanceof LocalToolError && error.reason === "unavailable") throw error;
          return { ok: false, reason: "unreadable" };
        }
        const pages = Number(/^Pages:\s+(\d+)/m.exec(info)?.[1] ?? Number.NaN);
        if (/^Encrypted:\s+yes/m.test(info)) return { ok: false, reason: "encrypted" };
        if (!Number.isInteger(pages) || pages < 1) return { ok: false, reason: "unreadable" };
        if (pages > DOCUMENT_LIMITS.maxPdfPages)
          return { ok: false, reason: "too_many_pages", pages };
        return { ok: true, pages };
      });
    },

    async convertToPdf(bytes, kind) {
      if (!options.conversionEnabled) throw new LocalToolError("unavailable");
      return withWorkspace("gg-reporting-doc-", async (dir) => {
        const input = `input.${kind}`;
        await writeFile(join(dir, input), bytes, { mode: 0o600 });
        // A fresh profile per run: no shared state, macros or remembered external links.
        await runTool(
          soffice,
          [
            "--headless",
            "--norestore",
            "--nolockcheck",
            "--nodefault",
            "--nofirststartwizard",
            `-env:UserInstallation=file://${join(dir, "profile")}`,
            "--convert-to",
            "pdf",
            "--outdir",
            join(dir, "out"),
            input,
          ],
          { cwd: dir, timeoutMs: DOCUMENT_LIMITS.timeoutMs, maxOutput: 256 * 1024 }
        );
        const outputs = await readdir(join(dir, "out")).catch(() => [] as string[]);
        const pdf = outputs.find((name) => name.endsWith(".pdf"));
        if (!pdf) throw new LocalToolError("failed");
        const converted = new Uint8Array(await readFile(join(dir, "out", pdf)));
        if (converted.byteLength > DOCUMENT_LIMITS.maxBytes) throw new LocalToolError("too_large");
        return converted;
      });
    },
  };
}
