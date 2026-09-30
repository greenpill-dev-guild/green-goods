export type PlaywrightApp = "admin" | "client";

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
