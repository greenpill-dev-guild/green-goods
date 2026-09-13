import fs from "node:fs/promises";
import path from "node:path";
import { groups } from "../../scripts/lib/dev-modes.mjs";

const slug = (text) => text.toLowerCase().replace(/<[^>]*>/g, "").replace(/[^\p{L}\p{N}_\s-]/gu, "").replace(/\s/g, "-");
export function headingIds(text) {
  const ids = new Set();
  const counts = new Map();
  for (const match of text.replace(/```[\s\S]*?```/g, "").matchAll(/^#{1,6}\s+(.+)$/gm)) {
    const explicit = match[1].match(/\{#([^}]+)\}/);
    const base = explicit?.[1] ?? slug(match[1]);
    const count = counts.get(base) ?? 0;
    ids.add(count && !explicit ? `${base}-${count}` : base);
    counts.set(base, count + 1);
  }
  for (const match of text.matchAll(/(?:id|name)=["']([^"']+)["']/g)) ids.add(match[1]);
  return ids;
}

async function readOptional(file) {
  try { return await fs.readFile(file, "utf8"); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

// Only maintained developer entrypoints belong here; dated execution reports are historical.
export async function developerGuidePaths(root) {
  const paths = ["README.md", "ONBOARDING.md", "CONTRIBUTING.md", "docs/README.md", "scripts/README.md", "docs/docs/builders/getting-started.mdx", "docs/docs/builders/env-management.mdx", "docs/docs/builders/how-to-contribute.mdx"];
  const packages = await fs.readdir(path.join(root, "packages"), { withFileTypes: true }).catch(() => []);
  for (const item of packages) if (item.isDirectory()) paths.push(`packages/${item.name}/README.md`);
  return paths;
}

export async function auditDeveloperGuides(root, paths) {
  const issues = [];
  const policy = JSON.parse(await readOptional(path.join(root, "scripts/data/validation-policy.json")) ?? "{}");
  const intents = new Set(policy.intentOrder ?? []);
  const manifests = new Map();
  async function scripts(cwd) {
    if (!manifests.has(cwd)) {
      const raw = await readOptional(path.join(cwd, "package.json"));
      manifests.set(cwd, raw === null ? null : JSON.parse(raw).scripts ?? {});
    }
    return manifests.get(cwd);
  }
  for (const filePath of paths ?? await developerGuidePaths(root)) {
    const file = path.join(root, filePath);
    const text = await readOptional(file);
    if (text === null) continue;
    const fail = (message) => issues.push({ filePath, message });
    const prose = text.replace(/```[\s\S]*?```/g, "");
    for (const match of (filePath.endsWith(".mdx") ? "" : prose).matchAll(/\[[^\]]*\]\((<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\)/g)) {
      const href = match[1].replace(/^<|>$/g, "");
      if (/^(?:[a-z]+:|\/)/i.test(href)) continue;
      const [target, anchor] = href.split("#");
      const resolved = target ? path.resolve(path.dirname(file), decodeURIComponent(target.split("?")[0])) : file;
      let stat;
      try { stat = await fs.stat(resolved); }
      catch { fail(`Local guide target not found: ${href}`); continue; }
      if (anchor && stat.isFile() && /\.mdx?$/.test(resolved)) {
        if (!headingIds(await fs.readFile(resolved, "utf8")).has(decodeURIComponent(anchor))) {
          fail(`Local guide anchor not found: ${href}`);
        }
      }
    }

    // Examples use root cwd unless a shell block explicitly changes it. New package examples
    // should use --cwd so copying one line remains safe outside the surrounding block.
    let cwd = root;
    let fenced = false;
    for (const [lineIndex, line] of text.split("\n").entries()) {
      if (/^```/.test(line)) { fenced = !fenced; cwd = root; continue; }
      if (fenced && /^\s*cd\s+/.test(line)) {
        const directory = line.trim().split(/\s+/)[1];
        if (!/[<$]/.test(directory)) cwd = path.resolve(cwd, directory);
      }
      for (const match of line.matchAll(/\b(?:bun|npm) run ([^`\n;&|]+)/g)) {
        const words = match[1].split(" #")[0].trim().split(/\s+/);
        let commandCwd = cwd;
        if (words[0] === "--cwd") {
          words.shift();
          const directory = words.shift();
          if (!directory || /[<$]/.test(directory)) continue;
          commandCwd = path.resolve(cwd, directory.replace(/^["']|["']$/g, ""));
        }
        // Filtered workspace examples remain owned by their manifests, not root scripts.
        if (words[0]?.startsWith("-")) { fail(`Use an explicit --cwd invocation at line ${lineIndex + 1}`); continue; }
        const name = words.shift();
        if (!name || /[<$]/.test(name)) continue;
        const available = await scripts(commandCwd);
        if (available === null && await scripts(root) !== null) fail(`Documented working directory has no package manifest: ${path.relative(root, commandCwd)}`);
        if (available !== null && !Object.hasOwn(available, name)) {
          fail(`Unknown documented command ${name} in ${path.relative(root, commandCwd) || "root"} at line ${lineIndex + 1}`);
        }
        if (name === "validation:plan") {
          const intent = words.find((word) => word.startsWith("--intent="))?.slice(9) ?? words[words.indexOf("--intent") + 1];
          if (words.some((word) => word.startsWith("--intent")) && intent !== "<intent>" && intents.size && !intents.has(intent)) fail(`Invalid validation intent: ${intent}`);
        }
        if (["dev", "dev:health", "dev:smoke"].includes(name) && commandCwd === root) {
          const args = words.filter((word) => word !== "--");
          const mode = args[0];
          if (mode && !mode.startsWith("-") && !/[<|]/.test(mode)) {
            const allowed = name === "dev" ? [...Object.keys(groups), "help", "status", "stop", ...new Set(Object.values(groups).flat())] : Object.keys(groups);
            if (!allowed.includes(mode)) fail(`Unknown documented development mode: ${mode}`);
          }
        }
      }
      // Mode tables are both human-readable and checked against the launcher's membership.
      const row = line.match(/^\|\s*`?(local|full|fork|web|prod|prod-mirror)`?\s*\|\s*([^|]+)\|/);
      if (row) {
        const services = row[2].replace(/`/g, "").split(/,\s*/).map((value) => value.trim()).sort();
        if (services.every((value) => /^[\w-]+$/.test(value)) && services.join() !== [...groups[row[1]]].sort().join()) fail(`Development mode membership differs from launcher: ${row[1]}`);
      }
    }
    if (/default[^\n]*(?:chain target|dev mode)[^\n]*(?:is|:)\s*(?:an?\s+)?(?:local\s+)?Arbitrum fork/i.test(text)) fail("Default development uses live Arbitrum, not a fork");
  }
  return issues;
}
