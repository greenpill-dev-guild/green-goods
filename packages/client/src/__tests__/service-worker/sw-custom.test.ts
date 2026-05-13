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

async function loadServiceWorker() {
  const listeners: Record<string, Listener[]> = {};
  const clients = {
    claim: vi.fn().mockResolvedValue(undefined),
    matchAll: vi.fn().mockResolvedValue([]),
  };
  const caches = {
    keys: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(true),
    match: vi.fn().mockResolvedValue(undefined),
  };
  const fetchMock = vi.fn().mockResolvedValue(new Response("network"));
  const self = {
    addEventListener: vi.fn((type: string, listener: Listener) => {
      listeners[type] = [...(listeners[type] ?? []), listener];
    }),
    clients,
    skipWaiting: vi.fn(),
  };

  vm.runInNewContext(await readFile(swCustomPath, "utf8"), {
    caches,
    console,
    fetch: fetchMock,
    Promise,
    Response,
    self,
    URL,
  });

  return { caches, clients, fetchMock, listeners, self };
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

    listeners.fetch[0]({ request, respondWith, stopImmediatePropagation });

    expect(respondWith).toHaveBeenCalledTimes(1);
    expect(stopImmediatePropagation).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(request, { cache: "reload" });
    await expect(responsePromise?.then((response) => response.text())).resolves.toBe("network");
  });

  it("leaves protected PWA navigations on the Workbox app-shell path", async () => {
    const { fetchMock, listeners } = await loadServiceWorker();
    const request = htmlNavigationRequest("https://www.greengoods.app/home");
    const respondWith = vi.fn();

    listeners.fetch[0]({ request, respondWith });

    expect(respondWith).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("activates the deployed service worker without waiting for a manual update prompt", async () => {
    const { listeners, self } = await loadServiceWorker();

    listeners.install[0]({});

    expect(self.skipWaiting).toHaveBeenCalledTimes(1);
  });

  it("refreshes open public website tabs and preserves PWA tabs on activation", async () => {
    const { caches, clients, listeners } = await loadServiceWorker();
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

    caches.keys.mockResolvedValue(["js-cache", "image-cache", "graphql-cache", "workbox-precache"]);
    clients.matchAll.mockResolvedValue([publicClient, publicDetailClient, pwaClient]);

    listeners.activate[0]({
      waitUntil: vi.fn((promise: Promise<unknown>) => {
        activation = promise;
      }),
    });

    await activation;

    expect(clients.claim).toHaveBeenCalledTimes(1);
    expect(caches.delete).toHaveBeenCalledWith("js-cache");
    expect(caches.delete).toHaveBeenCalledWith("graphql-cache");
    expect(caches.delete).not.toHaveBeenCalledWith("image-cache");
    expect(caches.delete).not.toHaveBeenCalledWith("workbox-precache");
    expect(publicClient.navigate).toHaveBeenCalledWith(publicClient.url);
    expect(publicDetailClient.navigate).toHaveBeenCalledWith(publicDetailClient.url);
    expect(pwaClient.navigate).not.toHaveBeenCalled();
  });
});
