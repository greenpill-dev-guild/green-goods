#!/usr/bin/env node

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const extensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"];
const ignoredDirs = new Set([
  ".claude",
  ".codex",
  ".git",
  ".turbo",
  ".plans",
  "artifacts",
  "build",
  "cache",
  "coverage",
  "dist",
  "docs",
  "node_modules",
  "out",
  "storybook-static",
]);
const lifecycleStates = new Set(["selected", "implemented", "certified"]);
const criticalities = new Set(["critical", "hotspot"]);
const dependencyCategories = new Set([
  "in-process",
  "local-substitute",
  "owned-remote",
  "true-external",
]);

const argv = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
};
const root = fs.realpathSync(path.resolve(valueAfter("--root") ?? process.cwd()));
const baselinePath = path.resolve(
  valueAfter("--baseline") ?? path.join(root, "scripts/data/direct-tested-seam-baseline.json")
);
const registryPath = path.resolve(
  valueAfter("--registry") ?? path.join(root, "scripts/data/module-seam-registry.json")
);
const jsonOutput = argv.includes("--json");
const printFingerprints = argv.includes("--print-fingerprints");

function posixRelative(target) {
  return path.relative(root, target).split(path.sep).join("/");
}

function canonicalFile(target) {
  try {
    return fs.realpathSync(target);
  } catch {
    return path.resolve(target);
  }
}

function sameFile(left, right) {
  if (!left || !right) return false;
  try {
    const leftStat = fs.statSync(left);
    const rightStat = fs.statSync(right);
    return leftStat.dev === rightStat.dev && leftStat.ino === rightStat.ino;
  } catch {
    return canonicalFile(left) === canonicalFile(right);
  }
}

function walk(directory, files = []) {
  if (!fs.existsSync(directory)) return files;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirs.has(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target, files);
    else if (/\.(?:test|spec)\.(?:[cm]?[jt]sx?)$/.test(entry.name)) files.push(target);
  }
  return files;
}

function existingModule(base) {
  for (const candidate of [base, ...extensions.map((extension) => `${base}${extension}`)]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return canonicalFile(candidate);
  }
  for (const extension of extensions) {
    const candidate = path.join(base, `index${extension}`);
    if (fs.existsSync(candidate)) return canonicalFile(candidate);
  }
  return null;
}

function inferredSubject(testFile) {
  const base = testFile.replace(/\.(?:test|spec)\.(?:[cm]?[jt]sx?)$/, "");
  const candidates = [base];
  const parts = base.split(path.sep);
  if (parts.includes("__tests__")) {
    candidates.push(parts.filter((part) => part !== "__tests__").join(path.sep));
  }
  for (const candidate of candidates) {
    const nestedNamedSubject = existingModule(path.join(candidate, path.basename(candidate)));
    if (nestedNamedSubject && !sameFile(nestedNamedSubject, testFile)) return nestedNamedSubject;
    const subject = existingModule(candidate);
    if (subject && !sameFile(subject, testFile)) return subject;
  }
  return null;
}

function packageIndex() {
  const index = new Map();
  const packagesDir = path.join(root, "packages");
  if (!fs.existsSync(packagesDir)) return index;
  for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const packageDir = path.join(packagesDir, entry.name);
    const manifestPath = path.join(packageDir, "package.json");
    if (!fs.existsSync(manifestPath)) continue;
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      if (typeof manifest.name === "string") {
        index.set(manifest.name, { packageDir, manifestPath, exports: manifest.exports });
      }
    } catch {
      // Invalid package manifests are reported by the repository's package validation.
    }
  }
  return index;
}

const packagesByName = packageIndex();

function firstExportTarget(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const candidate of value) {
      const target = firstExportTarget(candidate);
      if (target) return target;
    }
  }
  if (value && typeof value === "object") {
    for (const key of ["import", "default", "node", "browser", "types"]) {
      const target = firstExportTarget(value[key]);
      if (target) return target;
    }
    for (const candidate of Object.values(value)) {
      const target = firstExportTarget(candidate);
      if (target) return target;
    }
  }
  return null;
}

function packageAndSubpath(specifier) {
  if (specifier.startsWith("@")) {
    const [scope, name, ...rest] = specifier.split("/");
    if (!scope || !name) return null;
    return { packageName: `${scope}/${name}`, subpath: rest.length ? `./${rest.join("/")}` : "." };
  }
  const [name, ...rest] = specifier.split("/");
  return { packageName: name, subpath: rest.length ? `./${rest.join("/")}` : "." };
}

