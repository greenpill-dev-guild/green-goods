// Helpers for QA runs that attach to a dedicated, already-running QA browser profile over the
// Chrome DevTools Protocol (CDP): the installed-app smoke and the production QA suite. The profile,
// its identities and its private settings live outside the repository; this module only reads them.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Private, per-machine QA profile settings. Garden ids and signer addresses never enter Git. */
export interface QaProfile {
  machine: string;
  /** How the QA browser was declared on this machine, for example "chrome" or "brave-beta". */
  browserChannel: string;
  cdpEndpoint: string;
  appOrigin: string;
  hubOrigin: string;
  gardenName?: string;
  gardenAddress?: string;
  evidenceDir: string;
}

const DEFAULT_EVIDENCE_DIR = fileURLToPath(
  new URL("../../tmp/qa-session/local-profile", import.meta.url)
);

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

/** The debugging connection stays on the QA machine: refuse any endpoint that is not loopback. */
export function assertLoopbackEndpoint(endpoint: string): URL {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error(`CDP endpoint is not a URL: ${endpoint}`);
  }
  if (!["http:", "ws:"].includes(url.protocol) || !LOOPBACK_HOSTS.has(url.hostname)) {
    throw new Error(
      `CDP endpoint must be http or ws on loopback, got ${url.protocol}//${url.host}`
    );
  }
  if (!url.port) throw new Error("CDP endpoint must name the QA profile's port");
  return url;
}

function expandHome(path: string): string {
  return path.startsWith("~/") ? join(homedir(), path.slice(2)) : path;
}

/**
 * Reads the private profile file named by GREEN_GOODS_QA_CONFIG (when set) and applies the
 * environment overrides. GREEN_GOODS_PWA_CDP_ENDPOINT wins over the file's endpoint.
 */
export function loadQaProfile(env: NodeJS.ProcessEnv = process.env): QaProfile {
  const file = env.GREEN_GOODS_QA_CONFIG;
  const fromFile = file
    ? (JSON.parse(readFileSync(expandHome(file), "utf8")) as Partial<QaProfile>)
    : {};
  const profile: QaProfile = {
    machine: fromFile.machine ?? hostname().replace(/\.local$/, ""),
    browserChannel: fromFile.browserChannel ?? "unknown",
    cdpEndpoint: env.GREEN_GOODS_PWA_CDP_ENDPOINT ?? fromFile.cdpEndpoint ?? "",
    appOrigin: fromFile.appOrigin ?? "https://greengoods.app",
    hubOrigin: fromFile.hubOrigin ?? "https://hub.greengoods.app",
    gardenName: fromFile.gardenName,
    gardenAddress: fromFile.gardenAddress?.toLowerCase(),
    // Private evidence stays outside Git: the profile's folder, or the gitignored tmp/ by default.
    evidenceDir: resolve(
      expandHome(env.GREEN_GOODS_QA_EVIDENCE_DIR ?? fromFile.evidenceDir ?? DEFAULT_EVIDENCE_DIR)
    ),
  };
  if (!profile.cdpEndpoint) {
    throw new Error("Set GREEN_GOODS_PWA_CDP_ENDPOINT (or cdpEndpoint in GREEN_GOODS_QA_CONFIG)");
  }
  assertLoopbackEndpoint(profile.cdpEndpoint);
  for (const origin of [profile.appOrigin, profile.hubOrigin]) {
    if (new URL(origin).protocol !== "https:")
      throw new Error(`QA origins must be https: ${origin}`);
  }
  return profile;
}

export interface PageFacts {
  url: string;
  /** display-mode standalone or window-controls-overlay, read inside the page. */
  standalone: boolean;
}

export interface AppWindowChoice<T> {
  app: T;
  tabs: T[];
}

/**
 * Picks the installed app window among the profile's pages: the one page of the app's origin
 * whose display mode is standalone. Ordinary tabs of the same origin are returned separately, so
 * a run can prove it told them apart. Zero or several app windows is an error, never a guess.
 */
export function pickAppWindow<T>(
  pages: { page: T; facts: PageFacts }[],
  appOrigin: string
): AppWindowChoice<T> {
  const ours = pages.filter(({ facts }) => {
    try {
      return new URL(facts.url).origin === appOrigin;
    } catch {
      return false;
    }
  });
  const apps = ours.filter(({ facts }) => facts.standalone);
  if (apps.length === 0) {
    throw new Error(`No installed Green Goods window of ${appOrigin} is open in the QA profile`);
  }
  if (apps.length > 1) {
    throw new Error(`${apps.length} installed Green Goods windows are open; leave exactly one`);
  }
  return {
    app: apps[0].page,
    tabs: ours.filter(({ facts }) => !facts.standalone).map((p) => p.page),
  };
}

