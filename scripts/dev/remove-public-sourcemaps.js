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

for (const directory of directories) {
  removeMaps(resolve(directory));
}
