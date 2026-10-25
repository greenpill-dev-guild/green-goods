import type { Telegraf } from "telegraf";
import { describe, expect, it, vi } from "vitest";
import { registerSlashCommands } from "../platforms/telegram";
import { parseCommand } from "../services/reporting/coordinator/commands";

/** Bot API requests only: no production menu or webhook is modified by these tests. */
function botRecorder() {
  const setMyCommands = vi.fn().mockResolvedValue(true);
  return { bot: { telegram: { setMyCommands } } as unknown as Telegraf, setMyCommands };
}

describe("Telegram private command menus", () => {
  it("keeps the existing legacy menu when the reporting runtime is absent", async () => {
    const { bot, setMyCommands } = botRecorder();
    await registerSlashCommands(bot);
    expect(
      setMyCommands.mock.calls[0]?.[0].map((item: { command: string }) => item.command)
    ).toEqual(["start", "join", "status", "pending", "approve", "reject", "help"]);
  });

  it("shows every reporting command, without promising a custodial wallet during a channel pause", async () => {
    const { bot, setMyCommands } = botRecorder();
    await registerSlashCommands(bot, true);
    expect(setMyCommands.mock.calls[0]?.[0]).toEqual([
      { command: "start", description: "Start or resume Green Goods" },
      { command: "new", description: "Start a new report" },
      { command: "status", description: "Check your progress" },
      { command: "cancel", description: "Cancel the current report" },
      { command: "garden", description: "Change your report's garden" },
      { command: "join", description: "See how to join another garden" },
      { command: "review", description: "Stewards: see work waiting for review" },
      { command: "account", description: "See which account this chat uses" },
      { command: "connect", description: "Connect your account" },
      { command: "switch", description: "Use a different account" },
      { command: "disconnect", description: "Disconnect your account" },
      { command: "language", description: "Change the language" },
      { command: "help", description: "Get help and available commands" },
      { command: "stop", description: "Stop the assistant" },
      { command: "delete", description: "Delete your unpublished data" },
    ]);
  });

  it("offers in every language the same commands, each one the reporting core reads, within the Bot API's limits", async () => {
    const { bot, setMyCommands } = botRecorder();
    await registerSlashCommands(bot, true);
    const menus = setMyCommands.mock.calls
      .slice(0, 3)
      .map((call) => call[0] as Array<{ command: string; description: string }>);
    const [english, ...translated] = menus;
    for (const menu of translated) {
      expect(menu.map((item) => item.command)).toEqual(english?.map((item) => item.command));
      // A description left in English would mean a translation is missing.
      expect(
        menu.filter((item, index) => item.description === english?.[index]?.description)
      ).toEqual([]);
    }
    // At most 100 commands; a name of 1-32 lowercase letters, digits or underscores; a description
    // of 1-256 characters.
    for (const menu of menus) {
      expect(menu.length).toBeLessThanOrEqual(100);
      for (const { command, description } of menu) {
        expect(command).toMatch(/^[a-z0-9_]{1,32}$/);
        expect(description.length).toBeGreaterThanOrEqual(1);
        expect(description.length).toBeLessThanOrEqual(256);
      }
    }
    // A command the core did not read would reach it as HELP.
    expect(english?.filter(({ command }) => parseCommand(command) === null)).toEqual([]);
  });

  it("registers private menus in English, Spanish and Portuguese and keeps groups empty", async () => {
    const { bot, setMyCommands } = botRecorder();
    await registerSlashCommands(bot, true);
    expect(setMyCommands.mock.calls.map((call) => call[1])).toEqual([
      { scope: { type: "all_private_chats" } },
      { scope: { type: "all_private_chats" }, language_code: "es" },
      { scope: { type: "all_private_chats" }, language_code: "pt" },
      { scope: { type: "all_group_chats" } },
    ]);
    expect(setMyCommands.mock.calls[1]?.[0][0].description).toBe("Iniciar o retomar Green Goods");
    expect(setMyCommands.mock.calls[2]?.[0][0].description).toBe("Iniciar ou retomar Green Goods");
    expect(setMyCommands.mock.calls[3]?.[0]).toEqual([]);
  });

  it("surfaces Bot API failure so startup can report that menu registration is pending", async () => {
    const { bot, setMyCommands } = botRecorder();
    setMyCommands.mockRejectedValueOnce(new Error("Bot API unavailable"));
    await expect(registerSlashCommands(bot, true)).rejects.toThrow("Bot API unavailable");
    expect(setMyCommands).toHaveBeenCalledTimes(1);
  });
});
