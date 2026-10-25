/**
 * The chat channels reports can arrive on. A provider realm names its channel before the colon
 * (`whatsapp:<phone-number-id>`, `telegram:<bot-id>`). Each channel has an adapter in the runtime,
 * available when this Agent has the channel's credentials, and an operator control,
 * `channel_<name>`. Telegram starts enabled for new reporting databases; WhatsApp starts off.
 * A channel takes reports only while its persisted operator control is on.
 */
export const REPORTING_CHANNELS = ["whatsapp", "telegram"] as const;

export type ReportingChannel = (typeof REPORTING_CHANNELS)[number];

export type ChannelControl = `channel_${ReportingChannel}`;

export function channelControl(channel: ReportingChannel): ChannelControl {
  return `channel_${channel}`;
}

export function channelOfRealm(providerRealm: string): ReportingChannel | null {
  const prefix = providerRealm.slice(0, providerRealm.indexOf(":"));
  return (REPORTING_CHANNELS as readonly string[]).includes(prefix)
    ? (prefix as ReportingChannel)
    : null;
}

/**
 * Whether a channel draws a question's choices as buttons. Where it does, a reply is a tap and no
 * code needs typing; a channel that sends plain text keeps the code in its questions.
 */
export function drawsChoiceButtons(providerRealm: string): boolean {
  return channelOfRealm(providerRealm) === "telegram";
}

/** The bots whose reporting command menu this process has registered. */
const registeredMenus = new Set<string>();

/** Called once a bot's reporting command menu is registered, so replies may point to it. */
export function recordCommandMenu(providerRealm: string): void {
  registeredMenus.add(providerRealm);
}

/**
 * Whether a channel lists the bot's commands in a menu beside the message box, so a reply there
 * can point to the menu instead of only naming words to type. Telegram does once this process has
 * registered the menu. Startup carries on when registering fails, and the bot then shows no menu
 * or an older one without the newer commands, so replies name only the words.
 */
export function offersCommandMenu(providerRealm: string): boolean {
  return channelOfRealm(providerRealm) === "telegram" && registeredMenus.has(providerRealm);
}
