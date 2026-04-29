import type { PublicLocale, PublicSubscribeRequest } from "@green-goods/shared/public-contracts";

export type LumaImportStatus = "subscribed" | "already_subscribed";

export interface LumaSubscriberInput {
  email: string;
  locale?: PublicLocale;
  source: NonNullable<PublicSubscribeRequest["source"]>;
  consentedAt: string;
}

export interface LumaClient {
  importSubscriber(input: LumaSubscriberInput): Promise<LumaImportStatus>;
}

export interface LumaConfig {
  apiKey?: string;
  calendarId?: string;
  tagId?: string;
  tagName?: string;
}

export function createLumaClient(config: LumaConfig): LumaClient | undefined {
  const apiKey = config.apiKey?.trim();
  const calendarId = config.calendarId?.trim();
  const tagId = config.tagId?.trim();
  const tagName = config.tagName?.trim();
  if (!apiKey || !calendarId || (!tagId && !tagName)) return undefined;

  return {
    async importSubscriber(input) {
      const tagPayload = tagId ? { tag_ids: [tagId] } : { tag_names: [tagName ?? ""] };
      const response = await fetch("https://public-api.luma.com/v1/calendar/import-people", {
        method: "POST",
        headers: {
          "x-luma-api-key": apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          calendar_id: calendarId,
          infos: [{ email: input.email }],
          ...tagPayload,
          source: input.source,
          locale: input.locale,
          consented_at: input.consentedAt,
        }),
      });

      if (response.status === 409) return "already_subscribed";
      if (!response.ok) {
        throw new Error(`Luma import failed with status ${response.status}`);
      }

      const payload = (await response.json().catch(() => ({}))) as { status?: string };
      return payload.status === "already_subscribed" ? "already_subscribed" : "subscribed";
    },
  };
}
