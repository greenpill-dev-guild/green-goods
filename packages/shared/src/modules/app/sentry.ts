import * as Sentry from "@sentry/react";
import {
  registerExternalErrorReporter,
  type ExternalErrorReporterContext,
} from "./external-error-reporters";
import { sanitizeSentryContext, sanitizeSentryValue } from "./sentry-redaction";

export type BrowserSentrySurface = "client" | "admin";

export interface InitBrowserSentryOptions {
  dsn?: string;
  surface: BrowserSentrySurface;
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
    environment: options.environment,
    release: options.release,
    sendDefaultPii: false,
    debug: options.debug === true,
    tracesSampleRate: options.tracesSampleRate ?? 0.05,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        blockAllMedia: true,
        maskAllText: true,
      }),
    ],
    beforeBreadcrumb: (breadcrumb) =>
      sanitizeSentryValue(breadcrumb) as unknown as typeof breadcrumb,
    beforeSend: (event) => sanitizeSentryValue(event) as unknown as typeof event,
  });

  Sentry.setTag("app", "green-goods");
  Sentry.setTag("surface", options.surface);

  unregisterReporter = registerExternalErrorReporter((error, context) => {
    captureBrowserException(error, {
      ...context,
      metadata: {
        ...context.metadata,
        surface: options.surface,
      },
    });
  });
  initialized = true;

  return cleanupBrowserSentryReporter;
}

export function captureBrowserException(
  error: unknown,
  context: ExternalErrorReporterContext = {}
): void {
  if (!initialized) return;

  const normalizedError =
    error instanceof Error ? error : new Error(typeof error === "string" ? error : String(error));

  Sentry.withScope((scope) => {
    if (context.severity) scope.setLevel(context.severity);
    if (context.category) scope.setTag("green_goods.category", context.category);
    if (context.source) scope.setTag("green_goods.source", context.source);
    if (context.recoverable !== undefined) {
      scope.setTag("green_goods.recoverable", String(context.recoverable));
    }
    if (context.fingerprint) scope.setFingerprint([context.fingerprint]);

    scope.setContext("green_goods_error", sanitizeSentryContext(context));
    Sentry.captureException(normalizedError);
  });
}

export function resetBrowserSentryForTests(): void {
  cleanupBrowserSentryReporter();
}

function cleanupBrowserSentryReporter(): void {
  unregisterReporter?.();
  unregisterReporter = null;
  initialized = false;
}
