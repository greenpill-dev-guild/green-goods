import { createHash, webcrypto } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import vm from "node:vm";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Listener = (event: Record<string, unknown>) => void;

const swCustomPath =
  [
    resolve(process.cwd(), "public/sw-custom.js"),
    resolve(process.cwd(), "packages/client/public/sw-custom.js"),
  ].find(existsSync) ?? resolve(process.cwd(), "public/sw-custom.js");

function shellDigest(entries: Array<[asset: string, contents: string]>): string {
  const digestInput = entries
    .map(([asset, contents]) => `${asset}\0${createHash("sha256").update(contents).digest("hex")}`)
    .join("\n");
  return createHash("sha256").update(digestInput).digest("hex").slice(0, 16);
}

async function loadServiceWorker(locationHref = "https://www.greengoods.app/sw.js") {
  const listeners: Record<string, Listener[]> = {};
  const cacheStores = new Map<string, Map<string, Response>>();
  const cacheObjects = new Map<
    string,
    {
      addAll: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      keys: ReturnType<typeof vi.fn>;
      match: ReturnType<typeof vi.fn>;
      put: ReturnType<typeof vi.fn>;
    }
  >();
  const keyFor = (request: RequestInfo | URL) =>
    typeof request === "string" ? request : request instanceof URL ? request.href : request.url;
  const cacheFor = (name: string) => {
    let cache = cacheObjects.get(name);
    if (cache) return cache;
    const store = new Map<string, Response>();
    cacheStores.set(name, store);
    cache = {
      addAll: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn(async (request: RequestInfo | URL) => store.delete(keyFor(request))),
      keys: vi.fn(async () => [...store.keys()].map((url) => new Request(url, { method: "GET" }))),
      match: vi.fn(async (request: RequestInfo | URL) => store.get(keyFor(request))?.clone()),
      put: vi.fn(async (request: RequestInfo | URL, response: Response) => {
        store.set(keyFor(request), response.clone());
      }),
    };
    cacheObjects.set(name, cache);
    return cache;
  };
  const clients = {
    claim: vi.fn().mockResolvedValue(undefined),
    matchAll: vi.fn().mockResolvedValue([]),
  };
  const caches = {
    keys: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(true),
    match: vi.fn(async (request: RequestInfo | URL) => {
      for (const store of cacheStores.values()) {
        const response = store.get(keyFor(request));
        if (response) return response.clone();
      }
      return undefined;
    }),
    open: vi.fn(async (name: string) => cacheFor(name)),
  };
  const fetchMock = vi.fn().mockResolvedValue(new Response("network"));
  const self = {
    addEventListener: vi.fn((type: string, listener: Listener) => {
      listeners[type] = [...(listeners[type] ?? []), listener];
    }),
    clients,
    skipWaiting: vi.fn(),
    crypto: { randomUUID: vi.fn(() => "share-token"), subtle: webcrypto.subtle },
    location: { href: locationHref, origin: new URL(locationHref).origin },
  };

  vm.runInNewContext(await readFile(swCustomPath, "utf8"), {
    caches,
    console,
    fetch: fetchMock,
    Promise,
    File,
    FormData,
    Headers,
    Request,
    Response,
    self,
    TextEncoder,
    URL,
  });

  return { cacheFor, cacheStores, caches, clients, fetchMock, listeners, self };
}

function htmlNavigationRequest(url: string) {
  return {
    headers: new Headers({ accept: "text/html" }),
    method: "GET",
    mode: "navigate",
    url,
  };
}

