import { afterEach, describe, expect, it, vi } from "vitest";
import { createLumaClient } from "../services/luma";

describe("createLumaClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("imports subscribers with a Luma tag name when no tag id is configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "subscribed" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createLumaClient({
      apiKey: "luma-key",
      calendarId: "cal_123",
      tagName: "Subscriber",
    });

    await expect(
      client?.importSubscriber({
        email: "person@example.org",
        source: "footer",
        consentedAt: "2026-04-28T12:00:00.000Z",
      })
    ).resolves.toBe("subscribed");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://public-api.luma.com/v1/calendar/import-people",
      expect.objectContaining({
        method: "POST",
        headers: {
          "x-luma-api-key": "luma-key",
          "content-type": "application/json",
        },
      })
    );
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(body).toMatchObject({
      calendar_id: "cal_123",
      infos: [{ email: "person@example.org" }],
      tag_names: ["Subscriber"],
    });
    expect(body).not.toHaveProperty("tag_ids");
  });

  it("prefers a Luma tag id when both id and name are configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "already_subscribed" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createLumaClient({
      apiKey: "luma-key",
      calendarId: "cal_123",
      tagId: "tag_123",
      tagName: "Subscriber",
    });

    await expect(
      client?.importSubscriber({
        email: "person@example.org",
        source: "footer",
        consentedAt: "2026-04-28T12:00:00.000Z",
      })
    ).resolves.toBe("already_subscribed");

    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(body.tag_ids).toEqual(["tag_123"]);
    expect(body).not.toHaveProperty("tag_names");
  });
});
