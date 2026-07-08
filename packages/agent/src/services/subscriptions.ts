import type { PublicLocale, PublicSubscribeRequest } from "@green-goods/shared/public-contracts";

export type SubscriptionStatus = "subscribed" | "already_subscribed";

export interface SubscriberInput {
  email: string;
  locale?: PublicLocale;
  source: NonNullable<PublicSubscribeRequest["source"]>;
  consentedAt: string;
}

export interface SubscriptionClient {
  subscribe(input: SubscriberInput): Promise<SubscriptionStatus>;
}

export interface ResendSubscriptionConfig {
  apiKey?: string;
  segmentId?: string;
  topicId?: string;
  apiBaseUrl?: string;
  fetch?: typeof fetch;
}

type ResendFetch = typeof fetch;

const DEFAULT_RESEND_API_BASE_URL = "https://api.resend.com";

export function createResendSubscriptionClient(
  config: ResendSubscriptionConfig
): SubscriptionClient | undefined {
  const apiKey = config.apiKey?.trim();
  const segmentId = config.segmentId?.trim();
  const topicId = config.topicId?.trim();
  if (!apiKey || (!segmentId && !topicId)) return undefined;

  const fetchImpl = config.fetch ?? fetch;
  const apiBaseUrl = normalizeApiBaseUrl(config.apiBaseUrl);

  return {
    async subscribe(input) {
      const createResponse = await fetchImpl(`${apiBaseUrl}/contacts`, {
        method: "POST",
        headers: resendHeaders(apiKey),
        body: JSON.stringify({
          email: input.email,
          unsubscribed: false,
          properties: contactProperties(input),
          ...(segmentId ? { segments: [{ id: segmentId }] } : {}),
          ...(topicId ? { topics: [{ id: topicId, subscription: "opt_in" }] } : {}),
        }),
      });

      if (createResponse.status === 409) {
        await updateExistingContact({
          apiBaseUrl,
          apiKey,
          fetchImpl,
          input,
          segmentId,
          topicId,
        });
        return "already_subscribed";
      }

      assertResendOk(createResponse);
      return "subscribed";
    },
  };
}

function normalizeApiBaseUrl(value: string | undefined): string {
  return (value?.trim() || DEFAULT_RESEND_API_BASE_URL).replace(/\/+$/, "");
}

function resendHeaders(apiKey: string): Record<string, string> {
  return {
    authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
  };
}

function contactProperties(input: SubscriberInput): Record<string, string> {
  return {
    source: input.source,
    ...(input.locale ? { locale: input.locale } : {}),
    consented_at: input.consentedAt,
    green_goods_signup: "true",
  };
}

async function updateExistingContact(input: {
  apiBaseUrl: string;
  apiKey: string;
  fetchImpl: ResendFetch;
  input: SubscriberInput;
  segmentId?: string;
  topicId?: string;
}): Promise<void> {
  const contactPath = `${input.apiBaseUrl}/contacts/${encodeURIComponent(input.input.email)}`;

  await requestResend(input.fetchImpl, contactPath, {
    method: "PATCH",
    headers: resendHeaders(input.apiKey),
    body: JSON.stringify({
      unsubscribed: false,
      properties: contactProperties(input.input),
    }),
  });

  if (input.segmentId) {
    await requestResend(
      input.fetchImpl,
      `${contactPath}/segments/${encodeURIComponent(input.segmentId)}`,
      {
        method: "POST",
        headers: resendHeaders(input.apiKey),
      },
      new Set([409])
    );
  }

  if (input.topicId) {
    await requestResend(input.fetchImpl, `${contactPath}/topics`, {
      method: "PATCH",
      headers: resendHeaders(input.apiKey),
      body: JSON.stringify({
        topics: [{ id: input.topicId, subscription: "opt_in" }],
      }),
    });
  }
}

async function requestResend(
  fetchImpl: ResendFetch,
  url: string,
  init: RequestInit,
  acceptedStatuses = new Set<number>()
): Promise<Response> {
  const response = await fetchImpl(url, init);
  if (response.ok || acceptedStatuses.has(response.status)) return response;
  throw new Error(`Resend subscription request failed with status ${response.status}`);
}

function assertResendOk(response: Response): void {
  if (response.ok) return;
  throw new Error(`Resend subscription request failed with status ${response.status}`);
}
