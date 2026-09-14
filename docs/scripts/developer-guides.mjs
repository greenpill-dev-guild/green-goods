import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import * as yaml from "js-yaml";
import { groups } from "../../scripts/lib/dev-modes.mjs";
import { parseArguments as parseCheck } from "../../scripts/dev/ci-local.js";
import { resolvePackageCommand as resolvePackage } from "../../scripts/dev/package-commands.mjs";
import { resolvePackageCommand as resolveContractPackage } from "../../packages/contracts/script/utils/package-commands.mjs";
import { resolveBrowser } from "../../scripts/dev/browser.js";
import { resolveQa } from "../../scripts/agents/qa.mjs";
import { resolveTests } from "../../scripts/dev/test.js";

function commandWords(value) {
  return (value.match(/"(?:[^"\\]|\\.)*"|'[^']*'|[^\s]+/g) ?? []).map((word) => word.replace(/^(['"])(.*)\1$/, "$2"));
}

export function validateCommandArguments(cwd, name, words, policy = {}) {
  const args = words.filter((word, index) => word !== "--" || index !== 0);
  if (args.some((word) => /[<>$]/.test(word))) return;
  if (!cwd || cwd === ".") {
    if (name === "check") {
      const options = parseCheck(args);
      if (policy.intentOrder?.length && !policy.intentOrder.includes(options.intent)) throw new Error(`Invalid validation intent: ${options.intent}`);
      for (const id of options.checkIds) if (policy.checks?.length && !policy.checks.some((check) => check.id === id)) throw new Error(`Unknown check: ${id}`);
    }
    if (name === "test") resolveTests(args);
    if (name === "browser") resolveBrowser(args);
    if (name === "qa") resolveQa(args);
    if (name === "format") resolvePackage("root", "format", args);
  } else if (cwd === "packages/contracts") {
    const actions = { build: "build", test: "test", "test:fork": "fork", "test:audit": "audit", format: "format", lint: "lint", clean: "clean" };
    if (actions[name]) resolveContractPackage(actions[name], args, {});
  } else if (/^packages\/(admin|client|shared|agent|indexer)$/.test(cwd)) {
    const pkg = cwd.split("/")[1];
    if (["test", "typecheck", "format"].includes(name) || pkg === "indexer" && ["dev", "docker"].includes(name)) resolvePackage(pkg, name, args);
  }
}

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
  const paths = ["README.md", "ONBOARDING.md", "CONTRIBUTING.md", "docs/README.md", "scripts/README.md", "packages/contracts/deployments/README.md", "docs/docs/builders/getting-started.mdx", "docs/docs/builders/env-management.mdx", "docs/docs/builders/how-to-contribute.mdx"];
  const packages = await fs.readdir(path.join(root, "packages"), { withFileTypes: true }).catch(() => []);
  for (const item of packages) if (item.isDirectory()) paths.push(`packages/${item.name}/README.md`);
  return paths;
}

