/**
 * Centralized logging utility for Green Goods client
 *
 * Purpose: Provides controlled logging with dev/prod awareness
 * Side-effects: Writes to console in development, silent or uses external service in production
 *
 * Design Notes:
 * - Respects IS_DEV flag to prevent production console pollution
 * - Supports structured logging with context
 * - Can be extended to integrate with error tracking services (Sentry, etc.)
 * - Prefixes help identify source of logs during debugging
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LogContext = Record<string, any>;

const IS_DEV = import.meta.env.DEV;
const IS_DEBUG = import.meta.env.VITE_DEBUG === "true";

/**
 * Format a log message with optional context
 */
function formatMessage(prefix: string, message: string, context?: LogContext): string {
  if (context) {
    return `${prefix} ${message}`;
  }
  return `${prefix} ${message}`;
}

/**
 * Log debug information (only in debug mode)
 */
export function debug(message: string, context?: LogContext): void {
  if (IS_DEBUG) {
    // eslint-disable-next-line no-console
    console.log(formatMessage("[DEBUG]", message, context));
  }
}

/**
 * Log informational messages (dev only)
 */
export function log(message: string, context?: LogContext): void {
  if (IS_DEV) {
    // eslint-disable-next-line no-console
    console.log(formatMessage("[INFO]", message, context));
  }
}

/**
 * Log warnings (always shown)
 */
export function warn(message: string, context?: LogContext): void {
  // eslint-disable-next-line no-console
  console.warn(formatMessage("[WARN]", message, context));
}

/**
 * Log errors (always shown)
 * In production, this could integrate with error tracking services
 */
export function error(message: string, err?: Error | unknown, context?: LogContext): void {
  const errorContext = {
    ...context,
    error:
      err instanceof Error
        ? {
            name: err.name,
            message: err.message,
            stack: IS_DEV ? err.stack : undefined,
          }
        : err,
  };

  // eslint-disable-next-line no-console
  console.error(formatMessage("[ERROR]", message, errorContext));

  // TODO: In production, send to error tracking service (e.g., Sentry)
  // if (!IS_DEV && window.Sentry) {
  //   window.Sentry.captureException(err, { extra: context });
  // }
}

/**
 * Create a namespaced logger with a consistent prefix
 * Useful for identifying logs from specific modules
 *
 * @example
 * const logger = createLogger('Auth');
 * logger.log('User logged in'); // outputs: [Auth] User logged in
 */
export function createLogger(namespace: string) {
  return {
    debug: (message: string, context?: LogContext) => debug(`[${namespace}] ${message}`, context),
    log: (message: string, context?: LogContext) => log(`[${namespace}] ${message}`, context),
    warn: (message: string, context?: LogContext) => warn(`[${namespace}] ${message}`, context),
    error: (message: string, err?: Error | unknown, context?: LogContext) =>
      error(`[${namespace}] ${message}`, err, context),
  };
}

/**
 * Default logger instance
 */
const logger = {
  debug,
  log,
  warn,
  error,
  createLogger,
};

export default logger;
