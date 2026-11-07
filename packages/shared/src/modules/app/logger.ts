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
 * Serialize a log entry as one line of JSON for log aggregation.
 * `JSON.stringify` throws on a bigint or a cycle, which turns a log call into a throw at its
 * call site. Contexts carry bigints (viem receipts and amounts, and the call args a viem
 * contract error keeps), so a bigint is written as its decimal string and a reference back
 * to an enclosing object as "[Circular]". Every other value serializes as before.
 */
function serializeLogEntry(contextObj: Record<string, unknown>): string {
  // The objects on the path from the entry down to the value being written.
  const ancestors: unknown[] = [];
  return JSON.stringify(contextObj, function (this: unknown, _key: string, value: unknown) {
    if (typeof value === "bigint") return value.toString();
    if (typeof value !== "object" || value === null) return value;
    // `this` holds `value`, so anything above it on the path belongs to a finished branch.
    while (ancestors.length > 0 && ancestors[ancestors.length - 1] !== this) ancestors.pop();
    if (ancestors.includes(value)) return "[Circular]";
    ancestors.push(value);
    return value;
  });
}

/**
 * Check if we're in development mode
 */
function isDevelopment(): boolean {
  try {
    // Vite environment. Spelled `import.meta.env` so Vitest's env stubs reach it; DEV is
    // widened because the Agent compiles this file with Bun's types, where it is a string.
    return (import.meta.env?.DEV as unknown) === true;
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
      console.error(serializeLogEntry(contextObj));
    }
  },

  warn(message: string, context?: LogContext): void {
    const { formatted, contextObj } = formatLogEntry("warn", message, context);
    if (isDevelopment()) {
      console.warn(formatted, contextObj);
    } else {
      console.warn(serializeLogEntry(contextObj));
    }
  },

  info(message: string, context?: LogContext): void {
    const { formatted, contextObj } = formatLogEntry("info", message, context);
    if (isDevelopment()) {
      console.info(formatted, contextObj);
    } else {
      console.info(serializeLogEntry(contextObj));
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
