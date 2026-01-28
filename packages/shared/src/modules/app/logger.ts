/**
 * Structured Logger
 *
 * Provides a centralized logging interface that outputs structured logs
 * with correlation IDs and contextual data. In production, this can be
 * extended to forward logs to monitoring services.
 *
 * @module modules/app/logger
 */

export interface LogContext {
  /** Unique identifier to trace related log entries */
  correlationId?: string;
  /** Source module/function generating the log */
  source?: string;
  /** Additional contextual data */
  [key: string]: unknown;
}

export interface Logger {
  error(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
}

/**
 * Generate a simple correlation ID for log tracing.
 * In production, this could be replaced with a proper UUID or
 * propagated from an incoming request context.
 */
function generateCorrelationId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Format a structured log entry for console output.
 * Includes timestamp, level, message, and flattened context.
 */
function formatLogEntry(
  level: string,
  message: string,
  context?: LogContext
): { formatted: string; contextObj: Record<string, unknown> } {
  const timestamp = new Date().toISOString();
  const correlationId = context?.correlationId ?? generateCorrelationId();

  const contextObj: Record<string, unknown> = {
    timestamp,
    level,
    correlationId,
    message,
    ...context,
  };

  // Remove undefined values for cleaner output
  for (const key of Object.keys(contextObj)) {
    if (contextObj[key] === undefined) {
      delete contextObj[key];
    }
  }

  return {
    formatted: `[${timestamp}] [${level.toUpperCase()}] ${message}`,
    contextObj,
  };
}

/**
 * Check if we're in development mode
 */
function isDevelopment(): boolean {
  try {
    // Vite environment
    return (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;
  } catch {
    // Node.js or unknown environment
    return process.env.NODE_ENV !== "production";
  }
}

/**
 * Default logger implementation that outputs structured logs to the console.
 * In development, uses console methods for better DevTools integration.
 * In production, outputs JSON for log aggregation systems.
 */
export const logger: Logger = {
  error(message: string, context?: LogContext): void {
    const { formatted, contextObj } = formatLogEntry("error", message, context);
    if (isDevelopment()) {
      console.error(formatted, contextObj);
    } else {
      // Production: output as JSON for log aggregation
      console.error(JSON.stringify(contextObj));
    }
  },

  warn(message: string, context?: LogContext): void {
    const { formatted, contextObj } = formatLogEntry("warn", message, context);
    if (isDevelopment()) {
      console.warn(formatted, contextObj);
    } else {
      console.warn(JSON.stringify(contextObj));
    }
  },

  info(message: string, context?: LogContext): void {
    const { formatted, contextObj } = formatLogEntry("info", message, context);
    if (isDevelopment()) {
      console.info(formatted, contextObj);
    } else {
      console.info(JSON.stringify(contextObj));
    }
  },

  debug(message: string, context?: LogContext): void {
    // Only output debug logs in development
    if (!isDevelopment()) return;

    const { formatted, contextObj } = formatLogEntry("debug", message, context);
    console.debug(formatted, contextObj);
  },
};

/**
 * Create a child logger with preset context that will be included
 * in all log entries. Useful for module-specific logging.
 *
 * @example
 * ```typescript
 * const moduleLogger = createLogger({ source: "hypercerts/merkle" });
 * moduleLogger.error("Failed to generate proof", { address: "0x..." });
 * // Output includes both source and address in context
 * ```
 */
export function createLogger(defaultContext: LogContext): Logger {
  return {
    error(message: string, context?: LogContext): void {
      logger.error(message, { ...defaultContext, ...context });
    },
    warn(message: string, context?: LogContext): void {
      logger.warn(message, { ...defaultContext, ...context });
    },
    info(message: string, context?: LogContext): void {
      logger.info(message, { ...defaultContext, ...context });
    },
    debug(message: string, context?: LogContext): void {
      logger.debug(message, { ...defaultContext, ...context });
    },
  };
}
