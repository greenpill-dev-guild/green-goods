#!/usr/bin/env node

import { existsSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

function removeMaps(directory) {
  if (!existsSync(directory)) return;

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      removeMaps(path);
    } else if (entry.isFile() && entry.name.endsWith(".map")) {
      rmSync(path, { force: true });
    }
  }
}

const directories = process.argv.slice(2);
if (directories.length === 0) {
  console.error("Usage: node scripts/dev/remove-public-sourcemaps.js <dist-dir> [...]");
  process.exit(1);
}

// The PostHog upload lane (scripts/ops/upload-sourcemaps.js) builds with
// GG_ENABLE_SOURCEMAPS=true and needs the emitted .map files to survive until it
// has uploaded them — it deletes them itself afterwards (posthog-cli
// --delete-after). Stripping them here (this script runs at the tail of every
// `bun run build`) would leave the uploader with nothing to find ("No source
// maps found in <dist>"). Every other build — Vercel deploy, local prod build —
// leaves the flag unset, so this still strips the maps before they can be
// published. Kept coupled to the same flag the Vite configs read for emission.
if (process.env.GG_ENABLE_SOURCEMAPS === "true") {
  console.log(
    "GG_ENABLE_SOURCEMAPS=true — retaining source maps for the upload lane (deleted after upload)."
  );
  process.exit(0);
}

for (const directory of directories) {
  removeMaps(resolve(directory));
}
