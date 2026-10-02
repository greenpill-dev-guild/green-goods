import { constants } from "node:fs";
import { mkdir, open, realpath, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { detectType } from "./detect";
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

/**
 * Poppler reads PDFs; LibreOffice converts safe Word/Excel files in a Linux namespace sandbox.
 * Missing tooling reports unavailable; a sandbox or converter failure never runs unsandboxed.
 * The media coordinator checks converted PDF pages before any provider call.
 */
export function createDocumentTools(
  options: {
    popplerBin?: string;
    libreOfficeBin?: string;
    sandboxBin?: string;
    run?: typeof runTool;
  } = {}
): DocumentTools {
  const pdfinfo = options.popplerBin ? join(options.popplerBin, "pdfinfo") : "pdfinfo";
  const soffice = options.libreOfficeBin ?? "/usr/bin/soffice";
  const sandbox = options.sandboxBin ?? "bwrap";
  const run = options.run ?? runTool;
  return {
    async inspectPdf(bytes) {
      return withWorkspace("gg-reporting-doc-", async (dir) => {
        await writeFile(join(dir, "input.pdf"), bytes, { mode: 0o600 });
        let info: string;
        try {
          info = await run(pdfinfo, ["input.pdf"], {
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
      if (bytes.byteLength > DOCUMENT_LIMITS.maxBytes) throw new LocalToolError("too_large");
      // Revalidate the converter boundary, even if a caller already inspected the upload.
      if (detectType(bytes).kind !== kind) throw new LocalToolError("failed");
      return withWorkspace("gg-reporting-doc-", async (dir) => {
        const input = `input.${kind}`;
        await writeFile(join(dir, input), bytes, { mode: 0o600 });
        await mkdir(join(dir, "out"), { mode: 0o700 });
        await mkdir(join(dir, "profile/user"), { recursive: true, mode: 0o700 });
        await writeFile(join(dir, "profile/user/registrymodifications.xcu"), OFFICE_PROFILE, {
          mode: 0o600,
        });
        // A fresh filesystem with only system binaries/libraries/fonts and this private job.
        // No Agent source, volume, credentials, host processes, network or inherited env.
        await run(
          sandbox,
          [
            "--unshare-user",
            "--unshare-ipc",
            "--unshare-pid",
            "--unshare-net",
            "--unshare-uts",
            "--die-with-parent",
            "--new-session",
            "--cap-drop",
            "ALL",
            "--clearenv",
            "--ro-bind",
            "/usr",
            "/usr",
            "--symlink",
            "usr/bin",
            "/bin",
            "--symlink",
            "usr/sbin",
            "/sbin",
            "--symlink",
            "usr/lib",
            "/lib",
            "--symlink",
            "usr/lib64",
            "/lib64",
            "--ro-bind-try",
            "/etc/fonts",
            "/etc/fonts",
            "--ro-bind-try",
            "/etc/ld.so.cache",
            "/etc/ld.so.cache",
            "--ro-bind-try",
            "/var/cache/fontconfig",
            "/var/cache/fontconfig",
            "--proc",
            "/proc",
            "--dev",
            "/dev",
            "--size",
            "67108864",
            "--tmpfs",
            "/tmp",
            "--bind",
            dir,
            "/work",
            "--chdir",
            "/work",
            "--setenv",
            "HOME",
            "/work",
            "--setenv",
            "LANG",
            "C.UTF-8",
            "--setenv",
            "PATH",
            "/usr/bin:/bin",
            "--setenv",
            "SAL_USE_VCLPLUGIN",
            "gen",
            "/usr/bin/prlimit",
            "--as=805306368",
            "--cpu=60",
            `--fsize=${DOCUMENT_LIMITS.maxBytes}`,
            "--core=0",
            "--nofile=256",
            "--",
            soffice,
            "--headless",
            "--norestore",
            "--nolockcheck",
            "--nodefault",
            "--nofirststartwizard",
            "-env:UserInstallation=file:///work/profile",
            "--convert-to",
            kind === "docx" ? "pdf:writer_pdf_Export" : "pdf:calc_pdf_Export",
            "--outdir",
            "/work/out",
            input,
          ],
          { cwd: dir, timeoutMs: DOCUMENT_LIMITS.timeoutMs, maxOutput: 256 * 1024 }
        );
        const outputPath = join(dir, "out/input.pdf");
        // A compromised converter must not trick the host into following an output symlink.
        if (
          (await realpath(outputPath).catch(() => null)) !==
          join(await realpath(dir), "out/input.pdf")
        )
          throw new LocalToolError("failed");
        const output = await open(outputPath, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
          const info = await output.stat();
          if (!info.isFile() || info.size < 5) throw new LocalToolError("failed");
          if (info.size > DOCUMENT_LIMITS.maxBytes) throw new LocalToolError("too_large");
          const converted = new Uint8Array(await output.readFile());
          if (detectType(converted).kind !== "pdf") throw new LocalToolError("failed");
          return converted;
        } finally {
          await output.close();
        }
      });
    },
  };
}

// LibreOffice's own security settings are defense in depth alongside byte inspection and Linux
// isolation. All runs start with this profile, so macros, OLE/DDE and link updates stay disabled.
const OFFICE_PROFILE = `<?xml version="1.0" encoding="UTF-8"?>
<oor:items xmlns:oor="http://openoffice.org/2001/registry">
  <item oor:path="/org.openoffice.Office.Common/Security/Scripting">
    <prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop>
    <prop oor:name="DisableMacrosExecution" oor:op="fuse"><value>true</value></prop>
    <prop oor:name="DisableActiveContent" oor:op="fuse"><value>true</value></prop>
  </item>
  <item oor:path="/org.openoffice.Office.Calc/Content/Update">
    <prop oor:name="Link" oor:op="fuse"><value>1</value></prop>
  </item>
  <item oor:path="/org.openoffice.Office.Writer/Content/Update">
    <prop oor:name="Link" oor:op="fuse"><value>2</value></prop>
  </item>
</oor:items>`;