function exportResolution(specifier) {
  const parsed = packageAndSubpath(specifier);
  if (!parsed) return null;
  const packageRecord = packagesByName.get(parsed.packageName);
  if (!packageRecord) return null;
  const exportsMap = packageRecord.exports;
  let exportValue;
  if (typeof exportsMap === "string" && parsed.subpath === ".") exportValue = exportsMap;
  else if (exportsMap && typeof exportsMap === "object") exportValue = exportsMap[parsed.subpath];
  if (exportValue === undefined && exportsMap && typeof exportsMap === "object") {
    for (const [key, value] of Object.entries(exportsMap)) {
      if (!key.includes("*")) continue;
      const [prefix, suffix] = key.split("*");
      if (!parsed.subpath.startsWith(prefix) || !parsed.subpath.endsWith(suffix ?? "")) continue;
      const wildcard = parsed.subpath.slice(prefix.length, parsed.subpath.length - (suffix?.length ?? 0));
      exportValue = JSON.parse(JSON.stringify(value).replaceAll("*", wildcard));
      break;
    }
  }
  const target = firstExportTarget(exportValue);
  if (!target) return null;
  const resolved = existingModule(path.resolve(packageRecord.packageDir, target));
  return resolved
    ? { resolved, manifestPath: canonicalFile(packageRecord.manifestPath), target }
    : null;
}

function resolveSpecifier(specifier, testFile) {
  let base;
  if (specifier.startsWith(".")) base = path.resolve(path.dirname(testFile), specifier);
  else if (specifier.startsWith("@/")) {
    const match = testFile.match(/^(.*[/\\]packages[/\\][^/\\]+)[/\\]/);
    if (match) base = path.join(match[1], "src", specifier.slice(2));
  } else {
    return exportResolution(specifier)?.resolved ?? null;
  }
  return base ? existingModule(base) : null;
}

