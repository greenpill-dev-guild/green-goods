import { afterEach, describe, expect, it, vi } from "vitest";
import { createResendSubscriptionClient } from "../services/subscriptions";

describe("createResendSubscriptionClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates Resend contacts with Green Goods metadata, segment, and topic routing", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ object: "contact", id: "contact_123" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createResendSubscriptionClient({
      apiKey: "resend-key",
      segmentId: "seg_123",
      topicId: "topic_123",
    });

    await expect(
      client?.subscribe({
        email: "person@example.org",
        locale: "pt",
        source: "homepage_get_in_touch",
        consentedAt: "2026-04-28T12:00:00.000Z",
      })
    ).resolves.toBe("subscribed");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/contacts",
      expect.objectContaining({
        method: "POST",
        headers: {
          authorization: "Bearer resend-key",
          "content-type": "application/json",
        },
      })
    );
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(body).toEqual({
      email: "person@example.org",
      unsubscribed: false,
      properties: {
        source: "homepage_get_in_touch",
        locale: "pt",
        consented_at: "2026-04-28T12:00:00.000Z",
        green_goods_signup: "true",
      },
      segments: [{ id: "seg_123" }],
      topics: [{ id: "topic_123", subscription: "opt_in" }],
    });
  });

  it("updates existing contacts and reapplies routing when Resend reports a duplicate", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ object: "contact", id: "contact_123" }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: "seg_123" }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: "topic_123" }) });
    vi.stubGlobal("fetch", fetchMock);

    const client = createResendSubscriptionClient({
      apiKey: "resend-key",
      segmentId: "seg_123",
      topicId: "topic_123",
    });

    await expect(
      client?.subscribe({
        email: "person@example.org",
        source: "footer",
        consentedAt: "2026-04-28T12:00:00.000Z",
      })
    ).resolves.toBe("already_subscribed");

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.resend.com/contacts/person%40example.org",
      expect.objectContaining({ method: "PATCH" })
    );
    const updateBody = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string);
    expect(updateBody).toEqual({
      unsubscribed: false,
      properties: {
        source: "footer",
        consented_at: "2026-04-28T12:00:00.000Z",
        green_goods_signup: "true",
      },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://api.resend.com/contacts/person%40example.org/segments/seg_123",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "https://api.resend.com/contacts/person%40example.org/topics",
      expect.objectContaining({ method: "PATCH" })
    );
    const topicsBody = JSON.parse(fetchMock.mock.calls[3]?.[1]?.body as string);
    expect(topicsBody).toEqual({
      topics: [{ id: "topic_123", subscription: "opt_in" }],
    });
  });

  it("stays unconfigured unless Resend has an API key and routing target", () => {
    expect(createResendSubscriptionClient({ apiKey: "resend-key" })).toBeUndefined();
    expect(createResendSubscriptionClient({ segmentId: "seg_123" })).toBeUndefined();
    expect(
      createResendSubscriptionClient({ apiKey: "resend-key", topicId: "topic_123" })
    ).toBeDefined();
  });

  it("surfaces upstream failures without leaking provider response details", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: "provider-specific failure" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createResendSubscriptionClient({
      apiKey: "resend-key",
      segmentId: "seg_123",
    });

    await expect(
      client?.subscribe({
        email: "person@example.org",
        source: "unknown",
        consentedAt: "2026-04-28T12:00:00.000Z",
      })
    ).rejects.toThrow("Resend subscription request failed");
  });
});
