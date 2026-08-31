// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  consumeShareTarget,
  loadShareTarget,
  type ShareTargetEnvelope,
} from "../../../modules/app/share-target";

const originalCaches = Object.getOwnPropertyDescriptor(globalThis, "caches");

function installShareCache(envelope: ShareTargetEnvelope, includeFile = false) {
  const store = new Map<string, Response>();
  store.set(
    `/__gg_share_envelope__/${envelope.token}`,
    new Response(JSON.stringify(envelope), { headers: { "content-type": "application/json" } })
  );
  if (includeFile && envelope.files[0]) {
    store.set(
      envelope.files[0].cacheKey,
      new Response("image", { headers: { "content-type": envelope.files[0].type } })
    );
  }
  const cache = {
    match: vi.fn(async (key: string) => store.get(key)?.clone()),
    delete: vi.fn(async (key: string) => store.delete(key)),
  };
  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    value: { open: vi.fn().mockResolvedValue(cache) },
  });
  return { cache, store };
}

function createEnvelope(overrides: Partial<ShareTargetEnvelope> = {}): ShareTargetEnvelope {
  return {
    version: 1,
    token: "share-1",
    createdAt: Date.now() - 100,
    expiresAt: Date.now() + 60_000,
    title: "Creek restoration",
    text: "Seedlings planted",
    url: "https://example.org/proof",
    files: [
      {
        cacheKey: "/__gg_share_file__/share-1/0",
        name: "creek.webp",
        type: "image/webp",
        size: 5,
      },
    ],
    ...overrides,
  };
}

afterEach(() => {
  if (originalCaches) Object.defineProperty(globalThis, "caches", originalCaches);
  else Reflect.deleteProperty(globalThis, "caches");
});

describe("Share Target inbox", () => {
  it("loads files and prefills feedback in title, text, URL order", async () => {
    const envelope = createEnvelope();
    installShareCache(envelope, true);

    const loaded = await loadShareTarget(envelope.token);

    expect(loaded?.feedback).toBe(
      "Creek restoration\n\nSeedlings planted\n\nhttps://example.org/proof"
    );
    expect(loaded?.files).toHaveLength(1);
    expect(loaded?.files[0]).toMatchObject({ name: "creek.webp", type: "image/webp" });
  });

  it("consumes the envelope and every associated file exactly once", async () => {
    const envelope = createEnvelope();
    const { cache, store } = installShareCache(envelope, true);

    await consumeShareTarget(envelope.token);
    await consumeShareTarget(envelope.token);

    expect(store.size).toBe(0);
    expect(cache.delete).toHaveBeenCalledWith(envelope.files[0].cacheKey);
    expect(cache.delete).toHaveBeenCalledWith(`/__gg_share_envelope__/${envelope.token}`);
  });

  it("expires and removes abandoned envelopes", async () => {
    const envelope = createEnvelope({ expiresAt: Date.now() - 1 });
    const { store } = installShareCache(envelope, true);

    await expect(loadShareTarget(envelope.token)).resolves.toBeNull();
    expect(store.size).toBe(0);
  });
});
