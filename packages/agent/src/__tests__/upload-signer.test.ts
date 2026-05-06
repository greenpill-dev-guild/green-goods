import { PUBLIC_AGENT_ROUTES } from "@green-goods/shared/public-contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer } from "../api/server";
import { InMemoryPublicRateLimiter } from "../api/public-protection";

const ORIGIN = "https://greengoods.app";
const NOW = Date.parse("2026-04-28T12:00:00.000Z");

function jsonHeaders(extra: Record<string, string> = {}) {
  return {
    origin: ORIGIN,
    "content-type": "application/json",
    ...extra,
  };
}

function validRequest(overrides: Record<string, unknown> = {}) {
  return {
    filename: "leaf-photo.png",
    mimeType: "image/png",
    size: 42_000,
    source: "upload-signer-test",
    category: "file_upload",
    gardenAddress: "0x1111111111111111111111111111111111111111",
    ...overrides,
  };
}

describe("upload signing API", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns a constrained Pinata signed upload URL for an allowed browser origin", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: "https://uploads.pinata.test/v3/files/signed" }), {
        status: 200,
      })
    );
    const app = createServer(
      {
        isAIReady: () => true,
        allowedOrigins: new Set([ORIGIN]),
        publicRateLimiter: new InMemoryPublicRateLimiter(),
        now: () => NOW,
        uploadSigning: {
          pinataJwt: "pinata-secret",
          pinataUploadsApiBaseUrl: "https://uploads.pinata.test/v3",
          ttlSeconds: 45,
          maxFileSize: 1_000_000,
          allowedMimeTypes: ["image/*", "application/json"],
          fetch: fetchMock,
        },
      },
      { logger: false }
    );

    const response = await app.request(PUBLIC_AGENT_ROUTES.uploadSign, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(validRequest()),
    });

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(body).toEqual({
      ok: true,
      url: "https://uploads.pinata.test/v3/files/signed",
      expiresAt: Math.floor(NOW / 1000) + 45,
      maxFileSize: 1_000_000,
      allowedMimeTypes: ["image/*", "application/json"],
    });

    expect(fetchMock).toHaveBeenCalledWith("https://uploads.pinata.test/v3/files/sign", {
      method: "POST",
      headers: {
        Authorization: "Bearer pinata-secret",
        "Content-Type": "application/json",
      },
      body: expect.any(String),
    });
    const pinataBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(pinataBody).toMatchObject({
      date: Math.floor(NOW / 1000),
      expires: 45,
      max_file_size: 1_000_000,
      allow_mime_types: ["image/*", "application/json"],
      filename: "leaf-photo.png",
      keyvalues: {
        category: "file_upload",
        source: "upload-signer-test",
        gardenAddress: "0x1111111111111111111111111111111111111111",
      },
    });
  });

  it("rejects invalid MIME type, oversized files, and unsafe filenames before signing", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const app = createServer(
      {
        isAIReady: () => true,
        allowedOrigins: new Set([ORIGIN]),
        publicRateLimiter: new InMemoryPublicRateLimiter(),
        uploadSigning: {
          pinataJwt: "pinata-secret",
          maxFileSize: 100,
          allowedMimeTypes: ["application/json"],
          fetch: fetchMock,
        },
      },
      { logger: false }
    );

    for (const request of [
      validRequest({ mimeType: "text/html" }),
      validRequest({ size: 101, mimeType: "application/json" }),
      validRequest({ filename: "../metadata.json", mimeType: "application/json", size: 10 }),
    ]) {
      const response = await app.request(PUBLIC_AGENT_ROUTES.uploadSign, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify(request),
      });

      expect(response.status).toBe(400);
      expect((await response.json()).errorCode).toBe("invalid_request");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a generic unavailable error when Pinata signing is not configured", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const app = createServer(
      {
        isAIReady: () => true,
        allowedOrigins: new Set([ORIGIN]),
        uploadSigning: { fetch: fetchMock },
      },
      { logger: false }
    );

    const response = await app.request(PUBLIC_AGENT_ROUTES.uploadSign, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(validRequest()),
    });

    expect(response.status).toBe(503);
    expect((await response.json()).errorCode).toBe("provider_unavailable");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed when the upload origin allowlist is not configured", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const app = createServer(
      {
        isAIReady: () => true,
        uploadSigning: {
          pinataJwt: "pinata-secret",
          fetch: fetchMock,
        },
      },
      { logger: false }
    );

    const response = await app.request(PUBLIC_AGENT_ROUTES.uploadSign, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(validRequest()),
    });

    expect(response.status).toBe(403);
    expect((await response.json()).errorCode).toBe("origin_not_allowed");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("enforces origin policy, CORS preflight, and upload-sign rate limits", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: "https://uploads.pinata.test/v3/files/signed" }), {
        status: 200,
      })
    );
    const app = createServer(
      {
        isAIReady: () => true,
        allowedOrigins: new Set([ORIGIN]),
        publicRateLimiter: new InMemoryPublicRateLimiter(),
        uploadSigning: {
          pinataJwt: "pinata-secret",
          rateLimit: 1,
          rateLimitWindowMs: 60_000,
          fetch: fetchMock,
        },
      },
      { logger: false }
    );

    const preflight = await app.request(PUBLIC_AGENT_ROUTES.uploadSign, {
      method: "OPTIONS",
      headers: { origin: ORIGIN },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe(ORIGIN);

    const rejectedOrigin = await app.request(PUBLIC_AGENT_ROUTES.uploadSign, {
      method: "POST",
      headers: jsonHeaders({ origin: "https://evil.example" }),
      body: JSON.stringify(validRequest()),
    });
    expect(rejectedOrigin.status).toBe(403);
    expect((await rejectedOrigin.json()).errorCode).toBe("origin_not_allowed");

    const first = await app.request(PUBLIC_AGENT_ROUTES.uploadSign, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(validRequest()),
    });
    const second = await app.request(PUBLIC_AGENT_ROUTES.uploadSign, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(validRequest()),
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect((await second.json()).errorCode).toBe("rate_limited");
  });
});
