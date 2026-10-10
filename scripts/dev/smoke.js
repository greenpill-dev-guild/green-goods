#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { groups, smokeInvocation } from "../lib/dev-modes.mjs";

try {
  const args = process.argv.slice(2);
  if (args.filter((arg) => arg !== "--").every((arg) => arg === "--help" || arg === "-h") && args.length) {
    console.log(`Usage: bun run dev:smoke -- [${Object.keys(groups).join("|")}] [options]\nDefault: local. Options are forwarded to the selected read-only smoke.\nUse <mode> --help for mode-specific options; supported options include --json and --timeout <seconds>.`);
  } else {
    const invocation = smokeInvocation(args);
    const help = args.includes("--help") || args.includes("-h");
    const result = spawnSync(process.execPath, [fileURLToPath(new URL(invocation.script, import.meta.url)), ...invocation.args],
      help ? { encoding: "utf8" } : { stdio: "inherit" });
    if (help) {
      const first = args.filter((arg) => arg !== "--")[0];
      const mode = first && !first.startsWith("-") ? first : "local";
      process.stdout.write((result.stdout || "")
        .replace(/^Usage: node scripts\/dev\/smoke-[\w-]+\.js/, `Usage: bun run dev:smoke -- ${mode}`)
        .replace(/ \[--(?:mode prod\|mirror|core|fork)\]/g, "")
        .replace(/\nModes:[\s\S]*?\nOptions:/, "\nOptions:"));
      if (result.stderr) process.stderr.write(result.stderr);
    }
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
