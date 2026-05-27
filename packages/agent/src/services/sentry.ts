import { sanitizeSentryContext, sanitizeSentryValue } from "@green-goods/shared/sentry-redaction";
import * as Sentry from "@sentry/bun";
import { createLogger } from "./logger";

const log = createLogger("sentry");

export interface InitAgentSentryOptions {
  dsn?: string;
  enabled: boolean;
  environment?: string;
  release?: string;
  tracesSampleRate: number;
  debug?: boolean;
}

export type AgentSentryContext = {
  source?: string;
  surface?: string;
  route?: string;
  method?: string;
  platform?: string;
  contentType?: string;
  commandName?: string;
  durationMs?: number;
  status?: number;
  metadata?: Record<string, unknown>;
};

let initialized = false;

export function initAgentSentry(options: InitAgentSentryOptions): void {
  const dsn = options.dsn?.trim();
  if (!options.enabled || !dsn) {
    initialized = false;
    return;
  }

  Sentry.init({
    dsn,
    environment: options.environment,
    release: options.release,
    sendDefaultPii: false,
    debug: options.debug === true,
    tracesSampleRate: options.tracesSampleRate,
    beforeBreadcrumb: (breadcrumb) =>
      sanitizeSentryValue(breadcrumb) as unknown as typeof breadcrumb,
    beforeSend: (event) => sanitizeSentryValue(event) as unknown as typeof event,
  });

  Sentry.setTag("app", "green-goods");
  Sentry.setTag("surface", "agent");
  initialized = true;
}

export function captureAgentException(error: unknown, context: AgentSentryContext = {}): void {
  if (!initialized) return;

  const normalizedError =
    error instanceof Error ? error : new Error(typeof error === "string" ? error : String(error));

  try {
    Sentry.withScope((scope) => {
      if (context.source) scope.setTag("green_goods.source", context.source);
      if (context.surface) scope.setTag("green_goods.surface", context.surface);
      if (context.route) scope.setTag("green_goods.route", context.route);
      if (context.method) scope.setTag("green_goods.method", context.method);
      if (context.platform) scope.setTag("green_goods.platform", context.platform);
      if (context.contentType) scope.setTag("green_goods.content_type", context.contentType);
      if (context.commandName) scope.setTag("green_goods.command", context.commandName);
      if (context.status !== undefined) {
        scope.setTag("green_goods.status", String(context.status));
      }

      scope.setContext("green_goods_agent", sanitizeSentryContext(context));
      Sentry.captureException(normalizedError);
    });
  } catch (captureError) {
    log.warn({ err: captureError }, "Sentry capture failed");
  }
}

export async function shutdownAgentSentry(): Promise<void> {
  if (!initialized) return;

  try {
    await Sentry.flush(2_000);
  } catch (error) {
    log.warn({ err: error }, "Sentry flush failed");
  } finally {
    initialized = false;
  }
}

export function resetAgentSentryForTests(): void {
  initialized = false;
}
