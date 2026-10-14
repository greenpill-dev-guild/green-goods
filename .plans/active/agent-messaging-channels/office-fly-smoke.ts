import { readFile } from "node:fs/promises";
import { createDocumentTools } from "/app/packages/agent/dist/services/reporting/media/documents.js";

// One-shot Plan Hub proof: use synthetic fixtures and a temporary no-service Fly machine.
const tools = createDocumentTools();
let passed = true;
for (const kind of ["docx", "xlsx"] as const) {
  try {
    const input = new Uint8Array(await readFile(`/tmp/synthetic.${kind}`));
    const pdf = await tools.convertToPdf(input, kind);
    const inspection = await tools.inspectPdf(pdf);
    const ok = inspection.ok && inspection.pages > 0;
    console.log(JSON.stringify({ check: "office-conversion", kind, ok, bytes: pdf.byteLength,
      ...(inspection.ok ? { pages: inspection.pages } : {}) }));
    passed &&= ok;
  } catch (error) {
    console.log(JSON.stringify({ check: "office-conversion", kind, ok: false,
      reason: error && typeof error === "object" && "reason" in error ? error.reason : "failed" }));
    passed = false;
  }
}
process.exitCode = passed ? 0 : 1;