function mockRanges(source) {
  const ranges = [];
  const pattern = /\bvi\.mock\s*\(/g;
  for (let match; (match = pattern.exec(source)); ) {
    const start = match.index;
    let depth = 0;
    let quote = null;
    let escaped = false;
    let end = source.length;
    for (let index = source.indexOf("(", start); index < source.length; index += 1) {
      const char = source[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === quote) quote = null;
        continue;
      }
      if (char === '"' || char === "'" || char === "`") quote = char;
      else if (char === "(") depth += 1;
      else if (char === ")" && --depth === 0) {
        end = index + 1;
        break;
      }
    }
    const call = source.slice(start, end);
    const specifier = call.match(/vi\.mock\s*\(\s*["']([^"']+)["']/)?.[1];
    ranges.push({ start, end, specifier });
    pattern.lastIndex = end;
  }
  return ranges;
}

function directImports(source, ranges = []) {
  const visible = source
    .split("")
    .map((char, index) => (ranges.some((range) => index >= range.start && index < range.end) ? " " : char))
    .join("");
  const imports = [];
  const patterns = [
    /\b(?:import|export)\s+(?!type\b)(?:[^;"']*?\s+from\s+)?["']([^"']+)["']/g,
    /\b(?:import|require|vi\.importActual)\s*\(\s*["']([^"']+)["']/g,
  ];
  for (const pattern of patterns) {
    for (let match; (match = pattern.exec(visible)); ) imports.push(match[1]);
  }
  return imports;
}

function subjectRecords(testFile, source) {
  const records = [];
  for (const match of source.matchAll(/@direct-test-subject\s+([^\s*]+)/g)) {
    const subject = resolveSpecifier(match[1], testFile);
    if (subject) records.push({ subject, kind: "import" });
  }
  for (const match of source.matchAll(/@direct-test-command\s+([^\s*]+)/g)) {
    const subject = resolveSpecifier(match[1], testFile);
    if (subject) records.push({ subject, kind: "command" });
  }
  if (records.length) return records;
  const subject = inferredSubject(testFile);
  return subject ? [{ subject, kind: "import" }] : [];
}

function analyzeTest(testFile, subject, kind = "import") {
  const source = fs.readFileSync(testFile, "utf8");
  const ranges = mockRanges(source);
  const mocksSubject = ranges.some(
    ({ specifier }) => specifier && sameFile(resolveSpecifier(specifier, testFile), subject)
  );
  const importsSubject = directImports(source, ranges).some(
    (specifier) => sameFile(resolveSpecifier(specifier, testFile), subject)
  );
  const executesSubject =
    kind === "command" && /\bspawn(?:Sync)?\s*\(/.test(source) && source.includes(path.basename(subject));
  return { importsSubject: importsSubject || executesSubject, mocksSubject };
}

function collectDirectTestViolations() {
  const violations = [];
  for (const testFile of walk(root)) {
    const source = fs.readFileSync(testFile, "utf8");
    for (const { subject, kind } of subjectRecords(testFile, source)) {
      const { importsSubject, mocksSubject } = analyzeTest(testFile, subject, kind);
      const relativeTest = posixRelative(testFile);
      const relativeSubject = posixRelative(subject);
      if (mocksSubject) violations.push(`mocked-subject|${relativeTest}|${relativeSubject}`);
      if (!importsSubject) violations.push(`missing-direct-import|${relativeTest}|${relativeSubject}`);
    }
  }
  return [...new Set(violations)].sort();
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function registryFiles(entry, exportInfo) {
  const proof = entry.proof ?? {};
  return [
    entry.modulePath,
    ...(entry.compositionRoots ?? []),
    ...(entry.directConsumers ?? []),
    ...(proof.direct ?? []),
    ...(proof.conformance ?? []),
    ...(proof.integration ?? []),
    exportInfo ? posixRelative(exportInfo.manifestPath) : null,
  ]
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index)
    .sort();
}

function evidenceFingerprint(entry, exportInfo) {
  const hash = createHash("sha256");
  const declaration = {
    id: entry.id,
    owner: entry.owner,
    criticality: entry.criticality,
    modulePath: entry.modulePath,
    publicSpecifier: entry.publicSpecifier,
    interfaceSummary: entry.interfaceSummary,
    dependencyCategory: entry.dependencyCategory,
    compositionRoots: entry.compositionRoots ?? [],
    directConsumers: entry.directConsumers ?? [],
    proof: entry.proof ?? { direct: [], conformance: [], integration: [] },
    exportTarget: exportInfo?.target ?? null,
  };
  hash.update("module-seam-registry-v1\0");
  hash.update(JSON.stringify(declaration));
  for (const relativePath of registryFiles(entry, exportInfo)) {
    const absolutePath = path.join(root, relativePath);
    hash.update(`\0${relativePath}\0`);
    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
      hash.update(fs.readFileSync(absolutePath));
    } else {
      hash.update("<missing>");
    }
  }
  return `sha256:${hash.digest("hex")}`;
}

function fileImportsSubject(relativePath, subject) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) return false;
  const source = fs.readFileSync(absolutePath, "utf8");
  const ranges = mockRanges(source);
  return directImports(source, ranges).some(
    (specifier) => sameFile(resolveSpecifier(specifier, absolutePath), subject)
  );
}

function validateRegistry(registry) {
  const errors = [];
  const fingerprints = {};
  if (!registry || registry.version !== 1 || !Array.isArray(registry.entries)) {
    return { errors: ["registry-invalid-schema|root"], fingerprints };
  }
  const ids = new Set();
  const specifiers = new Set();
  for (const [index, entry] of registry.entries.entries()) {
    const label = typeof entry?.id === "string" && entry.id ? entry.id : `entry-${index}`;
    if (!entry || typeof entry !== "object") {
      errors.push(`registry-invalid-entry|${label}`);
      continue;
    }
    if (ids.has(entry.id)) errors.push(`registry-duplicate-id|${label}`);
    ids.add(entry.id);
    if (specifiers.has(entry.publicSpecifier)) errors.push(`registry-duplicate-specifier|${label}`);
    specifiers.add(entry.publicSpecifier);
    for (const field of ["id", "owner", "modulePath", "publicSpecifier", "interfaceSummary", "reviewedAt"]) {
      if (typeof entry[field] !== "string" || !entry[field]) {
        errors.push(`registry-invalid-field|${label}|${field}`);
      }
    }
    if (!lifecycleStates.has(entry.lifecycle)) errors.push(`registry-invalid-lifecycle|${label}`);
    if (!criticalities.has(entry.criticality)) errors.push(`registry-invalid-criticality|${label}`);
    if (!dependencyCategories.has(entry.dependencyCategory)) {
      errors.push(`registry-invalid-dependency-category|${label}`);
    }
    const exportInfo = exportResolution(entry.publicSpecifier);
    const subject = entry.modulePath ? existingModule(path.join(root, entry.modulePath)) : null;
    if (!subject) errors.push(`registry-missing-module|${label}|${entry.modulePath}`);
    if (!exportInfo) errors.push(`registry-missing-export|${label}|${entry.publicSpecifier}`);
    else if (subject && !sameFile(exportInfo.resolved, subject)) {
      errors.push(`registry-export-target-mismatch|${label}|${entry.publicSpecifier}`);
    }
    for (const field of ["compositionRoots", "directConsumers"]) {
      if (!Array.isArray(entry[field])) errors.push(`registry-invalid-field|${label}|${field}`);
    }
    for (const field of ["direct", "conformance", "integration"]) {
      if (!Array.isArray(entry.proof?.[field])) errors.push(`registry-invalid-proof|${label}|${field}`);
    }
    const tracked = registryFiles(entry, exportInfo);
    for (const relativePath of tracked) {
      if (!fs.existsSync(path.join(root, relativePath))) {
        errors.push(`registry-missing-path|${label}|${relativePath}`);
      }
    }
    const fingerprint = evidenceFingerprint(entry, exportInfo);
    fingerprints[label] = fingerprint;
    if (entry.lifecycle !== "certified") continue;
    if (!(entry.compositionRoots?.length > 0)) errors.push(`registry-missing-composition-root|${label}`);
    if (!(entry.directConsumers?.length > 0)) errors.push(`registry-missing-consumer|${label}`);
    if (!(entry.proof?.direct?.length > 0)) errors.push(`registry-missing-direct-proof|${label}`);
    if (!(entry.proof?.conformance?.length > 0)) errors.push(`registry-missing-conformance-proof|${label}`);
    if (!(entry.proof?.integration?.length > 0)) errors.push(`registry-missing-integration-proof|${label}`);
    if (subject) {
      for (const proofPath of entry.proof?.direct ?? []) {
        const absolutePath = path.join(root, proofPath);
        if (!fs.existsSync(absolutePath)) continue;
        const result = analyzeTest(absolutePath, subject);
        if (result.mocksSubject) errors.push(`registry-self-mocking-proof|${label}|${proofPath}`);
        if (!result.importsSubject) errors.push(`registry-indirect-proof|${label}|${proofPath}`);
      }
      for (const compositionRoot of entry.compositionRoots ?? []) {
        if (fs.existsSync(path.join(root, compositionRoot)) && !fileImportsSubject(compositionRoot, subject)) {
          errors.push(`registry-unwired-composition-root|${label}|${compositionRoot}`);
        }
      }
      for (const consumer of entry.directConsumers ?? []) {
        if (fs.existsSync(path.join(root, consumer)) && !fileImportsSubject(consumer, subject)) {
          errors.push(`registry-indirect-consumer|${label}|${consumer}`);
        }
      }
    }
    if (entry.evidenceFingerprint !== fingerprint) {
      errors.push(`registry-stale-fingerprint|${label}|expected:${fingerprint}`);
    }
  }
  return { errors: [...new Set(errors)].sort(), fingerprints };
}

let registry;
try {
  registry = readJson(registryPath, null);
} catch (error) {
  registry = null;
}
const current = collectDirectTestViolations();
const baseline = readJson(baselinePath, { violations: [] }).violations ?? [];
const expected = [...new Set(baseline)].sort();
const added = current.filter((violation) => !expected.includes(violation));
const stale = expected.filter((violation) => !current.includes(violation));
const registryResult = registry
  ? validateRegistry(registry)
  : { errors: ["registry-missing-file|scripts/data/module-seam-registry.json"], fingerprints: {} };

const report = {
  violations: current,
  added,
  stale,
  registryViolations: registryResult.errors,
  fingerprints: registryResult.fingerprints,
};

if (jsonOutput) console.log(JSON.stringify(report, null, 2));
if (printFingerprints) {
  const structuralErrors = registryResult.errors.filter(
    (error) => !error.startsWith("registry-stale-fingerprint|")
  );
  if (!jsonOutput) {
    for (const [id, fingerprint] of Object.entries(registryResult.fingerprints)) {
      console.log(`${id} ${fingerprint}`);
    }
  }
  if (structuralErrors.length) process.exit(1);
  process.exit(0);
}

if (added.length || stale.length || registryResult.errors.length) {
  if (!jsonOutput) {
    if (added.length) console.error(`New direct-test seam violations:\n- ${added.join("\n- ")}`);
    if (stale.length) console.error(`Stale baseline entries:\n- ${stale.join("\n- ")}`);
    if (registryResult.errors.length) {
      console.error(`Module seam registry violations:\n- ${registryResult.errors.join("\n- ")}`);
    }
  }
  process.exit(1);
}

if (!jsonOutput) {
  const certified = registry.entries.filter((entry) => entry.lifecycle === "certified").length;
  console.log(
    `PASS: ${current.length} known direct-test seam violation(s); ${certified} certified registry seam(s); no drift.`
  );
}
