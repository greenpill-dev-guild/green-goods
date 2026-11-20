import { createHash } from "node:crypto";

type Environment = Record<string, string | undefined>;

const ADDRESS = /^0x[0-9a-f]{40}$/;

/**
 * The listed addresses, lowercase. A list with any entry that is not an address is left out
 * whole, so the bundle says "unknown" rather than reading a mistyped account or garden as real.
 */
function addressEntries(name: string, value: string | undefined): string[] {
  const entries = (value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  if (entries.every((entry) => ADDRESS.test(entry))) return entries;
  console.warn(
    `[telemetry-build] ${name} holds an entry that is not an address; its events will say "unknown".`
  );
  return [];
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * What a browser build hands its bundle so every event says where it came from (PRD-1560): the
 * surface, the release Sentry also reports, and the deployment's test-traffic records. Test
 * gardens go in as addresses; test accounts only as SHA-256 digests of the lowercase address, so
 * the shipped bundle never carries them. Shared reads all four in `modules/app/telemetry-context`.
 */
export function telemetryBuildDefines({
  surface,
  release,
  env = process.env,
}: {
  surface: "app" | "admin";
  release: string;
  env?: Environment;
}): Record<string, string> {
  return {
    "import.meta.env.VITE_APP_SURFACE": JSON.stringify(surface),
    "import.meta.env.VITE_TELEMETRY_RELEASE": JSON.stringify(release),
    "import.meta.env.VITE_TELEMETRY_TEST_GARDENS": JSON.stringify(
      addressEntries("TELEMETRY_TEST_GARDENS", env.TELEMETRY_TEST_GARDENS).join(",")
    ),
    "import.meta.env.VITE_TELEMETRY_TEST_ACCOUNT_DIGESTS": JSON.stringify(
      addressEntries("TELEMETRY_TEST_ACCOUNTS", env.TELEMETRY_TEST_ACCOUNTS).map(sha256Hex).join(",")
    ),
  };
}
