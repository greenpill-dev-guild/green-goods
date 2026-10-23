import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResolvedConfig } from "vite";
import { createPublicLocalesPlugin } from "../../../vite/public-locales";

const temporaryRoots: string[] = [];
afterEach(async () => {
  for (const root of temporaryRoots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function configure(root: string) {
  const plugin = createPublicLocalesPlugin();
  if (typeof plugin.configResolved !== "function") throw new Error("config hook missing");
  await plugin.configResolved.call({} as never, { root } as ResolvedConfig);
  return plugin;
}

async function catalogue(plugin: ReturnType<typeof createPublicLocalesPlugin>, locale: string) {
  if (typeof plugin.resolveId !== "function" || typeof plugin.load !== "function") {
    throw new Error("locale hooks missing");
  }
  const id = await plugin.resolveId.call(
    {} as never,
    `virtual:green-goods-public-locale/${locale}`,
    undefined,
    {} as never
  );
  expect(typeof id).toBe("string");
  const code = await plugin.load.call({ addWatchFile: vi.fn() } as never, id as string, {});
  if (typeof code !== "string") throw new Error("locale module missing");
  return JSON.parse(code.slice("export default ".length, -1)) as Record<string, string>;
}

describe("public locale payloads", () => {
  it.each([
    "en",
    "es",
    "pt",
  ])("retains canonical public and shared UI messages in %s", async (locale) => {
    const root = resolve(import.meta.dirname, "../../..");
    const plugin = await configure(root);
    const messages = await catalogue(plugin, locale);
    const canonical = JSON.parse(
      await readFile(resolve(root, `../shared/src/i18n/${locale}.json`), "utf8")
    );
    for (const [key, value] of Object.entries(canonical)) {
      if (key.startsWith("public.")) expect(messages[key]).toBe(value);
    }
    for (const key of [
      "app.common.close",
      "app.login.button.createAccount",
      "app.toast.install.success.title",
    ]) {
      expect(messages[key]).toBe(canonical[key]);
    }
    expect(messages).not.toHaveProperty("admin.actions.description");
    expect(Object.keys(messages).length).toBeLessThan(Object.keys(canonical).length / 2);
  });

  it("includes dynamic message families without including private-view or test copy", async () => {
    const root = await mkdtemp(join(tmpdir(), "gg-public-locales-"));
    temporaryRoots.push(root);
    const client = join(root, "client");
    for (const directory of [
      "shared/src/i18n",
      "client/src/components",
      "client/src/views/Public",
      "client/src/views/Login",
      "client/src/routes",
      "client/src/config",
    ]) {
      await mkdir(join(root, directory), { recursive: true });
    }
    await writeFile(join(client, "src/bootstrapPublic.tsx"), "");
    await writeFile(join(client, "src/PublicApp.tsx"), "");
    await writeFile(
      join(client, "src/components/Button.tsx"),
      'const label = `app.button.${state}`; const shared = "future.shared.label";' +
        `\n/* "A.${".".repeat(10_000)} */`
    );
    await writeFile(
      join(client, "src/components/Button.test.tsx"),
      'const label = "app.test.only";'
    );
    await writeFile(
      join(root, "shared/src/i18n/en.json"),
      JSON.stringify({
        "public.future.route": "Future public route",
        "app.button.ready": "Ready",
        "app.button.busy": "Busy",
        "future.shared.label": "Shared label",
        "app.test.only": "Test",
        "cockpit.private.view": "Private view",
      })
    );
    const messages = await catalogue(await configure(client), "en");
    expect(messages).toEqual({
      "public.future.route": "Future public route",
      "app.button.ready": "Ready",
      "app.button.busy": "Busy",
      "future.shared.label": "Shared label",
    });
  });
});
