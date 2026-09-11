import { mkdir, mkdtemp, realpath, rename, rm, writeFile } from "node:fs/promises";
import { get } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer, type ViteDevServer } from "vite";
import { afterEach, describe, expect, it } from "vitest";
import { resolveViteWatchOptions, VITE_POLL_INTERVAL_MS } from "../../vite/watch";

async function waitFor<T>(read: () => Promise<T | undefined>, timeoutMs = 5_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await read();
    if (result !== undefined) return result;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Timed out waiting for Vite HMR evidence");
}

async function request(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    get(url, { headers: { "cache-control": "no-cache" } }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => resolve(body));
    }).on("error", reject);
  });
}

describe("Vite watch configuration", () => {
  it("keeps direct Vite runs native unless polling is explicitly enabled", () => {
    expect(resolveViteWatchOptions({})).toEqual({ ignored: ["**/dev-dist/**"] });
    expect(resolveViteWatchOptions({ VITE_USE_POLLING: "false" })).toEqual({
      ignored: ["**/dev-dist/**"],
    });
    expect(resolveViteWatchOptions({ VITE_USE_POLLING: "true" })).toEqual({
      ignored: ["**/dev-dist/**"],
      usePolling: true,
      interval: VITE_POLL_INTERVAL_MS,
    });
  });
});

describe("polling-backed Vite invalidation", () => {
  let fixtureRoot: string | undefined;
  let server: ViteDevServer | undefined;
  let socket: WebSocket | undefined;

  afterEach(async () => {
    socket?.close();
    await server?.close();
    if (fixtureRoot) await rm(fixtureRoot, { recursive: true, force: true });
  });

  it("updates canonical client and imported shared transforms after in-place and atomic edits", async () => {
    fixtureRoot = await realpath(await mkdtemp(path.join(tmpdir(), "green-goods-vite-watch-")));
    const checkoutRoot = path.join(fixtureRoot, "checkout");
    const clientRoot = path.join(checkoutRoot, "packages/client");
    const clientSource = path.join(clientRoot, "src/probe.ts");
    const sharedRoot = path.join(checkoutRoot, "packages/shared/src");
    const sharedSource = path.join(sharedRoot, "i18n/probe.json");
    // Derived from the fixture layout: the import-seam guard reads source text, and this is probe content.
    const sharedSpecifier = path
      .relative(path.dirname(clientSource), sharedSource)
      .split(path.sep)
      .join("/");
    const clientContents = (value: string) =>
      `import shared from "${sharedSpecifier}";\n` +
      `export const clientProbe = ${JSON.stringify(value)};\n` +
      "export const sharedProbe = shared.value;\n" +
      "if (import.meta.hot) import.meta.hot.accept();\n";

    await mkdir(path.dirname(clientSource), { recursive: true });
    await mkdir(path.dirname(sharedSource), { recursive: true });
    await writeFile(clientSource, clientContents("client-before"));
    await writeFile(sharedSource, '{"value":"shared-before"}\n');

    const watch = resolveViteWatchOptions({ VITE_USE_POLLING: "true" });
    server = await createServer({
      configFile: false,
      root: clientRoot,
      logLevel: "silent",
      optimizeDeps: { noDiscovery: true },
      server: {
        host: "127.0.0.1",
        port: 0,
        strictPort: false,
        fs: { allow: [checkoutRoot] },
        watch,
      },
    });
    await server.listen();
    expect(server.config.server.watch).toMatchObject({
      usePolling: true,
      interval: VITE_POLL_INTERVAL_MS,
    });

    const address = server.httpServer?.address();
    if (!address || typeof address === "string") throw new Error("Vite did not expose a port");
    const origin = `http://127.0.0.1:${address.port}`;
    const clientUrl = `${origin}/src/probe.ts`;
    const sharedUrl = `${origin}/@fs${sharedSource}?import`;
    const hmrMessages: Array<Record<string, unknown>> = [];

    socket = new WebSocket(
      `ws://127.0.0.1:${address.port}/?token=${server.config.webSocketToken}`,
      "vite-hmr"
    );
    socket.addEventListener("message", (event) => {
      hmrMessages.push(JSON.parse(String(event.data)) as Record<string, unknown>);
    });
    await waitFor(async () =>
      hmrMessages.some((message) => message.type === "connected") ? true : undefined
    );

    const clientBefore = await request(clientUrl);
    const sharedBefore = await request(sharedUrl);
    expect(clientBefore).toContain("client-before");
    expect(sharedBefore).toContain("shared-before");

    const beforeClientMessages = hmrMessages.length;
    await writeFile(clientSource, clientContents("client-after"));
    const clientAfter = await waitFor(async () => {
      const response = await request(clientUrl);
      return response.includes("client-after") ? response : undefined;
    });
    expect(clientAfter).toContain("client-after");
    await waitFor(async () =>
      hmrMessages.slice(beforeClientMessages).some((message) => message.type === "update")
        ? true
        : undefined
    );

    const beforeSharedMessages = hmrMessages.length;
    const replacement = `${sharedSource}.replacement`;
    await writeFile(replacement, '{"value":"shared-atomic"}\n');
    await rename(replacement, sharedSource);
    const sharedAfter = await waitFor(async () => {
      const response = await request(sharedUrl);
      return response.includes("shared-atomic") ? response : undefined;
    });
    expect(sharedAfter).toContain("shared-atomic");
    await waitFor(async () =>
      hmrMessages.slice(beforeSharedMessages).some((message) => message.type === "update")
        ? true
        : undefined
    );
  });
});
