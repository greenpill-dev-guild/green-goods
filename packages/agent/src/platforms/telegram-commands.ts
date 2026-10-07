import type { Telegraf } from "telegraf";
import type { AgentLocale } from "../i18n";

// START, STATUS and HELP work in both reporting and legacy mode. The account commands are
// reporting's own: they are in the menu so linking, switching and unlinking an account is one tap,
// and a chat that reaches the legacy bot during a channel pause gets its help reply for them.
// HELP and chat buttons teach NEW/REVIEW/PAIR.
const REPORTING_DM_COMMANDS: Record<
  AgentLocale,
  Array<{ command: string; description: string }>
> = {
  en: [
    { command: "start", description: "Start or resume Green Goods" },
    { command: "connect", description: "Connect your account" },
    { command: "switch", description: "Use a different account" },
    { command: "disconnect", description: "Disconnect your account" },
    { command: "status", description: "Check your progress" },
    { command: "help", description: "Get help and available commands" },
  ],
  es: [
    { command: "start", description: "Iniciar o retomar Green Goods" },
    { command: "connect", description: "Conectar tu cuenta" },
    { command: "switch", description: "Usar otra cuenta" },
    { command: "disconnect", description: "Desconectar tu cuenta" },
    { command: "status", description: "Consultar tu progreso" },
    { command: "help", description: "Ver ayuda y comandos disponibles" },
  ],
  pt: [
    { command: "start", description: "Iniciar ou retomar Green Goods" },
    { command: "connect", description: "Conectar sua conta" },
    { command: "switch", description: "Usar outra conta" },
    { command: "disconnect", description: "Desconectar sua conta" },
    { command: "status", description: "Consultar seu progresso" },
    { command: "help", description: "Ver ajuda e comandos disponíveis" },
  ],
};

export async function registerTelegramCommands(
  bot: Telegraf,
  reportingAvailable: boolean,
  legacyCommands: (locale: AgentLocale) => Array<{ command: string; description: string }>
): Promise<void> {
  const scope = { type: "all_private_chats" } as const;
  for (const locale of ["en", "es", "pt"] as const) {
    const language = locale === "en" ? {} : { language_code: locale };
    await bot.telegram.setMyCommands(
      reportingAvailable ? REPORTING_DM_COMMANDS[locale] : legacyCommands(locale),
      { scope, ...language }
    );
  }
  // Explicitly clear the group autocomplete menu so retired /bug + /idea
  // commands and any historical state are removed.
  await bot.telegram.setMyCommands([], { scope: { type: "all_group_chats" } });
}