/** Analytics and error reports are answered inside the browser, as Scout's lanes do. */
export const KEPT_LOCAL = /^https:\/\/([a-z0-9-]+\.)*(posthog\.com|sentry\.io)\//i;

const SEND_METHODS = new Set([
  "eth_sendrawtransaction",
  "eth_sendtransaction",
  "eth_senduseroperation",
  "wallet_sendcalls",
  "eth_sign",
  "personal_sign",
  "eth_signtypeddata_v4",
]);

export interface RequestFacts {
  method: string;
  url: string;
  postData?: string | null;
}

/**
 * Says why a request would write, or null when it only reads. Reads are GET, HEAD and OPTIONS,
 * JSON-RPC calls that are not sends or signatures, and GraphQL queries. Everything else counts as
 * a write, so an unknown POST fails a read-only run instead of passing quietly.
 */
export function writeReason(request: RequestFacts): string | null {
  const method = request.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return null;
  const host = new URL(request.url).host;
  if (method !== "POST") return `${method} ${host}`;
  let body: unknown;
  try {
    body = request.postData ? JSON.parse(request.postData) : undefined;
  } catch {
    return `POST ${host} (not JSON)`;
  }
  const calls = Array.isArray(body) ? body : [body];
  if (calls.length > 0 && calls.every((call) => typeof call === "object" && call !== null)) {
    const rpc = calls as { jsonrpc?: string; method?: string; query?: string }[];
    if (rpc.every((call) => typeof call.method === "string" && call.jsonrpc)) {
      const send = rpc.find((call) => SEND_METHODS.has(String(call.method).toLowerCase()));
      return send ? `JSON-RPC ${send.method} to ${host}` : null;
    }
    if (rpc.every((call) => typeof call.query === "string")) {
      const mutation = rpc.find((call) => /^\s*mutation\b/i.test(String(call.query)));
      return mutation ? `GraphQL mutation to ${host}` : null;
    }
  }
  return `POST ${host}`;
}

/** "Aqua" for a logged-in desktop session, "Background" over SSH or launchd, else unknown. */
export function observeSessionType(): string {
  if (process.platform !== "darwin") return process.platform;
  try {
    return execFileSync("launchctl", ["managername"], { encoding: "utf8" }).trim() || "unknown";
  } catch {
    return "unknown";
  }
}

/** The browser application listening on the CDP port, read from the process table. */
export function observeBrowserApp(endpoint: string): string {
  const { port } = assertLoopbackEndpoint(endpoint);
  try {
    const pid = execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], {
      encoding: "utf8",
    })
      .split("\n")
      .find(Boolean);
    if (!pid) return "unknown";
    const command = execFileSync("ps", ["-o", "comm=", "-p", pid], { encoding: "utf8" }).trim();
    const app = command.match(/\/([^/]+)\.app\//);
    return app ? app[1] : command.split("/").pop() || "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * The macOS app shim that the Dock, Launchpad or Finder starts for an installed web app. A
 * running shim with a recent start time is the observable trace of a Dock launch.
 */
export function observeAppShim(appName: string): { running: boolean; startedAt?: string } {
  if (process.platform !== "darwin") return { running: false };
  try {
    const rows = execFileSync("ps", ["-axo", "lstart=,command="], { encoding: "utf8" }).split("\n");
    const shim = rows.find((row) => row.includes(`/${appName}.app/Contents/MacOS/`));
    if (!shim) return { running: false };
    return { running: true, startedAt: new Date(shim.slice(0, 24)).toISOString() };
  } catch {
    return { running: false };
  }
}

const RELEASE = /green-goods-(client|admin)@([0-9a-f]{7,40})/;

/** The release a deployment serves, read from its entry script (no browser, no analytics). */
export async function readDeployedRelease(origin: string): Promise<string> {
  try {
    const html = await (await fetch(origin, { redirect: "follow" })).text();
    const entry = html.match(/<script[^>]+type="module"[^>]+src="([^"]+\.js)"/)?.[1];
    if (!entry) return "unknown";
    const script = await (await fetch(new URL(entry, origin))).text();
    return script.match(RELEASE)?.[0] ?? "unknown";
  } catch {
    return "unknown";
  }
}

/** Writes one JSON receipt into the private evidence folder and returns its path. */
export function writeReceipt(dir: string, name: string, receipt: Record<string, unknown>): string {
  const path = join(dir, `${name}.json`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`);
  return path;
}
