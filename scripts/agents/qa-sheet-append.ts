#!/usr/bin/env bun
/**
 * qa-sheet-append.ts — thin client for the qa-sheet-webhook Apps Script.
 *
 * Reads CSVs produced by `/qa-triage` Phase 5 and POSTs them as JSON to the
 * Apps Script Web App deployment that owns write access to the Green Goods v1.1
 * QA workbook. The Apps Script handles all sheet manipulation (header bootstrap,
 * Defects row append, single-column Defect Link backfill on Test tabs).
 *
 * Why an Apps Script Web App rather than direct Sheets API:
 *   - No Google Cloud Console setup (no service account, no OAuth client)
 *   - No browser flow, no refresh tokens
 *   - The Apps Script runs under the user's own Google identity and has
 *     native access to the Sheet they own
 *   - The deployment URL is unguessable (50+ random chars); a required shared
 *     secret in the body gates the constrained-op path; an optional admin
 *     secret unlocks an ad-hoc rawWrites path for local use only
 *
 * Canonical Apps Script source + secrets live at ~/.config/qa-triage/setup.md
 * (chmod 600, never in git). See scripts/agents/qa-sheet-webhook-setup.md for
 * the repo-side pointer + bootstrap steps on a fresh machine.
 *
 * Local config files (chmod 600 — these are effectively secrets):
 *   ~/.config/qa-triage/webhook.txt              Apps Script deployment URL
 *   ~/.config/qa-triage/webhook-secret.txt       Routine/CLI shared secret — gates the three constrained ops
 *   ~/.config/qa-triage/webhook-admin-secret.txt Local-Claude bypass — never sent by this CLI
 *
 * Invocation:
 *   bun scripts/agents/qa-sheet-append.ts \
 *     --defects-csv .plans/qa-triage/<slug>/sheet-rows.csv \
 *     --test-backfill-csv .plans/qa-triage/<slug>/sheet-test-backfill.csv \
 *     [--bootstrap-csv .plans/qa-triage/<slug>/schema-bootstrap.csv] \
 *     [--dry-run]
 *
 * Flags:
 *   --defects-csv <path>       CSV of Defects rows to append (matched to the Sheet's column order).
 *   --test-backfill-csv <path> CSV shaped: tab,test_id,defect_link.
 *   --bootstrap-csv <path>     CSV whose first row is the new columns to add to the Defects header.
 *   --dry-run                  Print the JSON payload that would be POSTed; do not send.
 *   --health                   GET the webhook URL; print Sheet name + tab list to confirm reachability.
 */

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const CONFIG_DIR = join(homedir(), ".config", "qa-triage");
const WEBHOOK_PATH = join(CONFIG_DIR, "webhook.txt");
const SECRET_PATH = join(CONFIG_DIR, "webhook-secret.txt");

interface CliArgs {
  defectsCsv?: string;
  testBackfillCsv?: string;
  bootstrapCsv?: string;
  dryRun: boolean;
  health: boolean;
}

interface TestBackfill {
  tab: string;
  testId: string;
  defectLink: string;
}

interface WebhookPayload {
  secret?: string;
  bootstrap?: string[];
  defectRows?: string[][];
  testBackfills?: TestBackfill[];
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { dryRun: false, health: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = (): string => {
      const v = argv[++i];
      if (!v) throw new Error(`Missing value for ${arg}`);
      return v;
    };
    switch (arg) {
      case "--defects-csv": args.defectsCsv = next(); break;
      case "--test-backfill-csv": args.testBackfillCsv = next(); break;
      case "--bootstrap-csv": args.bootstrapCsv = next(); break;
      case "--dry-run": args.dryRun = true; break;
      case "--health": args.health = true; break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.health && !args.defectsCsv && !args.testBackfillCsv && !args.bootstrapCsv) {
    throw new Error("at least one of --defects-csv, --test-backfill-csv, --bootstrap-csv, or --health is required");
  }
  return args;
}

function printHelp(): void {
  console.log("Usage: bun scripts/agents/qa-sheet-append.ts \\");
  console.log("  [--defects-csv <path>]");
  console.log("  [--test-backfill-csv <path>]");
  console.log("  [--bootstrap-csv <path>]");
  console.log("  [--dry-run]");
  console.log("  [--health]       GET the webhook URL to confirm reachability");
  console.log("");
  console.log("Setup: see scripts/agents/qa-sheet-webhook-setup.md and ~/.config/qa-triage/setup.md.");
}

async function readWebhookUrl(): Promise<string> {
  let url: string;
  try {
    url = (await readFile(WEBHOOK_PATH, "utf-8")).trim();
  } catch {
    throw new Error(
      `Webhook URL missing at ${WEBHOOK_PATH}.\n` +
        `One-time setup: paste ~/.config/qa-triage/setup.md § A.4 into the QA Sheet's Apps Script editor, ` +
        `deploy as a Web App, then save the deployment URL to ${WEBHOOK_PATH}.\n` +
        `Full steps in scripts/agents/qa-sheet-webhook-setup.md.`,
    );
  }
  if (!url.startsWith("https://script.google.com/")) {
    throw new Error(
      `Webhook URL host is not script.google.com (got ${new URL(url).host}). ` +
        `Refusing to send the SECRET to an unexpected host. ` +
        `Verify ${WEBHOOK_PATH} contains the Apps Script Web App URL.`,
    );
  }
  return url;
}

async function readSecret(): Promise<string | undefined> {
  try {
    const s = (await readFile(SECRET_PATH, "utf-8")).trim();
    return s.length > 0 ? s : undefined;
  } catch {
    return undefined;
  }
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; continue; }
      if (c === '"') { inQuotes = false; continue; }
      field += c;
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === ",") { row.push(field); field = ""; continue; }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      continue;
    }
    field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell !== "")) rows.push(row);
  }
  return rows;
}

