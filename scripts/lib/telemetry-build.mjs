import { createHash } from "node:crypto";

function listEntries(value) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * What a browser build hands its bundle so every event says where it came from (PRD-1560): the
 * surface, the release Sentry also reports, and the deployment's test-traffic records. Test
 * gardens go in as addresses; test accounts only as SHA-256 digests of the lowercase address, so
 * the shipped bundle never carries them. Shared reads all four in `modules/app/telemetry-context`.
 */
export function telemetryBuildDefines({ surface, release, env = process.env }) {
  return {
    "import.meta.env.VITE_APP_SURFACE": JSON.stringify(surface),
    "import.meta.env.VITE_TELEMETRY_RELEASE": JSON.stringify(release),
    "import.meta.env.VITE_TELEMETRY_TEST_GARDENS": JSON.stringify(
      listEntries(env.TELEMETRY_TEST_GARDENS).join(",")
    ),
    "import.meta.env.VITE_TELEMETRY_TEST_ACCOUNT_DIGESTS": JSON.stringify(
      listEntries(env.TELEMETRY_TEST_ACCOUNTS).map(sha256Hex).join(",")
    ),
  };
}
