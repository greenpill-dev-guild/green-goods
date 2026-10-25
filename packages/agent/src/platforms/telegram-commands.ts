import type { Telegraf } from "telegraf";
import type { AgentLocale } from "../i18n";

/**
 * The reporting chat's private command menu, in the order a person meets the commands: reporting,
 * then the account, then help and the privacy controls. Each is a command the reporting core reads,
 * so no entry falls back to HELP. Names stay English in every language, as the chat's typed command
 * words do; only the descriptions are translated. The menu stays up during a channel pause, when
 * the legacy bot answers private chats: it knows START, STATUS and HELP, and no description here
 * promises the wallet its START creates.
 */
const REPORTING_MENU = [
  "start",
  "new",
  "status",
  "cancel",
  "garden",
  "join",
  "review",
  "account",
  "connect",
  "switch",
  "disconnect",
  "language",
  "help",
  "stop",
  "delete",
] as const;

type MenuCommand = (typeof REPORTING_MENU)[number];

// Telegram allows 1-256 characters for a description; these stay short enough to read at a glance.
const MENU_DESCRIPTIONS: Record<AgentLocale, Record<MenuCommand, string>> = {
  en: {
    start: "Start or resume Green Goods",
    new: "Start a new report",
    status: "Check your progress",
    cancel: "Cancel the current report",
    garden: "Change your report's garden",
    join: "See how to join another garden",
    review: "Stewards: see work waiting for review",
    account: "See which account this chat uses",
    connect: "Connect your account",
    switch: "Use a different account",
    disconnect: "Disconnect your account",
    language: "Change the language",
    help: "Get help and available commands",
    stop: "Stop the assistant",
    delete: "Delete your unpublished data",
  },
  es: {
    start: "Iniciar o retomar Green Goods",
    new: "Empezar un reporte nuevo",
    status: "Consultar tu progreso",
    cancel: "Cancelar el reporte actual",
    garden: "Cambiar el jardín de tu reporte",
    join: "Ver cómo unirte a otro jardín",
    review: "Responsables: ver trabajos pendientes de revisión",
    account: "Ver qué cuenta usa este chat",
    connect: "Conectar tu cuenta",
    switch: "Usar otra cuenta",
    disconnect: "Desconectar tu cuenta",
    language: "Cambiar el idioma",
    help: "Ver ayuda y comandos disponibles",
    stop: "Detener el asistente",
    delete: "Borrar tus datos no publicados",
  },
  pt: {
    start: "Iniciar ou retomar Green Goods",
    new: "Começar um relato novo",
    status: "Consultar seu progresso",
    cancel: "Cancelar o relato atual",
    garden: "Trocar o jardim do seu relato",
    join: "Ver como entrar em outro jardim",
    review: "Responsáveis: ver trabalhos aguardando revisão",
    account: "Ver qual conta este chat usa",
    connect: "Conectar sua conta",
    switch: "Usar outra conta",
    disconnect: "Desconectar sua conta",
    language: "Mudar o idioma",
    help: "Ver ajuda e comandos disponíveis",
    stop: "Parar o assistente",
    delete: "Apagar seus dados não publicados",
  },
};

function reportingMenu(locale: AgentLocale): Array<{ command: string; description: string }> {
  return REPORTING_MENU.map((command) => ({
    command,
    description: MENU_DESCRIPTIONS[locale][command],
  }));
}

export async function registerTelegramCommands(
  bot: Telegraf,
  reportingAvailable: boolean,
  legacyCommands: (locale: AgentLocale) => Array<{ command: string; description: string }>
): Promise<void> {
  const scope = { type: "all_private_chats" } as const;
  for (const locale of ["en", "es", "pt"] as const) {
    const language = locale === "en" ? {} : { language_code: locale };
    await bot.telegram.setMyCommands(
      reportingAvailable ? reportingMenu(locale) : legacyCommands(locale),
      { scope, ...language }
    );
  }
  // Explicitly clear the group autocomplete menu so retired /bug + /idea
  // commands and any historical state are removed.
  await bot.telegram.setMyCommands([], { scope: { type: "all_group_chats" } });
}
