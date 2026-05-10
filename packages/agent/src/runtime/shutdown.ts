import type { BotMode } from "../config";

type ShutdownLogger = {
  info: (objOrMessage?: unknown, message?: string) => void;
  warn: (objOrMessage?: unknown, message?: string) => void;
  error: (objOrMessage?: unknown, message?: string) => void;
};

type StoppableBot = {
  stop: (reason?: string) => void;
};

type ClosableServer = {
  close: () => Promise<void>;
};

export type CleanupTask = () => void | Promise<void>;

export type ShutdownHandler = (signal: string, exitCode?: number) => Promise<void>;

export interface ShutdownDeps {
  bot: StoppableBot;
  botMode: BotMode;
  cleanupTasks: CleanupTask[];
  exit: (code: number) => void;
  logger: ShutdownLogger;
  server: ClosableServer;
}

export function createShutdownHandler({
  bot,
  botMode,
  cleanupTasks,
  exit,
  logger,
  server,
}: ShutdownDeps): ShutdownHandler {
  let shuttingDown = false;

  return async function shutdown(signal: string, exitCode = 0): Promise<void> {
    if (shuttingDown) {
      logger.warn({ signal }, "Shutdown already in progress");
      return;
    }

    shuttingDown = true;
    logger.info({ signal }, "Shutting down gracefully");

    if (botMode === "polling") {
      try {
        bot.stop(signal);
      } catch (error) {
        logger.warn({ err: error, signal }, "Telegram bot stop failed during shutdown");
      }
    }

    const logCleanupFailure = (cleanup: string, error: unknown) => {
      logger.error({ cleanup, err: error, signal }, "Shutdown cleanup failed");
    };

    try {
      await server.close();
    } catch (error) {
      logCleanupFailure("server.close", error);
    }

    for (const [index, cleanupTask] of cleanupTasks.entries()) {
      try {
        await cleanupTask();
      } catch (error) {
        logCleanupFailure(`cleanupTasks[${index}]`, error);
      }
    }

    logger.info("Agent shutdown complete");
    exit(exitCode);
  };
}
