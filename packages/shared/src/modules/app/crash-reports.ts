/**
 * Crash reports that outlive the crash.
 *
 * A crash screen often shows before analytics has loaded, or with no connection, and the
 * transport's own retry queue lives in memory, so a reload loses what it held. A report is written
 * to this device when the crash happens and handed over once a transport is connected and the
 * device is online: later in the same visit, or on the next start. It keeps the time it happened.
 *
 * @module modules/app/crash-reports
 */

import { logger } from "./logger";
import { enrichEventProperties } from "./posthog";
import { redactPrivatePaths } from "./private-paths";
import { getTelemetrySink, isTelemetryReady } from "./telemetry-sink";

const STORAGE_KEY = "gg-crash-reports";
/** A crash that repeats on every start must not fill the device or flood the project. */
const MAX_REPORTS = 10;
/** Older than this, a report says nothing about the build people run now. */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_STACK_LENGTH = 4000;

export interface CrashReport {
  /** A UUID. It is also the delivered event's id, so two tabs sending it count once. */
  id: string;
  /** Epoch milliseconds at the crash. */
  occurredAt: number;
  /** The `error_tracked` properties, complete as of the crash. */
  properties: Record<string, unknown>;
  error: { name: string; message: string; stack?: string };
}

/** Reports this page could not write to storage. They are still sent if a transport connects. */
let unsaved: CrashReport[] = [];
/** A report is sent once per page, even when it could not be removed from storage. */
const delivered = new Set<string>();

function keep(reports: CrashReport[]): void {
  const kept = [...readStored(), ...reports].slice(-MAX_REPORTS);
  if (!writeStored(kept)) unsaved = [...unsaved, ...reports].slice(-MAX_REPORTS);
}

function capped(value: unknown): unknown {
  return typeof value === "string" ? value.slice(0, MAX_STACK_LENGTH) : value;
}

function storage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    // Storage can be blocked outright; the report then lives only for this page.
    return undefined;
  }
}

function isCrashReport(value: unknown): value is CrashReport {
  if (!value || typeof value !== "object") return false;
  const report = value as Partial<CrashReport>;
  return (
    typeof report.id === "string" &&
    typeof report.occurredAt === "number" &&
    Number.isFinite(report.occurredAt) &&
    typeof report.properties === "object" &&
    report.properties !== null &&
    typeof report.error === "object" &&
    report.error !== null &&
    typeof report.error.name === "string" &&
    typeof report.error.message === "string" &&
    (report.error.stack === undefined || typeof report.error.stack === "string")
  );
}

/** Stored reports that still parse. Anything else in the key is dropped, not trusted. */
function readStored(): CrashReport[] {
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isCrashReport) : [];
  } catch {
    return [];
  }
}

function writeStored(reports: CrashReport[]): boolean {
  const target = storage();
  if (!target) return false;
  try {
    if (reports.length === 0) target.removeItem(STORAGE_KEY);
    // A reporting ceremony link must never rest on the device in a crash report.
    else target.setItem(STORAGE_KEY, redactPrivatePaths(JSON.stringify(reports)));
    return true;
  } catch {
    // Quota or a blocked write.
    return false;
  }
}

/**
 * A version 4 UUID. The transport only honours an event id that is one, and `randomUUID` exists
 * only on secure origins, so a plain-http origin (a device on the local network) builds it from
 * random bytes instead.
 */
function reportId(): string {
  if (typeof crypto === "undefined")
    return `crash-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Keep a crash until it can be sent, and send it now if it can be.
 *
 * `properties` are the `error_tracked` properties and `error` the error they describe, both
 * already redacted by the caller.
 */
export function recordCrash(error: Error, properties: Record<string, unknown>): void {
  const report: CrashReport = {
    id: reportId(),
    occurredAt: Date.now(),
    properties: enrichEventProperties("error_tracked", {
      ...properties,
      error_stack: capped(properties.error_stack),
      // PostHog stamps the page an event is sent from. Sent on a later start, that is no longer
      // the page that crashed, and the query string and fragment can carry what must not be kept.
      crash_path:
        typeof window === "undefined" ? undefined : redactPrivatePaths(window.location.pathname),
    }),
    error: {
      name: error.name || "Error",
      message: error.message,
      stack: error.stack?.slice(0, MAX_STACK_LENGTH),
    },
  };

  keep([report]);
  flushCrashReports();
}

function toError(report: CrashReport): Error {
  const error = new Error(report.error.message);
  error.name = report.error.name;
  if (report.error.stack) error.stack = report.error.stack;
  return error;
}

/**
 * Send every kept crash, if a transport is connected and the device is online. Called when the
 * transport connects and whenever the connection returns; otherwise it does nothing and the
 * reports wait.
 */
export function flushCrashReports(): void {
  if (!isTelemetryReady()) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;

  const stored = readStored();
  const reports = [...stored, ...unsaved].filter((report) => !delivered.has(report.id));
  if (reports.length === 0) return;

  // Taken out of storage before sending, so a second tab flushing at the same moment finds
  // nothing to send. Only what was read above is taken, from a fresh read: another tab may have
  // kept a crash of its own since, and emptying the key would lose it.
  if (stored.length > 0) {
    const taken = new Set(stored.map((report) => report.id));
    writeStored(readStored().filter((report) => !taken.has(report.id)));
  }
  unsaved = [];

  const now = Date.now();
  const sink = getTelemetrySink();
  const refused: CrashReport[] = [];
  for (const report of reports) {
    if (now - report.occurredAt > MAX_AGE_MS) continue;

    const delay = { crash_report_id: report.id, delivery_delay_ms: now - report.occurredAt };
    try {
      // As it was recorded: the properties are not enriched again, and it keeps its own time.
      sink.capture(
        "error_tracked",
        { ...report.properties, ...delay },
        { timestamp: new Date(report.occurredAt), uuid: report.id }
      );
    } catch {
      refused.push(report);
      continue;
    }
    delivered.add(report.id);

    // Error Tracking takes the error itself. It stamps the delivery time, so the time of the
    // crash travels as a property.
    const { properties } = report;
    try {
      sink.captureException?.(toError(report), {
        ...delay,
        crash_occurred_at: new Date(report.occurredAt).toISOString(),
        crash_path: properties.crash_path,
        source: properties.source,
        category: properties.category,
        severity: properties.severity,
        is_offline: properties.is_offline,
        app_version: properties.app_version,
        environment: properties.environment,
        chain_id: properties.chain_id,
        error_fingerprint: properties.error_fingerprint,
        component_stack: properties.component_stack,
      });
    } catch (error) {
      // The event above already carries the report; a second copy is not worth a retry.
      logger.warn("[CrashReports] The error could not be filed with error tracking", {
        error: String(error),
      });
    }
  }

  if (refused.length > 0) {
    // The transport took none of these; they wait for the next connection or the next start.
    logger.warn("[CrashReports] Kept crash reports could not be delivered", {
      count: refused.length,
    });
    keep(refused);
  }
}
