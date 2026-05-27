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

export type ExternalErrorReporter = (error: Error, context: ExternalErrorReporterContext) => void;

const reporters = new Set<ExternalErrorReporter>();

export function registerExternalErrorReporter(reporter: ExternalErrorReporter): () => void {
  reporters.add(reporter);
  return () => {
    reporters.delete(reporter);
  };
}

export function captureExternalError(error: Error, context: ExternalErrorReporterContext): void {
  for (const reporter of reporters) {
    try {
      reporter(error, context);
    } catch {
      // External reporters must never break the existing PostHog error path.
    }
  }
}
