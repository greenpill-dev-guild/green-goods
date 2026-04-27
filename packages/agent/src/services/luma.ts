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
}

export function createLumaClient(config: LumaConfig): LumaClient | undefined {
  if (!config.apiKey || !config.calendarId || !config.tagId) return undefined;

  return {
    async importSubscriber(input) {
      const response = await fetch("https://api.lu.ma/public/v1/calendar/people/import", {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          calendar_id: config.calendarId,
          email: input.email,
          tags: [config.tagId],
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
