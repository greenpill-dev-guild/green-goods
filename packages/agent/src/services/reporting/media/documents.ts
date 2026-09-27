import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Local document tooling with hard bounds. Each run gets a fresh private directory, a minimal
 * environment with no secrets, a wall-clock limit, capped output and cleanup on every path. PDFs
 * are inspected with Poppler so page coverage is known before any model call; Word and Excel files
 * can be converted to PDF by LibreOffice when that capability is enabled. A converter process is
 * not a sandbox by itself: network isolation and resource limits come from the worker container.
 */
export interface DocumentTools {
  inspectPdf(bytes: Uint8Array): Promise<PdfInspection>;
  convertToPdf(bytes: Uint8Array, kind: "docx" | "xlsx"): Promise<Uint8Array>;
}

export type PdfInspection =
  | { ok: true; pages: number }
  | { ok: false; reason: "encrypted" | "too_many_pages" | "unreadable"; pages?: number };

export const DOCUMENT_LIMITS = { maxPdfPages: 20, maxBytes: 10 * 1024 * 1024, timeoutMs: 60_000 };

export class DocumentToolError extends Error {
  constructor(readonly reason: "unavailable" | "timeout" | "failed" | "too_large") {
    super(`Document processing failed: ${reason}`);
    this.name = "DocumentToolError";
  }
}

function run(
  command: string,
  args: string[],
  options: { cwd: string; timeoutMs: number; maxOutput: number }
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        cwd: options.cwd,
        timeout: options.timeoutMs,
        maxBuffer: options.maxOutput,
        killSignal: "SIGKILL",
        env: { PATH: process.env.PATH ?? "/usr/bin:/bin", HOME: options.cwd, LANG: "C.UTF-8" },
      },
      (error, stdout) => {
        if (!error) return resolve(String(stdout));
        const code = (error as NodeJS.ErrnoException & { killed?: boolean }).code;
        if (code === "ENOENT") return reject(new DocumentToolError("unavailable"));
        if ((error as { killed?: boolean }).killed) return reject(new DocumentToolError("timeout"));
        reject(new DocumentToolError("failed"));
      }
    );
  });
}

async function withWorkspace<T>(work: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "gg-reporting-doc-"));
  try {
    return await work(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export function createDocumentTools(options: {
  popplerBin?: string;
  libreOfficeBin?: string;
  conversionEnabled: boolean;
}): DocumentTools {
  const pdfinfo = options.popplerBin ? join(options.popplerBin, "pdfinfo") : "pdfinfo";
  const soffice = options.libreOfficeBin ?? "soffice";
  return {
    async inspectPdf(bytes) {
      return withWorkspace(async (dir) => {
        await writeFile(join(dir, "input.pdf"), bytes, { mode: 0o600 });
        let info: string;
        try {
          info = await run(pdfinfo, ["input.pdf"], {
            cwd: dir,
            timeoutMs: 15_000,
            maxOutput: 64 * 1024,
          });
        } catch (error) {
          if (error instanceof DocumentToolError && error.reason === "unavailable") throw error;
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
      if (!options.conversionEnabled) throw new DocumentToolError("unavailable");
      return withWorkspace(async (dir) => {
        const input = `input.${kind}`;
        await writeFile(join(dir, input), bytes, { mode: 0o600 });
        // A fresh profile per run: no shared state, macros or remembered external links.
        await run(
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
        if (!pdf) throw new DocumentToolError("failed");
        const converted = new Uint8Array(await readFile(join(dir, "out", pdf)));
        if (converted.byteLength > DOCUMENT_LIMITS.maxBytes)
          throw new DocumentToolError("too_large");
        return converted;
      });
    },
  };
}
