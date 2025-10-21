type DebugContext = Record<string, unknown> | undefined;

export const DEBUG_ENABLED = import.meta.env.VITE_DEBUG_MODE === "true";
const PREFIX = "[debug]";

function print<Message extends string>(
  method: "log" | "warn" | "error",
  message: Message,
  context?: DebugContext
) {
  if (!DEBUG_ENABLED) return;
  if (context !== undefined) {
    console[method](`${PREFIX} ${message}`, context);
  } else {
    console[method](`${PREFIX} ${message}`);
  }
}

export function debugLog(message: string, context?: DebugContext) {
  print("log", message, context);
}

export function debugWarn(message: string, context?: DebugContext) {
  print("warn", message, context);
}

export function debugError(message: string, error?: unknown, context?: DebugContext) {
  if (!DEBUG_ENABLED) return;
  const errorContext =
    error instanceof Error
      ? {
          ...context,
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        }
      : { ...context, error };

  print("error", message, errorContext);
}