describe("client public service worker migration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("serves public website navigations from the network on refresh", async () => {
    const { fetchMock, listeners } = await loadServiceWorker();
    const request = htmlNavigationRequest("https://www.greengoods.app/gardens/atlanta");
    let responsePromise: Promise<Response> | undefined;
    const respondWith = vi.fn((promise: Promise<Response>) => {
      responsePromise = promise;
    });
    const stopImmediatePropagation = vi.fn();

    listeners.fetch[1]({ request, respondWith, stopImmediatePropagation });

    expect(respondWith).toHaveBeenCalledTimes(1);
    expect(stopImmediatePropagation).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(request, { cache: "reload" });
    await expect(responsePromise?.then((response) => response.text())).resolves.toBe("network");
  });

  it("leaves protected PWA navigations on the Workbox app-shell path", async () => {
    const { fetchMock, listeners } = await loadServiceWorker();
    const request = htmlNavigationRequest("https://www.greengoods.app/home");
    const respondWith = vi.fn();

    listeners.fetch[1]({ request, respondWith });

    expect(respondWith).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("waits for an explicit update prompt before activating a fresh worker", async () => {
    const { cacheFor, fetchMock, listeners, self } = await loadServiceWorker();
    const indexHtml = '<!doctype html><div id="root"></div>';
    const digest = shellDigest([["/index.html", indexHtml]]);
    let installation: Promise<unknown> | undefined;
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ version: 1, digest, assets: ["/index.html"] }), {
        headers: { "content-type": "application/json" },
      })
    );
    fetchMock.mockResolvedValueOnce(
      new Response(indexHtml, {
        headers: { "content-type": "text/html; charset=utf-8" },
      })
    );

    listeners.install[0]({
      waitUntil: vi.fn((promise: Promise<unknown>) => {
        installation = promise;
      }),
    });
    await installation;

    expect(cacheFor(`gg-pwa-shell-${digest}`).put).toHaveBeenCalledWith(
      "/index.html",
      expect.any(Response)
    );
    expect(self.skipWaiting).not.toHaveBeenCalled();

    listeners.message?.[0]?.({ data: { type: "SKIP_WAITING" } });

    expect(self.skipWaiting).toHaveBeenCalledTimes(1);
  });

  it("skips production shell population for the Vite development worker", async () => {
    const { fetchMock, listeners } = await loadServiceWorker(
      "https://localhost:3001/dev-sw.js?dev-sw"
    );
    let installation: Promise<unknown> | undefined;

    listeners.install[0]({
      waitUntil: vi.fn((promise: Promise<unknown>) => {
        installation = promise;
      }),
    });

    await expect(installation).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rolls back a failed shell install without replacing the active metadata", async () => {
    const { cacheFor, caches, fetchMock, listeners } = await loadServiceWorker();
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          version: 1,
          digest: "0000000000000000",
          assets: ["/assets/missing.js"],
        })
      )
    );
    fetchMock.mockResolvedValueOnce(
      new Response("<!doctype html>", {
        headers: { "content-type": "text/html; charset=utf-8" },
      })
    );
    let installation: Promise<unknown> | undefined;

    listeners.install[0]({
      waitUntil: vi.fn((promise: Promise<unknown>) => {
        installation = promise;
      }),
    });

    await expect(installation).rejects.toThrow("invalid content type");
    expect(caches.delete).toHaveBeenCalledWith("gg-pwa-shell-0000000000000000");
    expect(cacheFor("gg-pwa-shell-meta").put).not.toHaveBeenCalled();
  });

  it("rejects a shell whose fetched bytes do not match the manifest digest", async () => {
    const { cacheFor, caches, fetchMock, listeners } = await loadServiceWorker();
    const expectedCode = "export const release = 'expected'";
    const digest = shellDigest([["/assets/app.js", expectedCode]]);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ version: 1, digest, assets: ["/assets/app.js"] }), {
        headers: { "content-type": "application/json" },
      })
    );
    fetchMock.mockResolvedValueOnce(
      new Response("export const release = 'stale'", {
        headers: { "content-type": "application/javascript" },
      })
    );
    let installation: Promise<unknown> | undefined;

    listeners.install[0]({
      waitUntil: vi.fn((promise: Promise<unknown>) => {
        installation = promise;
      }),
    });

    await expect(installation).rejects.toThrow("digest mismatch");
    expect(caches.delete).toHaveBeenCalledWith(`gg-pwa-shell-${digest}`);
    expect(cacheFor("gg-pwa-shell-meta").put).not.toHaveBeenCalled();
  });

  it("never deletes the active shell cache when the manifest digest is unchanged", async () => {
    const { cacheFor, caches, fetchMock, listeners } = await loadServiceWorker();
    const digest = shellDigest([["/assets/app.js", "export const app = true"]]);
    const cacheName = `gg-pwa-shell-${digest}`;
    const putShellMetadata = cacheFor("gg-pwa-shell-meta").put as unknown as (
      request: RequestInfo | URL,
      response: Response
    ) => Promise<void>;
    await putShellMetadata(
      "/__gg_pwa_shell_current__",
      new Response(JSON.stringify({ cacheName, digest }), {
        headers: { "content-type": "application/json" },
      })
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ version: 1, digest, assets: ["/assets/app.js"] }), {
        headers: { "content-type": "application/json" },
      })
    );
    let installation: Promise<unknown> | undefined;

    listeners.install[0]({
      waitUntil: vi.fn((promise: Promise<unknown>) => {
        installation = promise;
      }),
    });

    await expect(installation).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(caches.delete).not.toHaveBeenCalledWith(cacheName);
  });

  it("clears stale runtime caches without claiming or navigating clients on activation", async () => {
    const { cacheFor, caches, clients, listeners } = await loadServiceWorker();
    const publicClient = {
      navigate: vi.fn().mockResolvedValue(undefined),
      url: "https://www.greengoods.app/",
    };
    const publicDetailClient = {
      navigate: vi.fn().mockResolvedValue(undefined),
      url: "https://www.greengoods.app/gardens/atlanta",
    };
    const pwaClient = {
      navigate: vi.fn().mockResolvedValue(undefined),
      url: "https://www.greengoods.app/home",
    };
    let activation: Promise<unknown> | undefined;

    const putShellMetadata = cacheFor("gg-pwa-shell-meta").put as unknown as (
      request: RequestInfo | URL,
      response: Response
    ) => Promise<void>;
    await putShellMetadata(
      "/__gg_pwa_shell_current__",
      new Response(JSON.stringify({ cacheName: "gg-pwa-shell-current" }))
    );
    caches.keys.mockResolvedValue([
      "js-cache",
      "image-cache",
      "graphql-cache",
      "workbox-precache",
      "gg-pwa-shell-old",
      "gg-pwa-shell-current",
    ]);
    clients.matchAll.mockResolvedValue([publicClient, publicDetailClient, pwaClient]);

    listeners.activate[0]({
      waitUntil: vi.fn((promise: Promise<unknown>) => {
        activation = promise;
      }),
    });

    await activation;

    expect(clients.claim).not.toHaveBeenCalled();
    expect(clients.matchAll).not.toHaveBeenCalled();
    expect(caches.delete).toHaveBeenCalledWith("js-cache");
    expect(caches.delete).toHaveBeenCalledWith("graphql-cache");
    expect(caches.delete).not.toHaveBeenCalledWith("image-cache");
    expect(caches.delete).not.toHaveBeenCalledWith("workbox-precache");
    expect(caches.delete).toHaveBeenCalledWith("gg-pwa-shell-old");
    expect(caches.delete).not.toHaveBeenCalledWith("gg-pwa-shell-current");
    expect(publicClient.navigate).not.toHaveBeenCalled();
    expect(publicDetailClient.navigate).not.toHaveBeenCalled();
    expect(pwaClient.navigate).not.toHaveBeenCalled();
  });

  it("serves a reload shim when a JS asset resolves to HTML", async () => {
    const { fetchMock, listeners } = await loadServiceWorker();
    const request = {
      headers: new Headers(),
      method: "GET",
      url: "https://www.greengoods.app/assets/index-old.js",
    };
    let responsePromise: Promise<Response> | undefined;
    const respondWith = vi.fn((promise: Promise<Response>) => {
      responsePromise = promise;
    });
    const stopImmediatePropagation = vi.fn();

    fetchMock.mockResolvedValue(
      new Response("<!doctype html>", {
        headers: { "content-type": "text/html; charset=utf-8" },
      })
    );

    listeners.fetch[2]({ request, respondWith, stopImmediatePropagation });

    expect(respondWith).toHaveBeenCalledTimes(1);
    expect(stopImmediatePropagation).toHaveBeenCalledTimes(1);
    await expect(responsePromise?.then((response) => response.text())).resolves.toContain(
      "gg-script-reload-attempt"
    );
  });

  it("caches successful hashed JavaScript responses in the current shell cache", async () => {
    const { cacheFor, fetchMock, listeners } = await loadServiceWorker();
    const putShellMetadata = cacheFor("gg-pwa-shell-meta").put as unknown as (
      request: RequestInfo | URL,
      response: Response
    ) => Promise<void>;
    await putShellMetadata(
      "/__gg_pwa_shell_current__",
      new Response(JSON.stringify({ cacheName: "gg-pwa-shell-current" }))
    );
    const request = new Request("https://www.greengoods.app/assets/app-hash.js");
    fetchMock.mockResolvedValueOnce(
      new Response("export const ready = true", {
        headers: { "content-type": "application/javascript" },
      })
    );
    let responsePromise: Promise<Response> | undefined;

    listeners.fetch[2]({
      request,
      respondWith: vi.fn((promise: Promise<Response>) => {
        responsePromise = promise;
      }),
      stopImmediatePropagation: vi.fn(),
    });

    await expect(responsePromise?.then((response) => response.text())).resolves.toContain("ready");
    expect(cacheFor("gg-pwa-shell-current").put).toHaveBeenCalledWith(
      request,
      expect.any(Response)
    );
  });

  it("stores a validated Share Target envelope and redirects with its token", async () => {
    const { cacheFor, listeners } = await loadServiceWorker();
    const formData = new FormData();
    formData.set("title", "Creek restoration");
    formData.set("text", "Seedlings planted");
    formData.set("url", "https://example.org/proof");
    formData.append("images", new File(["image"], "creek.webp", { type: "image/webp" }));
    const request = new Request("https://www.greengoods.app/home/share", {
      method: "POST",
      body: formData,
    });
    let responsePromise: Promise<Response> | undefined;

    listeners.fetch[0]({
      request,
      respondWith: vi.fn((promise: Promise<Response>) => {
        responsePromise = promise;
      }),
      stopImmediatePropagation: vi.fn(),
    });

    const response = await responsePromise;
    expect(response?.status).toBe(303);
    expect(response?.headers.get("location")).toBe("/home/garden?shareTarget=share-token");
    const inbox = cacheFor("gg-share-inbox-v1");
    expect(inbox.put).toHaveBeenCalledTimes(2);
    const matchEnvelope = inbox.match as unknown as (
      request: RequestInfo | URL
    ) => Promise<Response | undefined>;
    const envelopeResponse = await matchEnvelope("/__gg_share_envelope__/share-token");
    await expect(envelopeResponse?.json()).resolves.toMatchObject({
      version: 1,
      token: "share-token",
      title: "Creek restoration",
      text: "Seedlings planted",
      url: "https://example.org/proof",
      files: [{ name: "creek.webp", type: "image/webp" }],
    });
  });

  it("rejects an oversized Share Target without writing an envelope", async () => {
    const { cacheFor, listeners } = await loadServiceWorker();
    const formData = new FormData();
    for (let index = 0; index < 6; index += 1) {
      formData.append("images", new File(["x"], `${index}.jpg`, { type: "image/jpeg" }));
    }
    const request = new Request("https://www.greengoods.app/home/share", {
      method: "POST",
      body: formData,
    });
    let responsePromise: Promise<Response> | undefined;

    listeners.fetch[0]({
      request,
      respondWith: vi.fn((promise: Promise<Response>) => {
        responsePromise = promise;
      }),
      stopImmediatePropagation: vi.fn(),
    });

    const response = await responsePromise;
    expect(response?.status).toBe(303);
    expect(response?.headers.get("location")).toBe("/home/garden?shareTargetError=invalid");
    expect(cacheFor("gg-share-inbox-v1").put).not.toHaveBeenCalled();
  });

  it("rejects an empty Share Target without writing an envelope", async () => {
    const { cacheFor, listeners } = await loadServiceWorker();
    const request = new Request("https://www.greengoods.app/home/share", {
      method: "POST",
      body: new FormData(),
    });
    let responsePromise: Promise<Response> | undefined;

    listeners.fetch[0]({
      request,
      respondWith: vi.fn((promise: Promise<Response>) => {
        responsePromise = promise;
      }),
      stopImmediatePropagation: vi.fn(),
    });

    const response = await responsePromise;
    expect(response?.status).toBe(303);
    expect(response?.headers.get("location")).toBe("/home/garden?shareTargetError=invalid");
    expect(cacheFor("gg-share-inbox-v1").put).not.toHaveBeenCalled();
  });
});
