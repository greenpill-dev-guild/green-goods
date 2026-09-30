import { createHash, webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installGreenGoodsWorker } from "@/sw/worker";

type Listener = (event: Record<string, unknown>) => void;

function shellDigest(entries: Array<[asset: string, contents: string]>): string {
  const digestInput = entries
    .map(([asset, contents]) => `${asset}\0${createHash("sha256").update(contents).digest("hex")}`)
    .join("\n");
  return createHash("sha256").update(digestInput).digest("hex").slice(0, 16);
}

function shellManifest(entries: Array<[asset: string, contents: string]>) {
  const assets = entries.map(([asset]) => asset);
  const digest = shellDigest(entries);
  return {
    version: 3,
    digest,
    assets,
    criticalDigest: digest,
    criticalAssets: assets,
    priorityDigest: shellDigest([]),
    priorityAssets: [],
    tailDigest: shellDigest([]),
    tailAssets: [],
  };
}

function splitShellManifest(
  criticalEntries: Array<[asset: string, contents: string]>,
  tailEntries: Array<[asset: string, contents: string]>,
  priorityEntries: Array<[asset: string, contents: string]> = []
) {
  const criticalAssets = criticalEntries.map(([asset]) => asset);
  const priorityAssets = priorityEntries.map(([asset]) => asset);
  const tailAssets = tailEntries.map(([asset]) => asset);
  const entries = [...criticalEntries, ...priorityEntries, ...tailEntries].sort(([left], [right]) =>
    left.localeCompare(right)
  );
  return {
    version: 3,
    digest: shellDigest(entries),
    assets: entries.map(([asset]) => asset),
    criticalDigest: shellDigest(criticalEntries),
    criticalAssets,
    priorityDigest: shellDigest(priorityEntries),
    priorityAssets,
    tailDigest: shellDigest(tailEntries),
    tailAssets,
  };
}

