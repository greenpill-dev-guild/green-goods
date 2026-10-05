import type { Telegraf } from "telegraf";
import { describe, expect, it, vi } from "vitest";
import { registerSlashCommands } from "../platforms/telegram";

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

  it("shows reporting commands compatible with a later channel pause, without promising a custodial wallet", async () => {
    const { bot, setMyCommands } = botRecorder();
    await registerSlashCommands(bot, true);
    expect(setMyCommands.mock.calls[0]?.[0]).toEqual([
      { command: "start", description: "Start or resume Green Goods" },
      { command: "connect", description: "Connect your account" },
      { command: "switch", description: "Use a different account" },
      { command: "disconnect", description: "Disconnect your account" },
      { command: "status", description: "Check your progress" },
      { command: "help", description: "Get help and available commands" },
    ]);
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
