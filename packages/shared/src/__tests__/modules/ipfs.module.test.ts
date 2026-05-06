import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  canonicalizeIPFSIdentifier,
  getFileByHash,
  getJsonByHash,
  initializeIpfsFromEnv,
  parseIPFSReference,
  resolveIPFSUrl,
  uploadFileToIPFS,
  uploadJSONToIPFS,
} from "../../modules/data/ipfs";

describe("modules/data/ipfs", () => {
  const originalFetch = globalThis.fetch;
  const validCid = "bafybeigdyrzt4l3bq4v6l6c2sb2a2e4h2m6n3b6z53hl5lmw2m4w4mqw6e";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await initializeIpfsFromEnv({});
  });

  it("canonicalizes bare, ipfs://, and gateway references consistently", () => {
    expect(parseIPFSReference(`ipfs://${validCid}/path/file.json`)).toEqual({
      cid: validCid,
      path: "path/file.json",
      canonicalId: `${validCid}/path/file.json`,
      canonicalUri: `ipfs://${validCid}/path/file.json`,
    });

    expect(canonicalizeIPFSIdentifier(`https://ipfs.io/ipfs/${validCid}/path/file.json`)).toBe(
      `${validCid}/path/file.json`
    );
    expect(canonicalizeIPFSIdentifier(`${validCid}/path/file.json`)).toBe(
      `${validCid}/path/file.json`
    );
    expect(resolveIPFSUrl(`ipfs://${validCid}/path/file.json`, "https://gateway.example")).toBe(
      `https://gateway.example/ipfs/${validCid}/path/file.json`
    );
  });

  it("falls back across gateway candidates when the first fetch fails", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("bad gateway", { status: 502 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock;

    const result = await getJsonByHash<{ ok: boolean }>(`${validCid}/config.json`);

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain(`/ipfs/${validCid}/config.json`);
    expect(fetchMock.mock.calls[1][0]).toContain(`/ipfs/${validCid}/config.json`);
  });

  it("tries the original gateway URL before fallback gateways", async () => {
    const originalUrl = `https://signed.gateway.example/ipfs/${validCid}/config.json?token=abc123`;
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("forbidden", { status: 403 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock;

    const result = await getJsonByHash<{ ok: boolean }>(originalUrl);

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(originalUrl);
    expect(fetchMock.mock.calls[1]?.[0]).toContain(`/ipfs/${validCid}/config.json`);
  });

  it("returns text for JSON/text responses from getFileByHash", async () => {
    globalThis.fetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{"hello":"world"}', { status: 200 }));

    const result = await getFileByHash(`${validCid}/config.json`);

    expect(result.data).toBe('{"hello":"world"}');
  });

  it("prefers the configured Pinata gateway for new reads", async () => {
    await initializeIpfsFromEnv({
      PINATA_GATEWAY_URL: "https://pinata.example",
    });

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock;

    const result = await getJsonByHash<{ ok: boolean }>(`ipfs://${validCid}/config.json`);

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `https://pinata.example/ipfs/${validCid}/config.json`
    );
    expect(resolveIPFSUrl(`ipfs://${validCid}/config.json`)).toBe(
      `https://pinata.example/ipfs/${validCid}/config.json`
    );
  });

  it("initializes successfully with agent-signed browser upload config", async () => {
    const initialized = await initializeIpfsFromEnv({
      VITE_API_BASE_URL: "https://agent.greengoods.test",
      PINATA_GATEWAY_URL: "https://pinata.example",
    });

    expect(initialized).toBe(true);
  });

  it("initializes read config without relying on a browser Pinata JWT", async () => {
    const initialized = await initializeIpfsFromEnv({
      VITE_PINATA_JWT: "pinata-browser-token-value",
      VITE_PINATA_GATEWAY_URL: "https://pinata-vite.example",
    });

    expect(initialized).toBe(false);
    expect(resolveIPFSUrl(`ipfs://${validCid}/config.json`)).toBe(
      `https://pinata-vite.example/ipfs/${validCid}/config.json`
    );
  });

  it("ignores unknown legacy gateway env keys", async () => {
    const initialized = await initializeIpfsFromEnv({
      VITE_LEGACY_IPFS_GATEWAY_URL: "https://legacy.example",
    });

    expect(initialized).toBe(false);
    expect(resolveIPFSUrl(`ipfs://${validCid}/config.json`)).toBe(
      `https://greengoods.mypinata.cloud/ipfs/${validCid}/config.json`
    );
  });

  it("uploads files through an agent-signed Pinata URL and preserves CID parsing", async () => {
    await initializeIpfsFromEnv({
      MODE: "test",
      VITE_API_BASE_URL: "https://agent.greengoods.test",
      VITE_PINATA_GATEWAY_URL: "https://pinata.example",
    });
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url === "https://agent.greengoods.test/api/uploads/sign") {
        const body = JSON.parse(String(init?.body));
        expect(body).toMatchObject({
          filename: "proof.png",
          mimeType: "image/png",
          size: 7,
          category: "file_upload",
          source: "ipfs-test",
        });
        return new Response(
          JSON.stringify({ ok: true, url: "https://uploads.pinata.test/v3/files/signed" }),
          { status: 200 }
        );
      }
      if (url === "https://uploads.pinata.test/v3/files/signed") {
        expect(
          (init?.headers as Record<string, string> | undefined)?.Authorization
        ).toBeUndefined();
        return new Response(JSON.stringify({ data: { cid: validCid } }), { status: 200 });
      }
      if (url.includes(`/ipfs/${validCid}`)) {
        return new Response("ok", { status: 200 });
      }
      return new Response("not found", { status: 404 });
    });
    globalThis.fetch = fetchMock;

    const result = await uploadFileToIPFS(
      new File(["content"], "proof.png", { type: "image/png" }),
      { source: "ipfs-test" }
    );

    expect(result).toEqual({ cid: validCid });
  });

  it("uploads JSON through the signer and reports missing CIDs from Pinata responses", async () => {
    await initializeIpfsFromEnv({
      MODE: "test",
      VITE_API_BASE_URL: "https://agent.greengoods.test",
    });
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url === "https://agent.greengoods.test/api/uploads/sign") {
        const body = JSON.parse(String(init?.body));
        expect(body).toMatchObject({
          filename: "metadata.json",
          mimeType: "application/json",
          category: "json_upload",
        });
        return new Response(
          JSON.stringify({ ok: true, url: "https://uploads.pinata.test/v3/files/signed" }),
          { status: 200 }
        );
      }
      if (url === "https://uploads.pinata.test/v3/files/signed") {
        return new Response(JSON.stringify({ data: {} }), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    });
    globalThis.fetch = fetchMock;

    await expect(uploadJSONToIPFS({ ok: true }, { source: "metadata-test" })).rejects.toThrow(
      "did not return a CID"
    );
  });

  it("preserves direct PINATA_JWT upload fallback for server callers", async () => {
    await initializeIpfsFromEnv({
      MODE: "test",
      PINATA_JWT: "pinata-server-token",
      PINATA_GATEWAY_URL: "https://pinata.example",
      PINATA_API_URL: "https://uploads.pinata.test/v3",
    });
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url === "https://uploads.pinata.test/v3/files") {
        expect((init?.headers as Record<string, string>).Authorization).toBe(
          "Bearer pinata-server-token"
        );
        return new Response(JSON.stringify({ data: { cid: validCid } }), { status: 200 });
      }
      if (url.includes(`/ipfs/${validCid}`)) {
        return new Response("ok", { status: 200 });
      }
      return new Response("not found", { status: 404 });
    });
    globalThis.fetch = fetchMock;

    const result = await uploadFileToIPFS(
      new File(["content"], "proof.txt", { type: "text/plain" })
    );

    expect(result).toEqual({ cid: validCid });
  });
});
