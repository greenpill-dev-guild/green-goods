import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const canvas = vi.hoisted(() => ({ redraw: vi.fn() }));
// The compressor's canvas, which a Node test does not have.
vi.mock("../../utils/work/image-compression", () => ({ imageCompressor: canvas }));

import {
  canonicalizeIPFSIdentifier,
  createGatewayChain,
  getFileByHash,
  getJsonByHash,
  initializeIpfsFromEnv,
  type IpfsGateway,
  ipfsPinner,
  parseIPFSReference,
  resolveIPFSUrl,
  uploadFileToIPFS,
  uploadJSONToIPFS,
} from "../../modules/data/ipfs";
import { verifyPinataGatewayAvailability } from "../../modules/data/ipfs/pinata";
import { UnpublishableImageError } from "../../modules/data/ipfs/upload";
import { bytesOf, cameraPhoto, cleanPhoto, photoFile } from "../test-utils/photo-fixtures";

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

  it("falls back from a 404 gateway response to the next successful gateway", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("not found", { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock;

    const result = await getJsonByHash<{ ok: boolean }>(`${validCid}/config.json`);

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain(`/ipfs/${validCid}/config.json`);
    expect(fetchMock.mock.calls[1][0]).toContain(`/ipfs/${validCid}/config.json`);
  });

  it("falls back when a successful gateway response contains invalid JSON", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("not-json", { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock;

    await expect(getJsonByHash<{ ok: boolean }>(`${validCid}/config.json`)).resolves.toEqual({
      ok: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("preserves declared gateway order through createGatewayChain", async () => {
    const attempts: string[] = [];
    const gateway = (name: string, result: "fail" | "pass"): IpfsGateway => ({
      readFile: async () => {
        attempts.push(name);
        if (result === "fail") throw new Error(`${name} unavailable`);
        return { data: "ok" };
      },
      readJson: async <T>() => ({ ok: true }) as T,
    });

    const chain = createGatewayChain([
      gateway("configured", "fail"),
      gateway("pinata", "fail"),
      gateway("public", "pass"),
    ]);

    await expect(chain.readFile(validCid)).resolves.toEqual({ data: "ok" });
    expect(attempts).toEqual(["configured", "pinata", "public"]);
  });

  it("aborts a stalled gateway chain at its configured timeout", async () => {
    vi.useFakeTimers();
    try {
      const stalled: IpfsGateway = {
        readFile: (_identifier, options) =>
          new Promise((_resolve, reject) => {
            options?.signal?.addEventListener("abort", () => {
              reject(new DOMException("The operation was aborted.", "AbortError"));
            });
          }),
        readJson: async () => {
          throw new Error("unused");
        },
      };
      const request = createGatewayChain([stalled]).readFile(validCid, { timeoutMs: 250 });
      const expectation = expect(request).rejects.toThrow("IPFS request timed out after 250ms");

      await vi.advanceTimersByTimeAsync(250);
      await expectation;
    } finally {
      vi.useRealTimers();
    }
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
    const proof = cleanPhoto("image/png");
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url === "https://agent.greengoods.test/api/uploads/sign") {
        const body = JSON.parse(String(init?.body));
        expect(body).toMatchObject({
          filename: "proof.png",
          mimeType: "image/png",
          size: proof.length,
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

    const result = await ipfsPinner.pinFile(photoFile(proof, "proof.png", "image/png"), {
      source: "ipfs-test",
    });

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

  it("retries Pinata gateway verification before succeeding", async () => {
    vi.useFakeTimers();
    try {
      await initializeIpfsFromEnv({
        MODE: "test",
        PINATA_JWT: "pinata-server-token",
        PINATA_GATEWAY_URL: "https://pinata.example",
      });
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
        .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
        .mockResolvedValueOnce(new Response("ok", { status: 200 }));
      globalThis.fetch = fetchMock;

      const verification = verifyPinataGatewayAvailability(validCid);
      await vi.runAllTimersAsync();
      await verification;

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
        `https://pinata.example/ipfs/${validCid}`,
        `https://pinata.example/ipfs/${validCid}`,
        `https://pinata.example/ipfs/${validCid}`,
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("aborts a stalled Pinata upload once the timeout elapses", async () => {
    vi.useFakeTimers();
    try {
      await initializeIpfsFromEnv({
        MODE: "test",
        PINATA_JWT: "pinata-server-token",
        PINATA_GATEWAY_URL: "https://pinata.example",
        PINATA_API_URL: "https://uploads.pinata.test/v3",
      });

      // A fetch that never resolves on its own — it only settles when its
      // AbortSignal fires, mimicking a connection that stalls mid-upload.
      const fetchMock = vi.fn<typeof fetch>(
        (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            (init as RequestInit | undefined)?.signal?.addEventListener("abort", () => {
              reject(new DOMException("The operation was aborted.", "AbortError"));
            });
          })
      );
      globalThis.fetch = fetchMock;

      const uploadPromise = uploadFileToIPFS(
        new File(["content"], "proof.txt", { type: "text/plain" })
      );
      const expectation = expect(uploadPromise).rejects.toThrow(/timed out/i);

      // Advance past the 60s upload ceiling so the AbortController fires.
      await vi.advanceTimersByTimeAsync(60_000);
      await expectation;

      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  // Garden banners, campaign and action images, assessment evidence and the
  // profile photo all pin through uploadFileToIPFS.
  describe("pinning an image", () => {
    const SIGNER = "https://agent.greengoods.test/api/uploads/sign";
    const UPLOAD = "https://uploads.pinata.test/v3/files/signed";

    /** Pinata at its HTTP edge, behind the agent's signer: each file it received. */
    async function pinningService() {
      const received: File[] = [];
      const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
        const url = String(input);
        if (url === SIGNER) return Response.json({ ok: true, url: UPLOAD });
        if (url === UPLOAD) {
          received.push((init?.body as FormData).get("file") as File);
          return Response.json({ data: { cid: validCid } });
        }
        // The gateway check that follows each upload.
        return new Response("ok");
      });
      globalThis.fetch = fetchMock;
      await initializeIpfsFromEnv({
        MODE: "test",
        VITE_API_BASE_URL: "https://agent.greengoods.test",
      });
      return { received, fetchMock };
    }

    beforeEach(() => {
      canvas.redraw.mockReset().mockResolvedValue(null);
    });

    // Each format's rewrite is proven in work-media-processing; this proves the upload runs it.
    it("pins a photo without its location or camera details, and without redrawing it", async () => {
      const { received } = await pinningService();

      await uploadFileToIPFS(photoFile(cameraPhoto("image/jpeg"), "banner", "image/jpeg"), {
        source: "banner",
      });

      expect(received).toHaveLength(1);
      expect(await bytesOf(received[0])).toEqual(cleanPhoto("image/jpeg", { orientation: 6 }));
      expect(canvas.redraw).not.toHaveBeenCalled();
    });

    it("pins a file that is not an image exactly as it is", async () => {
      const { received } = await pinningService();
      // Bytes a rewrite would change, under a type that says they are no image.
      const note = new File([cameraPhoto("image/jpeg")], "note.webm", { type: "audio/webm" });

      await uploadFileToIPFS(note);

      expect(await bytesOf(received[0])).toEqual(await bytesOf(note));
      expect(canvas.redraw).not.toHaveBeenCalled();
    });

    it("pins an image in another format as a canvas drew it again, read back like any photo", async () => {
      const { received } = await pinningService();
      const gif = new File(["GIF89a"], "banner.gif", { type: "image/gif" });
      canvas.redraw.mockResolvedValue(
        photoFile(cameraPhoto("image/png"), "banner.gif", "image/png")
      );

      await uploadFileToIPFS(gif);

      expect(canvas.redraw).toHaveBeenCalledWith(gif);
      expect(await bytesOf(received[0])).toEqual(cleanPhoto("image/png", { orientation: 6 }));
    });

    it("refuses an image that neither the rewrite nor a canvas can read, and sends nothing", async () => {
      const { fetchMock } = await pinningService();
      const onFileProgress = vi.fn();

      await expect(
        uploadFileToIPFS(new File(["not a picture"], "banner.png", { type: "image/png" }), {
          onFileProgress,
        })
      ).rejects.toEqual(new UnpublishableImageError("banner.png"));

      expect(fetchMock).not.toHaveBeenCalled();
      expect(onFileProgress).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
    });
  });
});
