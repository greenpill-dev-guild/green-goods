import * as Sentry from "@sentry/react";
import {
  registerExternalErrorReporter,
  type ExternalErrorReporterContext,
} from "./external-error-reporters";
import { classifyExternalError, externalErrorTags } from "./external-errors";
import { isReportingCeremonyPath } from "./private-paths";
import {
  createSentryDataCollection,
  sanitizeSentryContext,
  sanitizeSentryValue,
} from "./sentry-redaction";
import {
  getTelemetryEnvironment,
  getTelemetryRelease,
  getTelemetrySurface,
} from "./telemetry-context";

export type BrowserSentrySurface = "client" | "admin";

export interface InitBrowserSentryOptions {
  dsn?: string;
  surface: BrowserSentrySurface;
  /** Defaults to the environment and release PostHog events carry (PRD-1560). */
  environment?: string;
  release?: string;
  enabled?: boolean;
  debug?: boolean;
  tracesSampleRate?: number;
}

let initialized = false;
let unregisterReporter: (() => void) | null = null;

export function initBrowserSentry(options: InitBrowserSentryOptions): () => void {
  const dsn = options.dsn?.trim();
  if (options.enabled === false || !dsn) {
    return () => {};
  }

  if (initialized) {
    return cleanupBrowserSentryReporter;
  }

  Sentry.init({
    dsn,
    environment: options.environment ?? knownOrUndefined(getTelemetryEnvironment()),
    release: options.release ?? knownOrUndefined(getTelemetryRelease()),
    dataCollection: createSentryDataCollection(),
    traceLifecycle: "static",
    debug: options.debug === true,
    tracesSampleRate: options.tracesSampleRate ?? 0.05,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        blockAllMedia: true,
        maskAllText: true,
        // Reporting ceremony pages are never recorded, even masked.
        beforeAddRecordingEvent: (event) =>
          isReportingCeremonyPath(window.location.pathname) ? null : event,
      }),
    ],
    beforeBreadcrumb: (breadcrumb) =>
      sanitizeSentryValue(breadcrumb) as unknown as typeof breadcrumb,
    beforeSend: (event) => sanitizeSentryValue(tagExternalError(event)) as unknown as typeof event,
    beforeSendTransaction: (event) => sanitizeSentryValue(event) as unknown as typeof event,
  });

  Sentry.setTag("app", "green-goods");
  Sentry.setTag("surface", options.surface);
  // The name PostHog events use, so one filter reads both (PRD-1560).
  Sentry.setTag("app_surface", getTelemetrySurface());

  // The report's id comes back as PostHog's `sentry_event_id` on error_tracked (PRD-1561).
  unregisterReporter = registerExternalErrorReporter((error, context) =>
    captureBrowserException(error, {
      ...context,
      metadata: {
        ...context.metadata,
        surface: options.surface,
      },
    })
  );
  initialized = true;

  return cleanupBrowserSentryReporter;
}

function knownOrUndefined(value: string): string | undefined {
  return value === "unknown" ? undefined : value;
}

/**
 * Tag WalletConnect relay and beta toolbar errors as external. A relay reconnect that nothing of
 * ours handled drops to a warning; see `external-errors`.
 */
export function tagExternalError(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  const values = event.exception?.values ?? [];
  const external = classifyExternalError({
    messages: values.map((value) => value.value),
    locations: values.flatMap((value) =>
      (value.stacktrace?.frames ?? []).flatMap((frame) => [frame.abs_path, frame.filename])
    ),
  });
  if (!external) return event;
  const unhandled = values.some((value) => value.mechanism?.handled === false);
  return {
    ...event,
    tags: { ...event.tags, ...externalErrorTags(external) },
    ...(external.recoverable && unhandled ? { level: "warning" as const } : {}),
  };
}

/** Files the error with Sentry and returns the id of that report, never an earlier one. */
function captureBrowserException(
  error: unknown,
  context: ExternalErrorReporterContext = {}
): string | undefined {
  if (!initialized) return undefined;

  const normalizedError =
    error instanceof Error ? error : new Error(typeof error === "string" ? error : String(error));

  let eventId: string | undefined;
  Sentry.withScope((scope) => {
    if (context.severity) scope.setLevel(context.severity);
    if (context.category) scope.setTag("green_goods.category", context.category);
    if (context.source) scope.setTag("green_goods.source", context.source);
    if (context.recoverable !== undefined) {
      scope.setTag("green_goods.recoverable", String(context.recoverable));
    }
    if (context.fingerprint) scope.setFingerprint([context.fingerprint]);

    scope.setContext("green_goods_error", sanitizeSentryContext(context));
    eventId = Sentry.captureException(normalizedError);
  });
  return eventId;
}

function cleanupBrowserSentryReporter(): void {
  unregisterReporter?.();
  unregisterReporter = null;
  initialized = false;
}
