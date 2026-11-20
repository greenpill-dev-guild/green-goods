export type ExternalErrorReporterContext = {
  severity?: "fatal" | "error" | "warning" | "info";
  category?: string;
  source?: string;
  userAction?: string;
  gardenAddress?: string;
  txHash?: string;
  authMode?: string | null;
  isOffline?: boolean;
  recoverable?: boolean;
  fingerprint?: string;
  metadata?: Record<string, unknown>;
};

/** Files an error elsewhere; hands back the id of the report it filed, if it filed one. */
export type ExternalErrorReporter = (
  error: Error,
  context: ExternalErrorReporterContext
) => string | undefined | void;

const reporters = new Set<ExternalErrorReporter>();

export function registerExternalErrorReporter(reporter: ExternalErrorReporter): () => void {
  reporters.add(reporter);
  return () => {
    reporters.delete(reporter);
  };
}

/** Hands the error to every reporter; returns the first report id one of them filed. */
export function captureExternalError(
  error: Error,
  context: ExternalErrorReporterContext
): string | undefined {
  let reportId: string | undefined;
  for (const reporter of reporters) {
    try {
      const id = reporter(error, context);
      if (typeof id === "string" && id && !reportId) reportId = id;
    } catch {
      // External reporters must never break the existing PostHog error path.
    }
  }
  return reportId;
}
