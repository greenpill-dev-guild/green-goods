// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { matchRoutes, type LoaderFunctionArgs } from "react-router-dom";
import {
  createSharedLinkLaunchUrl,
  getSharedRecordPath,
  rememberSharedLink,
  takePendingSharedLink,
} from "../../config/sharedLink";
import { publicAppRoutes, pwaAppRoutes } from "../../config/routes";

vi.mock("@green-goods/shared/utils/app/pwa", () => ({ getClientPresentationMode: () => "pwa" }));
vi.mock("@green-goods/shared/hooks/blockchain/prefetch", () => ({ ensureBaseLists: vi.fn() }));
const garden = `0x${"1".repeat(40)}`;
const work = `0x${"2".repeat(64)}`;
const path = `/home/${garden}/work/${work}`;

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

function runLoader(routes: typeof publicAppRoutes, pathname: string) {
  const match = matchRoutes(routes, pathname)
    ?.reverse()
    .find((entry) => typeof entry.route.loader === "function");
  if (!match || typeof match.route.loader !== "function") throw new Error("Missing loader");
  return match.route.loader({
    request: new Request(`https://beta.greengoods.app${pathname}`),
    params: match.params,
    context: undefined,
  } as LoaderFunctionArgs);
}

describe("shared record destinations", () => {
  it("keeps cold browser garden and work links on the matching public record", async () => {
    for (const route of [`/home/${garden}`, path]) {
      const response = (await runLoader(publicAppRoutes, route)) as Response;
      expect(response.headers.get("location")).toBe(route.replace("/home/", "/gardens/"));
      expect(matchRoutes(publicAppRoutes, response.headers.get("location")!)).toHaveLength(3);
    }
  });
  it("rejects external destinations, workflow routes, tokens, and malformed IDs", () => {
    for (const invalid of [
      "//evil.test/home",
      "https://evil.test",
      "/home/share",
      "/home/garden?shareTarget=secret",
      `${path}?token=secret`,
      "/home/not-an-address",
    ]) {
      expect(getSharedRecordPath(invalid, "home")).toBeNull();
    }
  });
  it("resumes an installation at the shared record once, before login", async () => {
    rememberSharedLink(`/gardens/${garden}/work/${work}`);
    const response = (await runLoader(pwaAppRoutes, "/home")) as Response;
    expect(response.headers.get("location")).toBe(path);
    expect(takePendingSharedLink()).toBeNull();
  });
  it("does not redirect a later Home visit back to an explicitly opened record", async () => {
    rememberSharedLink(path);
    expect(await runLoader(pwaAppRoutes, path)).toBeNull();
    expect(takePendingSharedLink()).toBeNull();
  });
  it("expires an abandoned installation and tolerates denied storage", () => {
    rememberSharedLink(path);
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 61 * 60 * 1000);
    expect(takePendingSharedLink()).toBeNull();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Denied");
    });
    expect(() => rememberSharedLink(path)).not.toThrow();
  });
  it("forces a new document for repeated hash-router launches without leaking query state", () => {
    let source = `https://gateway.example/ipfs/cid/?private=secret#/gardens/${garden}`;
    for (let attempt = 0; attempt < 3; attempt++) {
      const next = createSharedLinkLaunchUrl(path, source, true);
      const before = new URL(source);
      const after = new URL(next);
      expect(after.origin).toBe(before.origin);
      expect(after.pathname).toBe(before.pathname);
      expect(after.search).not.toBe(before.search);
      expect(after.searchParams.has("private")).toBe(false);
      expect(after.hash).toBe(`#${path}`);
      source = next;
    }
  });
  it("selects the installed bootstrap after leaving a public hash route", () => {
    const html = readFileSync(resolve(__dirname, "../../../index.html"), "utf8");
    const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
      .map((match) => match[1])
      .find((source) => source.includes("dataset.bootPresentation = mode"));
    expect(script).toBeDefined();
    const presentationAt = (href: string) => {
      const root = { dataset: {} as Record<string, string> };
      runInNewContext(script!, {
        URL,
        document: { documentElement: root },
        navigator: {},
        window: {
          location: { href },
          matchMedia: (query: string) => ({ matches: query === "(display-mode: standalone)" }),
        },
      });
      return root.dataset.bootPresentation;
    };
    const preview = `https://gateway.example/ipfs/cid/#/gardens/${garden}/work/${work}`;
    expect(presentationAt(preview)).toBe("website");
    expect(presentationAt(createSharedLinkLaunchUrl(path, preview, true))).toBe("pwa");
  });
});
