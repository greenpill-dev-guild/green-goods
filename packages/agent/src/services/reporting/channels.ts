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
