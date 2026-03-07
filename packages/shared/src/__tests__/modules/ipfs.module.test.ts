import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  canonicalizeIPFSIdentifier,
  getFileByHash,
  getJsonByHash,
  parseIPFSReference,
  resolveIPFSUrl,
} from "../../modules/data/ipfs";

describe("modules/data/ipfs", () => {
  const originalFetch = globalThis.fetch;
  const validCid = "bafybeigdyrzt4l3bq4v6l6c2sb2a2e4h2m6n3b6z53hl5lmw2m4w4mqw6e";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
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
});
