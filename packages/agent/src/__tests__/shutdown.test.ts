import { describe, expect, it, vi } from "vitest";
import { createShutdownHandler, type CleanupTask } from "../runtime/shutdown";

function createDeps(overrides: Partial<Parameters<typeof createShutdownHandler>[0]> = {}) {
  const deps = {
    bot: { stop: vi.fn() },
    botMode: "webhook" as const,
    cleanupTasks: [] as CleanupTask[],
    exit: vi.fn(),
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    server: { close: vi.fn().mockResolvedValue(undefined) },
    ...overrides,
  };

  return deps;
}

describe("shutdown handler", () => {
  it("does not stop an unlaunched Telegram bot in webhook mode", async () => {
    const deps = createDeps();
    const shutdown = createShutdownHandler(deps);

    await shutdown("SIGTERM");

    expect(deps.bot.stop).not.toHaveBeenCalled();
    expect(deps.server.close).toHaveBeenCalledTimes(1);
    expect(deps.exit).toHaveBeenCalledWith(0);
    expect(deps.logger.error).not.toHaveBeenCalled();
  });

  it("stops the Telegram bot in polling mode", async () => {
    const deps = createDeps({ botMode: "polling" });
    const shutdown = createShutdownHandler(deps);

    await shutdown("SIGTERM");

    expect(deps.bot.stop).toHaveBeenCalledWith("SIGTERM");
    expect(deps.exit).toHaveBeenCalledWith(0);
  });

  it("logs shutdown cleanup failures without turning SIGTERM into a crash exit", async () => {
    const failingCleanup = vi.fn().mockRejectedValue(new Error("database busy"));
    const laterCleanup = vi.fn();
    const deps = createDeps({
      cleanupTasks: [failingCleanup, laterCleanup],
    });
    const shutdown = createShutdownHandler(deps);

    await shutdown("SIGTERM");

    expect(deps.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ cleanup: "cleanupTasks[0]", signal: "SIGTERM" }),
      "Shutdown cleanup failed"
    );
    expect(failingCleanup).toHaveBeenCalledTimes(1);
    expect(laterCleanup).toHaveBeenCalledTimes(1);
    expect(deps.exit).toHaveBeenCalledWith(0);
  });

  it("preserves non-zero exits for fatal shutdown paths", async () => {
    const cleanupTask = vi.fn();
    const deps = createDeps({
      cleanupTasks: [cleanupTask],
      server: { close: vi.fn().mockRejectedValue(new Error("server close failed")) },
    });
    const shutdown = createShutdownHandler(deps);

    await shutdown("uncaughtException", 1);

    expect(deps.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ cleanup: "server.close", signal: "uncaughtException" }),
      "Shutdown cleanup failed"
    );
    expect(cleanupTask).toHaveBeenCalledTimes(1);
    expect(deps.exit).toHaveBeenCalledWith(1);
  });

  it("runs shutdown only once", async () => {
    let resolveClose: (() => void) | undefined;
    const closePromise = new Promise<void>((resolve) => {
      resolveClose = resolve;
    });
    const deps = createDeps({
      server: { close: vi.fn(() => closePromise) },
    });
    const shutdown = createShutdownHandler(deps);

    const firstShutdown = shutdown("SIGTERM");
    await shutdown("SIGINT");
    resolveClose?.();
    await firstShutdown;

    expect(deps.server.close).toHaveBeenCalledTimes(1);
    expect(deps.logger.warn).toHaveBeenCalledWith(
      { signal: "SIGINT" },
      "Shutdown already in progress"
    );
  });
});