export async function auditDeveloperGuides(root, paths, { resolveContracts } = {}) {
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
        const words = commandWords(match[1].split(" #")[0].trim());
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
        try { validateCommandArguments(path.relative(root, commandCwd), name, words, policy); }
        catch (error) { fail(`Invalid documented arguments for ${name} at line ${lineIndex + 1}: ${error.message}`); }
        if (name === "contracts" && resolveContracts) {
          const args = words.filter((word) => word !== "--");
          // Metavariables are explanatory syntax, not executable examples.
          if (args.length && !args.some((word) => /[<>$]/.test(word))) {
            try { resolveContracts(args); }
            catch (error) { fail(`Invalid documented contract operation at line ${lineIndex + 1}: ${error.message}`); }
          }
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

// Workflow matrix selections are command callers even though the run line has no literal script.
export async function auditWorkflowCommands(root) {
  const issues = [];
  const directory = path.join(root, ".github/workflows");
  const files = await fs.readdir(directory).catch(() => []);
  const manifests = new Map();
  async function validate(name, cwd, filePath) {
    if (!name || name.startsWith("-") || /[${}<>]/.test(name) || /[${}<>]/.test(cwd)) return;
    const manifest = path.join(root, cwd, "package.json");
    if (!manifests.has(manifest)) manifests.set(manifest, JSON.parse(await readOptional(manifest) ?? "null"));
    const data = manifests.get(manifest);
    if (!data || !Object.hasOwn(data.scripts ?? {}, name)) issues.push({ filePath, message: `Unknown workflow command ${name} in ${cwd || "root"}` });
  }
  for (const name of files.filter((file) => /\.ya?ml$/.test(file))) {
    const filePath = `.github/workflows/${name}`;
    const workflow = yaml.load(await fs.readFile(path.join(directory, name), "utf8"));
    for (const job of Object.values(workflow?.jobs ?? {})) {
      const base = job.defaults?.run?.["working-directory"] ?? workflow.defaults?.run?.["working-directory"] ?? "";
      for (const step of job.steps ?? []) {
        let cwd = step["working-directory"] ?? base;
        for (const line of (step.run ?? "").split("\n")) {
          const cd = line.match(/^\s*cd\s+([\w./-]+)/);
          if (cd) cwd = path.normalize(path.join(cwd, cd[1]));
          for (const match of line.matchAll(/\bbun(?: --no-env-file)? run (?:--cwd ([\w./-]+) )?(\$\{\{\s*matrix\.(\w+)\s*\}\}|[\w:-]+)/g)) {
            const commandCwd = match[1] ? path.join(cwd, match[1]) : cwd;
            if (match[3]) {
              const matrix = job.strategy?.matrix ?? {};
              let rows = [{}];
              for (const [key, values] of Object.entries(matrix)) {
                if (["include", "exclude"].includes(key) || !Array.isArray(values)) continue;
                rows = rows.flatMap((row) => values.map((value) => ({ ...row, [key]: value })));
              }
              rows = [...rows, ...(matrix.include ?? [])].filter((row) => !(matrix.exclude ?? []).some((excluded) => Object.entries(excluded).every(([key, value]) => row[key] === value)));
              for (const row of rows) {
                if (row[match[3]] === undefined) continue;
                const resolvedCwd = commandCwd.replace(/\$\{\{\s*matrix\.(\w+)\s*\}\}/g, (expression, key) => row[key] ?? expression);
                await validate(String(row[match[3]]).split(/\s+/)[0], resolvedCwd, filePath);
              }
            } else await validate(match[2], commandCwd, filePath);
          }
        }
      }
    }
  }
  return issues;
}

const callerEvidenceExclusions = new Set([
  "packages/contracts/config/command-migration.json", // Historical invocation evidence.
  "docs/docs/builders/packages/contract-operations.mdx", // Generated historical migration table.
  "docs/docs/builders/packages/commands.mdx", // Generated repository-wide migration table.
  "docs/scripts/developer-guides.test.mjs", // Deliberately invalid caller fixtures below.
  "scripts/data/command-migration.json", // Baseline and replacement evidence, never runtime policy.
]);

function isHistoricalCommandEvidence(filePath) {
  return filePath.startsWith("docs/reports/") ||
    /^packages\/contracts\/config\/[^/]+\/[^/]*\d{4}-\d{2}-\d{2}[^/]*\.(?:json|md)$/.test(filePath);
}

export async function auditRetiredCommandCallers(root, paths) {
  const raw = await readOptional(path.join(root, "packages/contracts/config/command-migration.json"));
  const consolidatedRaw = await readOptional(path.join(root, "scripts/data/command-migration.json"));
  if (raw === null && consolidatedRaw === null) return [];
  const contractEntries = raw === null ? [] : JSON.parse(raw).entries;
  const consolidatedEntries = consolidatedRaw === null ? [] : JSON.parse(consolidatedRaw).entries;
  const entries = [
    ...contractEntries,
    ...consolidatedEntries.filter((entry) => entry.status === "replacement"),
  ];
  const manifestForScope = { root: "package.json", contracts: "packages/contracts/package.json", docs: "docs/package.json" };
  const retiredByManifest = new Map();
  for (const entry of entries) {
    const manifest = entry.manifest ?? manifestForScope[entry.scope];
    if (!manifest) continue;
    if (!retiredByManifest.has(manifest)) retiredByManifest.set(manifest, new Set());
    retiredByManifest.get(manifest).add(entry.name);
  }
  const issues = [];
  const manifestScripts = new Map();
  async function currentScripts(manifest) {
    if (!manifestScripts.has(manifest)) manifestScripts.set(manifest, JSON.parse(await readOptional(path.join(root, manifest)) ?? "{}").scripts ?? {});
    return manifestScripts.get(manifest);
  }
  const sourceManifest = (filePath) => {
    const packageMatch = filePath.match(/^(packages\/[^/]+|docs)\//);
    return packageMatch ? `${packageMatch[1]}/package.json` : "package.json";
  };
  const files = paths ?? execFileSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
  for (const filePath of new Set(files)) {
    // Plan Hubs and dated reports are execution history, never audit inputs. Do not open them.
    if (filePath.startsWith(".plans/") || isHistoricalCommandEvidence(filePath) || callerEvidenceExclusions.has(filePath)) continue;
    if (path.basename(filePath).startsWith(".env") || !/\.(?:[cm]?[jt]sx?|sh|ya?ml|toml|json|mdx?)$/.test(filePath) && path.basename(filePath) !== "package.json") continue;
    const text = await readOptional(path.join(root, filePath));
    if (text === null) continue;
    const fail = (name, index) => issues.push({ filePath, message: `Retired command caller ${name} at line ${text.slice(0, index).split("\n").length}` });
    const defaultManifest = sourceManifest(filePath);
    const checkRetired = async (name, manifest, index) => {
      if (!retiredByManifest.get(manifest)?.has(name)) return;
      if (Object.hasOwn(await currentScripts(manifest), name)) return;
      fail(name, index);
    };
    // Explicit package working directories are unambiguous.
    for (const match of text.matchAll(/\bbun(?: --no-env-file)? run --cwd ([\w./-]+) ([\w:.-]+)/g)) {
      const directory = path.normalize(match[1]).replace(/^\.\//, "");
      await checkRetired(match[2], `${directory}/package.json`, match.index);
    }
    // Other invocations inherit the owning file's package; root guides and tooling inherit root.
    for (const match of text.matchAll(/\bbun(?: --no-env-file)? (?:run )?([\w:.-]+)(?=[\s`\"\';&|]|$)/g)) {
      if (match[1] === "--cwd") continue;
      await checkRetired(match[1], defaultManifest, match.index);
    }
    // Structured subprocess argv: ['bun', 'run', 'old'] or args: ['run', 'old'].
    for (const match of text.matchAll(/["']run["']\s*,\s*(?:["']--cwd["']\s*,\s*["']([^"']+)["']\s*,\s*)?["']([\w:-]+)["']/g)) {
      const manifest = match[1] ? `${path.normalize(match[1]).replace(/^\.\//, "")}/package.json` : defaultManifest;
      await checkRetired(match[2], manifest, match.index);
    }
    // Explicit package invocations also occur in validation policy and harness configuration.
    for (const match of text.matchAll(/\bbun(?: --no-env-file)? run --cwd ([\w/.-]+) ([\w:-]+)/g)) {
      const manifest = await readOptional(path.join(root, match[1], "package.json"));
      if (manifest && !Object.hasOwn(JSON.parse(manifest).scripts ?? {}, match[2])) {
        issues.push({ filePath, message: `Unknown package caller ${match[2]} in ${match[1]}` });
      }
    }
    if (path.basename(filePath) === "package.json") {
      const scope = filePath === "package.json" ? "root" : filePath === "docs/package.json" ? "docs" : filePath === "packages/contracts/package.json" ? "contracts" : null;
      const scripts = JSON.parse(text).scripts ?? {};
      for (const entry of entries) {
        const matchesManifest = entry.manifest ? entry.manifest === filePath : entry.scope === scope;
        if (matchesManifest && Object.hasOwn(scripts, entry.name)) issues.push({ filePath, message: `Retired alias restored in manifest: ${entry.name}` });
      }
    }
  }
  return issues;
}

/** Admission is about ownership and consumers, not a numerical script ceiling. */
export async function auditCommandPolicy(root) {
  const raw = await readOptional(path.join(root, "scripts/data/command-policy.json"));
  if (raw === null) return [];
  const policy = JSON.parse(raw);
  const migration = JSON.parse(await readOptional(path.join(root, "scripts/data/command-migration.json")) ?? '{"entries":[]}');
  const issues = [];
  const manifests = ["package.json", ...Object.keys(policy.packages ?? {})];
  for (const filePath of manifests) {
    const manifest = JSON.parse(await readOptional(path.join(root, filePath)) ?? "{}");
    const scripts = manifest.scripts ?? {};
    const allowed = filePath === "package.json" ? Object.keys(policy.root ?? {}) : policy.packages[filePath];
    const exception = (name) => (policy.exceptions ?? []).find((item) => item.manifest === filePath && item.name === name && item.owner && item.reason && item.consumer);
    for (const [name, command] of Object.entries(scripts)) {
      const fail = (message) => issues.push({ filePath, message: `${name}: ${message}` });
      if (!allowed.includes(name) && !exception(name)) fail("Unregistered command; declare ownership and a durable consumer in command policy");
      if (filePath === "package.json") {
        const entry = policy.root?.[name];
        if (!exception(name) && (!entry?.owner || !entry?.purpose || !entry?.consumer || /package\.json/.test(entry.consumer))) fail("Root command needs an independent purpose, owner, and consumer");
      }
      if (!exception(name) && /^bun run (?:--cwd [\w/.-]+ )?[\w:-]+(?:\s+--[^;&|]*)?$/.test(command)) fail("Plain forwarding alias; use the owning command and arguments");
      if (!exception(name) && Object.entries(scripts).some(([other, value]) => other !== name && command.startsWith(`${value} --`))) fail("Option-only alias; expose the option on its owning command");
      if (migration.entries.some((entry) => entry.manifest === filePath && entry.name === name && entry.status === "replacement")) fail("Retired alias restored");
    }
    for (const name of allowed) if (!Object.hasOwn(scripts, name)) issues.push({ filePath, message: `Registered command is missing: ${name}` });
  }
  return issues;
}
