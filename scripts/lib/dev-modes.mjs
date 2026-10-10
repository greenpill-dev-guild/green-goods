// Shared launch membership and diagnostic routing. No environment or process I/O.
export const groups = {
  local: ["admin", "client", "agent", "indexer"],
  fork: ["anvil-arbitrum", "admin", "client", "agent", "indexer"],
  web: ["docs", "admin", "client", "storybook", "browser"],
  full: ["docs", "admin", "client", "agent", "indexer", "storybook", "browser"],
  prod: ["docs", "admin", "client", "storybook", "browser"],
  "prod-mirror": ["docs", "admin", "client", "indexer", "storybook", "browser"],
};

const modes = Object.keys(groups);
const profiles = new Set(["web", "full", "contracts", "upload", "prod", "prod-mirror"]);

export function parseHealthArgs(argv) {
  const args = argv.filter((arg) => arg !== "--");
  const options = { mode: "local", profile: "full", core: true, fork: false, json: false };
  let explicitMode = false;
  let explicitProfile = false;
  let core = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") { options.help = true; continue; }
    if (arg === "--json") { options.json = true; continue; }
    if (arg === "--core") { core = true; continue; }
    if (arg === "--profile" || arg.startsWith("--profile=")) {
      if (explicitProfile) throw new Error("Specify one profile.");
      options.profile = arg === "--profile" ? args[++index] : arg.slice(10);
      explicitProfile = true;
      if (!profiles.has(options.profile)) throw new Error(`Unknown profile: ${options.profile}`);
      continue;
    }
    if (!explicitMode && modes.includes(arg)) { options.mode = arg; explicitMode = true; continue; }
    throw new Error(`Unknown mode or option: ${arg}`);
  }
  if (explicitProfile && explicitMode) throw new Error("Select either a mode or --profile, not both.");
  if (explicitProfile) {
    options.mode = null;
    options.core = core;
  } else {
    options.profile = ["local", "fork"].includes(options.mode) ? "full" : options.mode;
    options.core = core || ["local", "fork"].includes(options.mode);
    options.fork = options.mode === "fork";
  }
  return options;
}

export function smokeInvocation(argv) {
  const args = argv.filter((arg) => arg !== "--");
  const mode = args[0] && !args[0].startsWith("-") ? args.shift() : "local";
  if (!modes.includes(mode)) throw new Error(`Unknown smoke mode: ${mode}`);
  // Select the mode once; forwarded options must not change its chain/service boundary.
  if (args.some((arg) => ["--mode", "--fork", "--core"].includes(arg) || arg.startsWith("--mode="))) {
    throw new Error("Select the smoke mode with its positional name.");
  }
  if (mode === "web") return { script: "smoke-web.js", args };
  if (mode === "prod" || mode === "prod-mirror") {
    return { script: "smoke-prod.js", args: ["--mode", mode === "prod" ? "prod" : "mirror", ...args] };
  }
  return { script: "smoke-full.js", args: [...(mode === "full" ? [] : ["--core"]), ...(mode === "fork" ? ["--fork"] : []), ...args] };
}
