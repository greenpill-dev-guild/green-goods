export type PlaywrightApp = "admin" | "client";

/**
 * Where the passkey project runs the Agent's loopback reporting driver, beside the Client that
 * proxies `/api/messaging` to it. The port stays clear of 3001 to 3013, which the dev stack and
 * the contracts dual-chain test hold, and of 8787, where a hand-started driver listens.
 */
export const REPORTING_DRIVER_PORT = 3016;
export const REPORTING_DRIVER_URL = `http://127.0.0.1:${REPORTING_DRIVER_PORT}`;

const PROJECT_APPS: Readonly<Record<string, readonly PlaywrightApp[]>> = {
  "admin-ci": ["admin"],
  "anvil-fork": ["client"],
  "client-ci": ["client"],
  "client-full": ["client"],
  chromium: ["admin"],
  "chromium-client": ["client"],
  "critical-path": ["admin", "client"],
  "iphone-16-pro": ["client"],
  "mobile-chrome": ["client"],
  "mobile-safari": ["client"],
  "work-exploration": ["client"],
  "pwa-preview": ["client"],
  "passkey-mock": ["client"],
  performance: ["client"],
  testnet: ["client"],
};

export function selectedProjectNames(argv: readonly string[]): string[] {
  const names: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--project") {
      const value = argv[index + 1];
      if (value) {
        names.push(value);
        index += 1;
      }
      continue;
    }
    if (argument.startsWith("--project=")) {
      const value = argument.slice("--project=".length);
      if (value) names.push(value);
    }
  }

  return names;
}

/**
 * Whether a `--project` selection picks this project. Playwright matches names without regard to
 * case and lets `*` stand for any run of characters, so `passkey-*` selects `passkey-mock`.
 */
export function selectsProject(selectors: readonly string[], project: string): boolean {
  const name = project.toLowerCase();
  return selectors.some((selector) => {
    const parts = selector.toLowerCase().split("*");
    const first = parts[0];
    const last = parts[parts.length - 1];
    if (parts.length === 1) return first === name;
    if (!name.startsWith(first) || name.length < first.length + last.length) return false;
    // The pieces between the stars must follow one another, and the last must end the name.
    let from = first.length;
    for (const piece of parts.slice(1, -1)) {
      const at = name.indexOf(piece, from);
      if (at < 0) return false;
      from = at + piece.length;
    }
    return name.length - last.length >= from && name.endsWith(last);
  });
}

export function resolvePlaywrightApps(
  options: { argv?: readonly string[]; playwrightApp?: string } = {}
): { admin: boolean; client: boolean } {
  const selectedProjects = selectedProjectNames(options.argv ?? process.argv);

  if (selectedProjects.length > 0) {
    const apps = new Set<PlaywrightApp>();
    for (const project of selectedProjects) {
      const projectApps = PROJECT_APPS[project];
      if (!projectApps) {
        // Playwright accepts project-name globs. An unfamiliar selector must stay
        // conservative so a targeted run never omits a service it may require.
        return { admin: true, client: true };
      }
      projectApps.forEach((app) => apps.add(app));
    }
    return { admin: apps.has("admin"), client: apps.has("client") };
  }

  const explicitApp = options.playwrightApp?.toLowerCase();
  if (explicitApp === "admin") return { admin: true, client: false };
  if (explicitApp === "client") return { admin: false, client: true };
  return { admin: true, client: true };
}

export function shouldUsePlaywrightIndexer(env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = (name: string) => env[name]?.toLowerCase() === "true";
  if (flag("SKIP_INDEXER")) return false;
  if (env.CI && !flag("REQUIRE_INDEXER")) return false;
  return true;
}
