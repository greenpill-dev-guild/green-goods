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
  /**
   * Synchronous steps that stop background work from claiming anything new. They run first, so
   * no new work starts while the server and the other cleanup tasks are still being awaited.
   */
  quiesce?: Array<() => void>;
  cleanupTasks: CleanupTask[];
  exit: (code: number) => void;
  logger: ShutdownLogger;
  server: ClosableServer;
}

export function createShutdownHandler({
  bot,
  botMode,
  quiesce = [],
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

    const logCleanupFailure = (cleanup: string, error: unknown) => {
      logger.error({ cleanup, err: error, signal }, "Shutdown cleanup failed");
    };

    for (const [index, step] of quiesce.entries()) {
      try {
        step();
      } catch (error) {
        logCleanupFailure(`quiesce[${index}]`, error);
      }
    }

    if (botMode === "polling") {
      try {
        bot.stop(signal);
      } catch (error) {
        logger.warn({ err: error, signal }, "Telegram bot stop failed during shutdown");
      }
    }

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