async function readCsv(path: string): Promise<string[][]> {
  return parseCsv(await readFile(path, "utf-8"));
}

async function loadBootstrap(path: string): Promise<string[]> {
  const csv = await readCsv(path);
  if (csv.length === 0) return [];
  return csv[0];
}

async function loadDefects(path: string): Promise<string[][]> {
  const csv = await readCsv(path);
  if (csv.length === 0) return [];
  const hasHeader = csv[0][0]?.trim() === "Defect ID";
  return hasHeader ? csv.slice(1) : csv;
}

async function loadTestBackfills(path: string): Promise<TestBackfill[]> {
  const csv = await readCsv(path);
  if (csv.length === 0) return [];
  const hasHeader = csv[0][0]?.trim().toLowerCase() === "tab";
  const rows = hasHeader ? csv.slice(1) : csv;
  return rows
    .map((r) => ({ tab: r[0], testId: r[1], defectLink: r[2] }))
    .filter((b) => b.tab && b.testId && b.defectLink);
}

async function buildPayload(args: CliArgs): Promise<WebhookPayload> {
  const payload: WebhookPayload = {};
  const secret = await readSecret();
  if (secret) payload.secret = secret;
  if (args.bootstrapCsv) {
    const cols = await loadBootstrap(args.bootstrapCsv);
    if (cols.length > 0) payload.bootstrap = cols;
  }
  if (args.defectsCsv) {
    const rows = await loadDefects(args.defectsCsv);
    if (rows.length > 0) payload.defectRows = rows;
  }
  if (args.testBackfillCsv) {
    const backfills = await loadTestBackfills(args.testBackfillCsv);
    if (backfills.length > 0) payload.testBackfills = backfills;
  }
  return payload;
}

async function healthCheck(url: string): Promise<void> {
  const res = await fetch(url, { method: "GET" });
  const text = await res.text();
  if (!res.ok) throw new Error(`Health GET failed (${res.status}): ${text}`);
  console.log(text);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const url = await readWebhookUrl();

  if (args.health) {
    await healthCheck(url);
    return;
  }

  const payload = await buildPayload(args);
  if (Object.keys(payload).filter((k) => k !== "secret").length === 0) {
    console.log("Nothing to send (all CSVs were empty).");
    return;
  }

  if (!args.dryRun && !payload.secret) {
    throw new Error(
      `Webhook shared secret missing at ${SECRET_PATH}. ` +
        `Refusing to POST private QA rows without the constrained-op secret. ` +
        `Create ${SECRET_PATH} from ~/.config/qa-triage/setup.md or pass --dry-run to inspect the payload locally.`,
    );
  }

  if (args.dryRun) {
    console.log("[dry-run] POST", url);
    console.log("[dry-run] body:");
    const redacted: WebhookPayload = { ...payload };
    if (redacted.secret) redacted.secret = "***REDACTED (matches webhook-secret.txt)***";
    console.log(JSON.stringify(redacted, null, 2));
    return;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    redirect: "follow", // Apps Script Web Apps return a redirect to the actual deployment
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Webhook POST failed (${res.status}): ${text}`);
  }
  // Apps Script always returns 200 even on app-level failures; parse the body
  let body: { ok?: boolean; error?: string } = {};
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`Webhook returned non-JSON body: ${text}`);
  }
  if (body.ok === false) {
    throw new Error(`Webhook reported failure: ${body.error ?? text}`);
  }
  console.log(text);
}

main().catch((err) => {
  console.error("qa-sheet-append failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