async function loadServiceWorker(
  locationHref = "https://www.greengoods.app/sw.js",
  sharedCacheStores?: Map<string, Map<string, Response>>
) {
  const listeners: Record<string, Listener[]> = {};
  const cacheStores = sharedCacheStores ?? new Map<string, Map<string, Response>>();
  const cacheObjects = new Map<
    string,
    {
      addAll: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      keys: ReturnType<typeof vi.fn>;
      match: ReturnType<typeof vi.fn>;
      put: ReturnType<
        typeof vi.fn<(request: RequestInfo | URL, response: Response) => Promise<void>>
      >;
    }
  >();
  const keyFor = (request: RequestInfo | URL) =>
    new URL(
      typeof request === "string" ? request : request instanceof URL ? request.href : request.url,
      locationHref
    ).href;
  const cacheFor = (name: string) => {
    let cache = cacheObjects.get(name);
    if (cache) return cache;
    const store = cacheStores.get(name) ?? new Map<string, Response>();
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
    openWindow: vi.fn().mockResolvedValue(undefined),
  };
  const caches = {
    keys: vi.fn(async () => [...cacheStores.keys()]),
    delete: vi.fn().mockResolvedValue(true),
    has: vi.fn(async (name: string) => cacheStores.has(name)),
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
    registration: { showNotification: vi.fn().mockResolvedValue(undefined) },
  };

  // The worker reads these off the global scope at call time, the way it does
  // inside a real ServiceWorkerGlobalScope.
  vi.stubGlobal("caches", caches);
  vi.stubGlobal("fetch", fetchMock);
  installGreenGoodsWorker(self as unknown as Parameters<typeof installGreenGoodsWorker>[0]);

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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("client public service worker migration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("leaves every navigation to the precache router", async () => {
    const { fetchMock, listeners } = await loadServiceWorker();
    const respondWith = vi.fn();

    // The worker is scoped to /home, so an app navigation is the only kind it sees.
    listeners.fetch[0]({
      request: htmlNavigationRequest("https://www.greengoods.app/home"),
      respondWith,
    });

    expect(respondWith).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("waits for an explicit update prompt before activating a fresh worker", async () => {
    const { cacheFor, fetchMock, listeners, self } = await loadServiceWorker();
    const indexHtml = '<!doctype html><div id="root"></div>';
    const digest = shellDigest([["/index.html", indexHtml]]);
    let installation: Promise<unknown> | undefined;
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(shellManifest([["/index.html", indexHtml]])), {
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

    const waitUntil = vi.fn();
    // A prompt with no reply port still carries the (empty) port list.
    listeners.message?.[0]?.({ data: { type: "SKIP_WAITING" }, ports: [], waitUntil });
    await waitUntil.mock.calls[0][0];

    expect(self.skipWaiting).toHaveBeenCalledTimes(1);
  });

  it("acknowledges activation without claiming that skipWaiting completed the update", async () => {
    const { self, listeners } = await loadServiceWorker();
    const postMessage = vi.fn();
    const waitUntil = vi.fn();
    listeners.message[0]({ data: { type: "SKIP_WAITING" }, ports: [{ postMessage }], waitUntil });
    expect(postMessage).toHaveBeenCalledWith({ type: "GG_UPDATE_ACK", status: "received" });
    await waitUntil.mock.calls[0][0];
    expect(postMessage).toHaveBeenLastCalledWith({ type: "GG_UPDATE_ACK", status: "requested" });
    self.skipWaiting.mockRejectedValueOnce(new Error("blocked"));
    listeners.message[0]({ data: { type: "SKIP_WAITING" }, ports: [{ postMessage }], waitUntil });
    await waitUntil.mock.calls[1][0];
    expect(postMessage).toHaveBeenLastCalledWith({ type: "GG_UPDATE_ACK", status: "rejected" });
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

  it("serves unvisited route chunks offline after one complete shell install", async () => {
    const { fetchMock, listeners } = await loadServiceWorker();
    const routes = ["profile", "garden", "work-detail", "wizard", "drawer"];
    const entries: Array<[string, string]> = routes.map((route) => [
      `/assets/${route}.js`,
      `export const route = "${route}"`,
    ]);
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "/pwa-shell-assets.json") {
        return new Response(JSON.stringify(shellManifest(entries)));
      }
      const code = entries.find(([asset]) => asset === url)?.[1];
      return new Response(code, { headers: { "content-type": "application/javascript" } });
    });
    let installation: Promise<unknown> | undefined;
    listeners.install[0]({
      waitUntil: (promise: Promise<unknown>) => {
        installation = promise;
      },
    });
    await installation;

    fetchMock.mockReset().mockRejectedValue(new TypeError("Failed to fetch"));
    for (const [asset, code] of entries) {
      let response: Promise<Response> | undefined;
      const event = {
        request: new Request(`https://www.greengoods.app${asset}`),
        respondWith: (promise: Promise<Response>) => {
          response = promise;
        },
        stopImmediatePropagation: vi.fn(),
      };
      listeners.fetch.forEach((listener) => listener(event));
      expect(await (await response)?.text()).toBe(code);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rolls back a failed shell install without replacing the active metadata", async () => {
    const { cacheFor, caches, fetchMock, listeners } = await loadServiceWorker();
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...shellManifest([["/assets/missing.js", "expected"]]),
          digest: "0000000000000000",
          criticalDigest: "0000000000000000",
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
    expect(cacheFor("gg-pwa-metadata-v2").put).not.toHaveBeenCalled();
  });

  it("rejects a shell whose fetched bytes do not match the manifest digest", async () => {
    const { cacheFor, caches, fetchMock, listeners } = await loadServiceWorker();
    const expectedCode = "export const release = 'expected'";
    const digest = shellDigest([["/assets/app.js", expectedCode]]);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(shellManifest([["/assets/app.js", expectedCode]])), {
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
    expect(cacheFor("gg-pwa-metadata-v2").put).not.toHaveBeenCalled();
  });

  it("never deletes the active shell cache when the manifest digest is unchanged", async () => {
    const { cacheFor, caches, fetchMock, listeners } = await loadServiceWorker();
    const digest = shellDigest([["/assets/app.js", "export const app = true"]]);
    const cacheName = `gg-pwa-shell-${digest}`;
    const putShellMetadata = cacheFor("gg-pwa-metadata-v2").put as unknown as (
      request: RequestInfo | URL,
      response: Response
    ) => Promise<void>;
    await putShellMetadata(
      "/__gg_pwa_shell_active__",
      new Response(JSON.stringify({ cacheName, digest, criticalReady: true }), {
        headers: { "content-type": "application/json" },
      })
    );
    // The shell the record describes has to exist for the record to be worth
    // trusting; seeding only the metadata describes a broken install, not this
    // one.
    await (
      cacheFor(cacheName).put as unknown as (
        request: RequestInfo | URL,
        response: Response
      ) => Promise<void>
    )(
      "/assets/app.js",
      new Response("export const app = true", {
        headers: { "content-type": "application/javascript" },
      })
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(shellManifest([["/assets/app.js", "export const app = true"]])), {
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

  it("reinstalls when the metadata names a shell cache that is gone", async () => {
    // Reachable by deploy, rollback, then roll forward: the reverted worker
    // sweeps shell caches and leaves this record behind. Trusting it would
    // install nothing and then let activation delete the live shell.
    const { cacheFor, fetchMock, listeners } = await loadServiceWorker();
    const asset = "/assets/app.js";
    const code = "export const app = true";
    const manifest = shellManifest([[asset, code]]);
    const cacheName = `gg-pwa-shell-${manifest.digest}`;
    await (
      cacheFor("gg-pwa-metadata-v2").put as unknown as (
        request: RequestInfo | URL,
        response: Response
      ) => Promise<void>
    )(
      "/__gg_pwa_shell_active__",
      new Response(JSON.stringify({ cacheName, digest: manifest.digest, criticalReady: true }), {
        headers: { "content-type": "application/json" },
      })
    );
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify(manifest), {
          headers: { "content-type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(code, { headers: { "content-type": "application/javascript" } })
      );
    let installation: Promise<unknown> | undefined;

    listeners.install[0]({
      waitUntil: (promise: Promise<unknown>) => {
        installation = promise;
      },
    });
    await installation;

    const matchShell = cacheFor(cacheName).match as unknown as (
      request: RequestInfo | URL
    ) => Promise<Response | undefined>;
    await expect(matchShell(asset).then((response) => response?.text())).resolves.toBe(code);
  });

  it("keeps every shell when activation has no metadata to retain against", async () => {
    const { caches, listeners } = await loadServiceWorker();
    caches.keys.mockResolvedValue(["gg-pwa-shell-live", "gg-pwa-shell-other"]);
    let activation: Promise<unknown> | undefined;

    listeners.activate[0]({ waitUntil: (promise: Promise<unknown>) => (activation = promise) });
    await activation;

    // Sweeping against an empty retention set would delete the shell this page
    // is running from and leave the app with nothing to boot offline.
    expect(caches.delete).not.toHaveBeenCalledWith("gg-pwa-shell-live");
    expect(caches.delete).not.toHaveBeenCalledWith("gg-pwa-shell-other");
  });

  it("retries a critical asset and reuses unchanged content-addressed files", async () => {
    const { cacheFor, caches, fetchMock, listeners } = await loadServiceWorker();
    const reusedAsset = "/assets/vendor-abcdef12.js";
    const retriedAsset = "/index.html";
    const reusedCode = "export const vendor = true";
    const html = '<main id="root"></main>';
    const manifest = splitShellManifest(
      [
        [retriedAsset, html],
        [reusedAsset, reusedCode],
      ],
      []
    );
    await cacheFor("gg-pwa-shell-previous").put(
      reusedAsset,
      new Response(reusedCode, { headers: { "content-type": "application/javascript" } })
    );
    caches.keys.mockResolvedValue(["gg-pwa-shell-previous"]);
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify(manifest), { headers: { "content-type": "application/json" } })
      )
      .mockRejectedValueOnce(new TypeError("temporary"))
      .mockRejectedValueOnce(new TypeError("temporary"))
      .mockResolvedValueOnce(new Response(html, { headers: { "content-type": "text/html" } }));
    let installation: Promise<unknown> | undefined;

    listeners.install[0]({
      waitUntil: (promise: Promise<unknown>) => {
        installation = promise;
      },
    });
    await installation;

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock).not.toHaveBeenCalledWith(reusedAsset, expect.anything());
    expect(cacheFor(`gg-pwa-shell-${manifest.digest}`).put).toHaveBeenCalledWith(
      reusedAsset,
      expect.any(Response)
    );
  });

  it("promotes candidate metadata on activation and retains the previous shell", async () => {
    const { cacheFor, caches, fetchMock, listeners } = await loadServiceWorker();
    const activeMetadata = { cacheName: "gg-pwa-shell-old", digest: "old", criticalReady: true };
    await cacheFor("gg-pwa-metadata-v2").put(
      "/__gg_pwa_shell_active__",
      new Response(JSON.stringify(activeMetadata))
    );
    const entries: Array<[string, string]> = [["/index.html", "<main>new</main>"]];
    const manifest = shellManifest(entries);
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(manifest)))
      .mockResolvedValueOnce(
        new Response(entries[0][1], { headers: { "content-type": "text/html" } })
      );
    let installation: Promise<unknown> | undefined;
    listeners.install[0]({ waitUntil: (promise: Promise<unknown>) => (installation = promise) });
    await installation;
    const matchMetadata = cacheFor("gg-pwa-metadata-v2").match as unknown as (
      request: RequestInfo | URL
    ) => Promise<Response | undefined>;

    await expect(
      matchMetadata("/__gg_pwa_shell_active__").then((response) => response?.json())
    ).resolves.toEqual(activeMetadata);
    caches.keys.mockResolvedValue([
      "gg-pwa-shell-old",
      `gg-pwa-shell-${manifest.digest}`,
      "gg-pwa-shell-older",
    ]);
    let activation: Promise<unknown> | undefined;
    listeners.activate[0]({ waitUntil: (promise: Promise<unknown>) => (activation = promise) });
    await activation;

    await expect(
      matchMetadata("/__gg_pwa_shell_active__").then((response) => response?.json())
    ).resolves.toMatchObject({
      cacheName: `gg-pwa-shell-${manifest.digest}`,
      previousCacheName: "gg-pwa-shell-old",
    });
    expect(caches.delete).not.toHaveBeenCalledWith("gg-pwa-shell-old");
    expect(caches.delete).toHaveBeenCalledWith("gg-pwa-shell-older");
  });

  it("downloads the optional tail only after activation asks for it", async () => {
    const { cacheFor, caches, fetchMock, listeners } = await loadServiceWorker();
    const critical: Array<[string, string]> = [["/index.html", "<main>ready</main>"]];
    const tail: Array<[string, string]> = [
      ["/assets/es-abcdef12.js", "export const locale = 'es'"],
    ];
    const manifest = splitShellManifest(critical, tail);
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(manifest)))
      .mockResolvedValueOnce(
        new Response(critical[0][1], { headers: { "content-type": "text/html" } })
      );
    let installation: Promise<unknown> | undefined;
    listeners.install[0]({ waitUntil: (promise: Promise<unknown>) => (installation = promise) });
    await installation;
    const matchShell = cacheFor(`gg-pwa-shell-${manifest.digest}`).match as unknown as (
      request: RequestInfo | URL
    ) => Promise<Response | undefined>;
    await expect(matchShell(tail[0][0])).resolves.toBeUndefined();

    caches.keys.mockResolvedValue([`gg-pwa-shell-${manifest.digest}`]);
    let activation: Promise<unknown> | undefined;
    listeners.activate[0]({ waitUntil: (promise: Promise<unknown>) => (activation = promise) });
    await activation;
    fetchMock.mockResolvedValueOnce(
      new Response(tail[0][1], { headers: { "content-type": "application/javascript" } })
    );

    await expect(ask(listeners, { type: "PREPARE_PWA_TAIL" })).resolves.toEqual({
      status: "ready",
    });
    await expect(matchShell(tail[0][0]).then((response) => response?.text())).resolves.toBe(
      tail[0][1]
    );
  });

  it("downloads the offline-ready tier on its own, leaving the send-time tail alone", async () => {
    const { cacheFor, caches, fetchMock, listeners } = await loadServiceWorker();
    const critical: Array<[string, string]> = [["/index.html", "<main>ready</main>"]];
    // What a steward needs to accept work with no signal.
    const priority: Array<[string, string]> = [
      ["/assets/heic-to-abcdef12.js", "export const decode = true"],
    ];
    // Only ever read while online, so it must not ride along.
    const tail: Array<[string, string]> = [
      ["/assets/encoders-99887766.js", "export const encode = true"],
    ];
    const manifest = splitShellManifest(critical, tail, priority);
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(manifest)))
      .mockResolvedValueOnce(
        new Response(critical[0][1], { headers: { "content-type": "text/html" } })
      );
    let installation: Promise<unknown> | undefined;
    listeners.install[0]({ waitUntil: (promise: Promise<unknown>) => (installation = promise) });
    await installation;

    caches.keys.mockResolvedValue([`gg-pwa-shell-${manifest.digest}`]);
    let activation: Promise<unknown> | undefined;
    listeners.activate[0]({ waitUntil: (promise: Promise<unknown>) => (activation = promise) });
    await activation;

    const matchShell = cacheFor(`gg-pwa-shell-${manifest.digest}`).match as unknown as (
      request: RequestInfo | URL
    ) => Promise<Response | undefined>;
    fetchMock.mockResolvedValueOnce(
      new Response(priority[0][1], { headers: { "content-type": "application/javascript" } })
    );

    await expect(ask(listeners, { type: "PREPARE_PWA_PRIORITY" })).resolves.toEqual({
      status: "ready",
    });
    await expect(matchShell(priority[0][0]).then((response) => response?.text())).resolves.toBe(
      priority[0][1]
    );
    await expect(matchShell(tail[0][0])).resolves.toBeUndefined();

    // The tail still has to be asked for separately, and lands in the same shell.
    fetchMock.mockResolvedValueOnce(
      new Response(tail[0][1], { headers: { "content-type": "application/javascript" } })
    );
    await expect(ask(listeners, { type: "PREPARE_PWA_TAIL" })).resolves.toEqual({
      status: "ready",
    });
    await expect(matchShell(tail[0][0]).then((response) => response?.text())).resolves.toBe(
      tail[0][1]
    );
    // The earlier tier survives the later one's metadata write.
    await expect(matchShell(priority[0][0])).resolves.toBeDefined();
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

    const putShellMetadata = cacheFor("gg-pwa-metadata-v2").put as unknown as (
      request: RequestInfo | URL,
      response: Response
    ) => Promise<void>;
    await putShellMetadata(
      "/__gg_pwa_shell_candidate__",
      new Response(
        JSON.stringify({
          cacheName: "gg-pwa-shell-current",
          previousCacheName: "gg-pwa-shell-old",
          tailAssets: [],
          tailReady: true,
        })
      )
    );
    caches.keys.mockResolvedValue([
      "js-cache",
      "image-cache",
      "graphql-cache",
      "gg-image-cache-meta",
      "ipfs-cache",
      "workbox-precache",
      "gg-pwa-shell-old",
      "gg-pwa-shell-older",
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
    expect(caches.delete).toHaveBeenCalledWith("gg-image-cache-meta");
    expect(caches.delete).not.toHaveBeenCalledWith("image-cache");
    expect(caches.delete).not.toHaveBeenCalledWith("ipfs-cache");
    expect(caches.delete).not.toHaveBeenCalledWith("workbox-precache");
    expect(caches.delete).not.toHaveBeenCalledWith("gg-pwa-shell-old");
    expect(caches.delete).toHaveBeenCalledWith("gg-pwa-shell-older");
    expect(caches.delete).not.toHaveBeenCalledWith("gg-pwa-shell-current");
    expect(publicClient.navigate).not.toHaveBeenCalled();
    expect(publicDetailClient.navigate).not.toHaveBeenCalled();
    expect(pwaClient.navigate).not.toHaveBeenCalled();
  });

  it("serves an explicit chunk error when a JS asset resolves to HTML", async () => {
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

    listeners.fetch[0]({ request, respondWith, stopImmediatePropagation });

    expect(respondWith).toHaveBeenCalledTimes(1);
    expect(stopImmediatePropagation).toHaveBeenCalledTimes(1);
    await expect(responsePromise?.then((response) => response.text())).resolves.toContain(
      "Failed to fetch dynamically imported module"
    );
  });

  it("caches successful hashed JavaScript responses in the current shell cache", async () => {
    const { cacheFor, fetchMock, listeners } = await loadServiceWorker();
    const putShellMetadata = cacheFor("gg-pwa-metadata-v2").put as unknown as (
      request: RequestInfo | URL,
      response: Response
    ) => Promise<void>;
    await putShellMetadata(
      "/__gg_pwa_shell_active__",
      new Response(JSON.stringify({ cacheName: "gg-pwa-shell-current" }))
    );
    const request = new Request("https://www.greengoods.app/assets/app-hash.js");
    fetchMock.mockResolvedValueOnce(
      new Response("export const ready = true", {
        headers: { "content-type": "application/javascript" },
      })
    );
    let responsePromise: Promise<Response> | undefined;

    listeners.fetch[0]({
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
const photoUrl =
  "https://greengoods.mypinata.cloud/ipfs/bafkreiphoto?img-width=800&img-format=auto";

function mediaEvent(request: Request) {
  let response: Promise<Response> | undefined;
  const stored: Promise<unknown>[] = [];
  const event = {
    request,
    respondWith: vi.fn((value: Promise<Response>) => {
      response = value;
    }),
    waitUntil: vi.fn((value: Promise<unknown>) => {
      stored.push(value);
    }),
    stopImmediatePropagation: vi.fn(),
  };
  return {
    event,
    response: () => response,
    settled: () => Promise.all(stored),
  };
}

function imageRequest(url: string, headers?: HeadersInit) {
  const request = new Request(url, { headers });
  Object.defineProperty(request, "destination", { value: "image" });
  return request;
}

function ask(listeners: Record<string, Listener[]>, data: Record<string, unknown>) {
  return new Promise<Record<string, unknown>>((resolve) => {
    const pending: Promise<unknown>[] = [];
    listeners.message.forEach((listener) =>
      listener({
        data,
        ports: [{ postMessage: resolve }],
        waitUntil: (promise: Promise<unknown>) => pending.push(promise),
      })
    );
  });
}

describe("IPFS media cache", () => {
  it("answers a photo from the media cache without touching the network", async () => {
    const { cacheFor, fetchMock, listeners } = await loadServiceWorker();
    await cacheFor("ipfs-cache").put(photoUrl, new Response("saved-photo"));
    const { event, response } = mediaEvent(imageRequest(photoUrl));

    listeners.fetch.forEach((listener) => listener(event));

    expect(await (await response())?.text()).toBe("saved-photo");
    expect(event.stopImmediatePropagation).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("leaves photos to the browser during a hand-over and answers them again once it times out", async () => {
    const { cacheFor, fetchMock, listeners } = await loadServiceWorker();
    const media = cacheFor("ipfs-cache");
    let quieted: Promise<unknown> | undefined;
    listeners.message[0]({
      data: { type: "PREPARE_TO_ACTIVATE_UPDATE" },
      ports: [{ postMessage: vi.fn() }],
      waitUntil: (promise: Promise<unknown>) => {
        quieted = promise;
      },
    });
    await quieted;

    // Answering would open an event the waiting worker has to wait out. The
    // browser fetches the photo itself, and no Workbox route sees it either.
    const blocked = mediaEvent(imageRequest("https://ipfs.io/ipfs/during-handover"));
    listeners.fetch.forEach((listener) => listener(blocked.event));
    expect(blocked.event.respondWith).not.toHaveBeenCalled();
    expect(blocked.event.stopImmediatePropagation).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(media.put).not.toHaveBeenCalled();

    listeners.message[0]({ data: { type: "RESUME_BACKGROUND_WORK" }, ports: [] });
    fetchMock.mockResolvedValueOnce(new Response("after-timeout"));
    const resumed = mediaEvent(imageRequest("https://ipfs.io/ipfs/after-timeout"));
    listeners.fetch.forEach((listener) => listener(resumed.event));
    await resumed.response();
    await resumed.settled();

    expect(media.put).toHaveBeenCalledTimes(1);
  });

  it("cancels a gateway read that has not answered when a hand-over asks for quiet", async () => {
    const { fetchMock, listeners } = await loadServiceWorker();
    let upstream: AbortSignal | undefined;
    fetchMock.mockImplementationOnce((_url: string, init: RequestInit) => {
      upstream = init.signal ?? undefined;
      return new Promise((_, reject) =>
        init.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError"))
        )
      );
    });
    const hung = mediaEvent(imageRequest(photoUrl));
    listeners.fetch.forEach((listener) => listener(hung.event));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const outcome = hung.response()?.then(
      () => "answered",
      (error: Error) => error.name
    );

    const ack = await ask(listeners, { type: "PREPARE_TO_ACTIVATE_UPDATE" });

    // Only the worker can give up on it: a page's abort never arrives here.
    expect(upstream?.aborted).toBe(true);
    await expect(outcome).resolves.toBe("AbortError");
    expect(ack).toEqual({
      type: "GG_QUIET_ACK",
      status: "quiet",
      report: { trackedWork: 0, cancelledFetches: 1, pendingResponses: {} },
    });
    // Given up on, not retried without CORS: that would open another event.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("cancels the download behind a photo it is still copying", async () => {
    const { cacheFor, fetchMock, listeners } = await loadServiceWorker();
    let upstream: AbortSignal | undefined;
    fetchMock.mockImplementationOnce(async (_url: string, init: RequestInit) => {
      upstream = init.signal ?? undefined;
      return new Response("photo");
    });
    let releaseWrite!: () => void;
    cacheFor("ipfs-cache").put.mockImplementationOnce(
      () =>
        new Promise<void>((finish) => {
          releaseWrite = finish;
        })
    );
    const copying = mediaEvent(imageRequest(photoUrl));
    listeners.fetch.forEach((listener) => listener(copying.event));
    expect(await (await copying.response())?.text()).toBe("photo");
    await vi.waitFor(() => expect(releaseWrite).toBeDefined());

    const quieting = ask(listeners, { type: "PREPARE_TO_ACTIVATE_UPDATE" });
    await vi.waitFor(() => expect(upstream?.aborted).toBe(true));
    releaseWrite();

    expect((await quieting).report).toMatchObject({ trackedWork: 1, cancelledFetches: 1 });
  });

  it("turns away media work that arrives while a hand-over is draining", async () => {
    const { cacheFor, fetchMock, listeners } = await loadServiceWorker();
    const media = cacheFor("ipfs-cache");
    fetchMock.mockImplementationOnce(async () => new Response("photo"));
    let releaseWrite!: () => void;
    media.put.mockImplementationOnce(
      () =>
        new Promise<void>((finish) => {
          releaseWrite = finish;
        })
    );
    const copying = mediaEvent(imageRequest(photoUrl));
    listeners.fetch.forEach((listener) => listener(copying.event));
    await (await copying.response())?.text();
    await vi.waitFor(() => expect(releaseWrite).toBeDefined());

    // The hand-over is now waiting on that write, so its census is already
    // taken: anything accepted here would never be waited for, but would keep
    // its own message event — and the update — open behind it.
    const quieting = ask(listeners, { type: "PREPARE_TO_ACTIVATE_UPDATE" });
    const sweep = await ask(listeners, { type: "MEDIA_SWEEP", budgetBytes: 1_000, keep: [] });
    const stats = await ask(listeners, { type: "MEDIA_STATS" });
    const policy = await ask(listeners, { type: "MEDIA_POLICY", budgetBytes: 1_000, keep: [] });

    expect(sweep).toEqual({ bytes: 0, count: 0, failed: true });
    expect(stats).toEqual({ bytes: 0, count: 0, failed: true });
    expect(policy).toEqual({ failed: true });

    releaseWrite();
    const ack = await quieting;
    expect(ack.status).toBe("quiet");
    // The turned-away messages left nothing behind for the next worker to wait on.
    expect(ack.report).toMatchObject({ trackedWork: 1 });
  });

  it("still forwards a page's own abort where the browser reports one", async () => {
    const { fetchMock, listeners } = await loadServiceWorker();
    let upstream: AbortSignal | undefined;
    fetchMock.mockImplementationOnce((_url: string, init: RequestInit) => {
      upstream = init.signal ?? undefined;
      return new Promise(() => {});
    });
    const page = new AbortController();
    const request = new Request(photoUrl, { signal: page.signal });
    listeners.fetch.forEach((listener) => listener(mediaEvent(request).event));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    expect(upstream?.aborted).toBe(false);
    page.abort();

    expect(upstream?.aborted).toBe(true);
  });

  it("names a response it still owes after going quiet", async () => {
    const { fetchMock, listeners } = await loadServiceWorker();
    fetchMock.mockImplementationOnce(() => new Promise(() => {}));
    const chunk = mediaEvent(new Request("https://www.greengoods.app/assets/Profile-abc123.js"));
    listeners.fetch.forEach((listener) => listener(chunk.event));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const ack = await ask(listeners, { type: "PREPARE_TO_ACTIVATE_UPDATE" });

    // A module the page is waiting for is never cancelled, only reported.
    expect(ack.report).toEqual({
      trackedWork: 0,
      cancelledFetches: 0,
      pendingResponses: { asset: 1 },
    });
  });

  it("leaves other images to the browser during a hand-over, and only then", async () => {
    const { listeners } = await loadServiceWorker();
    const before = mediaEvent(imageRequest("https://avatars.example/photo.png"));
    listeners.fetch[0](before.event);
    // Workbox's image route has to see it: nothing is stopped while accepting.
    expect(before.event.stopImmediatePropagation).not.toHaveBeenCalled();

    await ask(listeners, { type: "PREPARE_TO_ACTIVATE_UPDATE" });
    const during = mediaEvent(imageRequest("https://avatars.example/photo.png"));
    listeners.fetch[0](during.event);
    expect(during.event.respondWith).not.toHaveBeenCalled();
    expect(during.event.stopImmediatePropagation).toHaveBeenCalled();

    // Modules, the probe and the share target are answered throughout.
    const chunk = mediaEvent(new Request("https://www.greengoods.app/assets/Home-abc123.js"));
    listeners.fetch[0](chunk.event);
    expect(chunk.event.respondWith).toHaveBeenCalled();
  });

  it("goes back to answering photos by itself if the page never says the hand-over ended", async () => {
    const { cacheFor, listeners } = await loadServiceWorker();
    await cacheFor("ipfs-cache").put(photoUrl, new Response("saved-photo"));
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      await ask(listeners, { type: "PREPARE_TO_ACTIVATE_UPDATE" });
      const quiet = mediaEvent(imageRequest(photoUrl));
      listeners.fetch.forEach((listener) => listener(quiet.event));
      expect(quiet.event.respondWith).not.toHaveBeenCalled();

      // A page that closed mid-hand-over sends no RESUME_BACKGROUND_WORK.
      vi.setSystemTime(Date.now() + 15_001);
      const later = mediaEvent(imageRequest(photoUrl));
      listeners.fetch.forEach((listener) => listener(later.event));

      expect(await (await later.response())?.text()).toBe("saved-photo");
    } finally {
      vi.useRealTimers();
    }
  });

  it("hands the photo to the page before the stored copy is written", async () => {
    const { cacheFor, fetchMock, listeners } = await loadServiceWorker();
    fetchMock.mockResolvedValueOnce(
      new Response("photo", { headers: { "content-type": "image/webp", vary: "Accept" } })
    );
    const media = cacheFor("ipfs-cache");
    let releaseWrite!: () => void;
    const writeStarted = new Promise<void>((started) => {
      media.put.mockImplementationOnce(
        () =>
          new Promise<void>((finish) => {
            started();
            releaseWrite = finish;
          })
      );
    });
    const { event, response, settled } = mediaEvent(
      imageRequest(photoUrl, { accept: "image/avif,image/webp" })
    );

    listeners.fetch.forEach((listener) => listener(event));

    expect(await (await response())?.text()).toBe("photo");
    await writeStarted;
    releaseWrite();
    await settled();
    expect(fetchMock).toHaveBeenCalledWith(
      photoUrl,
      expect.objectContaining({ mode: "cors", credentials: "omit" })
    );
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ accept: "image/avif,image/webp" });
    const [, copy] = media.put.mock.calls[0];
    expect(copy.headers.get("content-length")).toBe("5");
    expect(copy.headers.get("content-type")).toBe("image/webp");
    expect(copy.headers.get("vary")).toBeNull();
    expect(Number(copy.headers.get("x-gg-stored-at"))).toBeGreaterThan(0);
  });

  it("serves the app's own download of a photo to a later image request", async () => {
    const { cacheStores, fetchMock, listeners } = await loadServiceWorker();
    fetchMock.mockResolvedValueOnce(new Response("prepared"));
    const download = mediaEvent(new Request(photoUrl));
    listeners.fetch.forEach((listener) => listener(download.event));
    await (await download.response())?.text();
    await download.settled();

    fetchMock.mockClear();
    const display = mediaEvent(imageRequest(photoUrl));
    listeners.fetch.forEach((listener) => listener(display.event));

    expect(await (await display.response())?.text()).toBe("prepared");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cacheStores.get("ipfs-cache")?.has(photoUrl)).toBe(true);
  });

  it("reads through photos the previous worker prepared and keeps them in the media cache", async () => {
    const { cacheFor, cacheStores, fetchMock, listeners } = await loadServiceWorker();
    await cacheFor("gg-prepared-media-v1").put(
      photoUrl,
      new Response("legacy-photo", { headers: { "content-type": "image/jpeg" } })
    );
    fetchMock.mockRejectedValue(new TypeError("offline"));
    const { event, response, settled } = mediaEvent(imageRequest(photoUrl));

    listeners.fetch.forEach((listener) => listener(event));

    expect(await (await response())?.text()).toBe("legacy-photo");
    await settled();
    expect(await cacheStores.get("ipfs-cache")?.get(photoUrl)?.clone().text()).toBe("legacy-photo");
    expect(fetchMock).not.toHaveBeenCalled();
    // Moved, not copied. Keeping both stored every reopened photo twice, and
    // the bulk drain only runs after a preparation run the device may never
    // complete — so the duplicate set had no bound.
    expect(cacheStores.get("gg-prepared-media-v1")?.has(photoUrl)).toBe(false);
  });

  it("keeps the prepared photo when it could not be admitted to the media cache", async () => {
    const { cacheFor, cacheStores, fetchMock, listeners } = await loadServiceWorker();
    await cacheFor("gg-prepared-media-v1").put(
      photoUrl,
      new Response("legacy-photo", { headers: { "content-type": "image/jpeg" } })
    );
    // A budget of zero admits nothing, so the copy never lands.
    await ask(listeners, { type: "MEDIA_POLICY", budgetBytes: 1, keep: [] });
    fetchMock.mockRejectedValue(new TypeError("offline"));
    const { event, response, settled } = mediaEvent(imageRequest(photoUrl));

    listeners.fetch.forEach((listener) => listener(event));
    expect(await (await response())?.text()).toBe("legacy-photo");
    await settled();

    // Deleting on a failed store would lose the only copy of the photo.
    expect(cacheStores.get("gg-prepared-media-v1")?.has(photoUrl)).toBe(true);
  });

  it("leaves ranged audio and video requests and other hosts to the network", async () => {
    const { listeners } = await loadServiceWorker();
    const ranged = mediaEvent(new Request(photoUrl, { headers: { range: "bytes=0-" } }));
    const avatar = mediaEvent(imageRequest("https://avatars.example/photo.png"));

    listeners.fetch[0](ranged.event);
    listeners.fetch[0](avatar.event);

    expect(ranged.event.respondWith).not.toHaveBeenCalled();
    expect(avatar.event.respondWith).not.toHaveBeenCalled();
  });

  it("still shows a photo from a gateway without CORS, but does not keep it", async () => {
    const { cacheFor, fetchMock, listeners } = await loadServiceWorker();
    fetchMock
      .mockRejectedValueOnce(new TypeError("CORS"))
      .mockResolvedValueOnce(new Response("opaque-display"));
    const request = imageRequest(photoUrl);
    const { event, response, settled } = mediaEvent(request);

    listeners.fetch.forEach((listener) => listener(event));

    expect(await (await response())?.text()).toBe("opaque-display");
    await settled();
    // The second try is cancellable by a hand-over as well.
    expect(fetchMock).toHaveBeenLastCalledWith(request, { signal: expect.any(AbortSignal) });
    expect(cacheFor("ipfs-cache").put).not.toHaveBeenCalled();
  });

  it("removes the oldest unprotected copies when the app asks for a sweep", async () => {
    const { cacheFor, listeners } = await loadServiceWorker();
    const media = cacheFor("ipfs-cache");
    const copy = (bytes: number, storedAt: number) =>
      new Response("x".repeat(bytes), {
        headers: { "content-length": String(bytes), "x-gg-stored-at": String(storedAt) },
      });
    await media.put("https://ipfs.io/ipfs/oldest", copy(40, 1));
    await media.put("https://ipfs.io/ipfs/kept", copy(40, 2));
    await media.put("https://ipfs.io/ipfs/newest", copy(40, 3));

    const stats = await ask(listeners, {
      type: "MEDIA_SWEEP",
      budgetBytes: 80,
      keep: ["https://ipfs.io/ipfs/kept"],
    });

    expect(stats).toEqual({ bytes: 80, count: 2 });
    expect(media.delete).toHaveBeenCalledTimes(1);
    expect((media.delete.mock.calls[0][0] as Request).url).toBe("https://ipfs.io/ipfs/oldest");
  });

  it("reports stored bytes without removing anything", async () => {
    const { cacheFor, listeners } = await loadServiceWorker();
    const media = cacheFor("ipfs-cache");
    await media.put(
      "https://ipfs.io/ipfs/one",
      new Response("12345", { headers: { "content-length": "5" } })
    );

    await expect(ask(listeners, { type: "MEDIA_STATS" })).resolves.toEqual({
      bytes: 5,
      count: 1,
    });
    expect(media.delete).not.toHaveBeenCalled();
  });

  it("serializes a byte scan with an overlapping media write", async () => {
    const { cacheFor, fetchMock, listeners } = await loadServiceWorker();
    const media = cacheFor("ipfs-cache");
    const oldUrl = "https://ipfs.io/ipfs/old-before-scan";
    await media.put(
      oldUrl,
      new Response("x".repeat(40), {
        headers: { "content-length": "40", "x-gg-stored-at": "1" },
      })
    );
    await ask(listeners, { type: "MEDIA_POLICY", budgetBytes: 100, keep: [] });
    let releaseScan!: () => void;
    const scanStarted = new Promise<void>((resolve) => {
      media.keys.mockImplementationOnce(
        () =>
          new Promise<Request[]>((finish) => {
            resolve();
            releaseScan = () => finish([new Request(oldUrl)]);
          })
      );
    });

    const stats = ask(listeners, { type: "MEDIA_STATS" });
    await scanStarted;
    const newUrl = "https://ipfs.io/ipfs/new-during-scan";
    fetchMock.mockResolvedValueOnce(new Response("y".repeat(70)));
    const pendingWrite = mediaEvent(imageRequest(newUrl));
    listeners.fetch.forEach((listener) => listener(pendingWrite.event));
    await pendingWrite.response();
    await Promise.resolve();

    // The initial fixture write is the only put until the scan releases the
    // shared byte-accounting lock.
    expect(media.put).toHaveBeenCalledTimes(1);
    releaseScan();
    await stats;
    await pendingWrite.settled();
    await expect(ask(listeners, { type: "MEDIA_STATS" })).resolves.toEqual({
      bytes: 70,
      count: 1,
    });
  });

  it("advertises the media cache contract to the installed app", async () => {
    const { listeners } = await loadServiceWorker();

    await expect(ask(listeners, { type: "OFFLINE_CONTENT_CAPABILITIES" })).resolves.toEqual({
      offlineContentVersion: 4,
    });
  });

  it("persists protected photos and rejects new copies above the shared budget", async () => {
    const first = await loadServiceWorker();
    const keptUrl = "https://ipfs.io/ipfs/kept-between-workers";
    await first.cacheFor("ipfs-cache").put(
      keptUrl,
      new Response("x".repeat(60), {
        headers: { "content-length": "60", "x-gg-stored-at": "1" },
      })
    );
    await ask(first.listeners, { type: "MEDIA_POLICY", budgetBytes: 80, keep: [keptUrl] });

    const restarted = await loadServiceWorker(
      "https://www.greengoods.app/sw.js",
      first.cacheStores
    );
    const newUrl = "https://ipfs.io/ipfs/new-after-restart";
    restarted.fetchMock.mockResolvedValueOnce(
      new Response("y".repeat(40), { headers: { "content-type": "image/jpeg" } })
    );
    const { event, response, settled } = mediaEvent(imageRequest(newUrl));
    restarted.listeners.fetch.forEach((listener) => listener(event));

    expect(await (await response())?.text()).toHaveLength(40);
    await settled();
    expect(restarted.cacheStores.get("ipfs-cache")?.has(keptUrl)).toBe(true);
    expect(restarted.cacheStores.get("ipfs-cache")?.has(newUrl)).toBe(false);
  });

  it("bypasses even an existing cached reachability probe", async () => {
    const { cacheFor, listeners, fetchMock } = await loadServiceWorker();
    const url = "https://www.greengoods.app/connectivity-check.txt";
    await cacheFor("old-worker").put(url, new Response("cached"));
    let result: Promise<Response> | undefined;
    listeners.fetch.forEach((listener) =>
      listener({
        request: new Request(url),
        respondWith: (response: Promise<Response>) => {
          result = response;
        },
        stopImmediatePropagation: vi.fn(),
      })
    );
    expect(await (await result)?.text()).toBe("network");
    expect(fetchMock.mock.calls[0][0].cache).toBe("no-store");
  });
});
