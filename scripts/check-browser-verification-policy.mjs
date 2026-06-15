#!/usr/bin/env bun

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const repoRoot = process.cwd();
const requiredPolicyFiles = ["AGENTS.md", "CLAUDE.md", "packages/admin/AGENTS.md", "packages/client/AGENTS.md", "packages/shared/AGENTS.md"];
const staleGuidanceRoots = [
  "AGENTS.md",
  "CLAUDE.md",
  "packages",
  "docs",
  ".claude/skills",
  ".agents/skills",
  "scripts/README.md",
];
const ignoredDirectories = new Set([
  '.git',
  '.cache',
  '.next',
  'node_modules',
  'dist',
  'build',
  'build-storybook',
  'output',
]);
const scannedMarkdownExtensions = new Set(['.md', '.mdx']);

const failures = [];

function fail(message) {
  failures.push(message);
}

function read(relPath) {
  return readFileSync(join(repoRoot, relPath), 'utf8');
}

function shouldScanFile(path) {
  const name = path.split('/').at(-1);
  return name === 'AGENTS.md' || name === 'CLAUDE.md' || scannedMarkdownExtensions.has(extname(path));
}

function walkGuidanceFiles(dir, result = []) {
  if (!existsSync(dir)) return result;
  const rootStat = statSync(dir);
  if (rootStat.isFile()) {
    if (shouldScanFile(dir)) result.push(dir);
    return result;
  }

  for (const entry of readdirSync(dir)) {
    if (ignoredDirectories.has(entry)) continue;
    const fullPath = join(dir, entry);
    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      walkGuidanceFiles(fullPath, result);
    } else if (shouldScanFile(fullPath)) {
      result.push(fullPath);
    }
  }
  return result;
}

for (const relPath of requiredPolicyFiles) {
  if (!existsSync(join(repoRoot, relPath))) {
    fail(`${relPath}: missing required authenticated-browser QA policy file`);
    continue;
  }

  const text = read(relPath);
  for (const phrase of [
    'authenticated Brave QA profile',
    'Codex browser-extension path',
    'Claude Code Chrome/Chromium extension path',
    'authenticated Brave profile/tab',
    'Do not use isolated Browser, Playwright, or DevTools MCP profiles for local QA',
    'If authenticated Brave access is blocked, stop and report QA as blocked',
  ]) {
    if (!text.includes(phrase)) {
      fail(`${relPath}: missing required authenticated-browser QA phrase "${phrase}"`);
    }
  }
}

const stalePatterns = [
  /Browser verification has two lanes/i,
  /Use isolated browser proof/i,
  /deterministic public[-/ ](route|website|app|login)/i,
  /For local human\/agent browser walkthroughs[^\n]*isolated/i,
  /prefer Brave with an isolated/i,
  /use Brave with an\s+isolated/i,
  /shared posture Brave-first/i,
  /Use `bun run agentic:browser-proof/i,
  /Build-backed browser proof:\s*`bun run agentic:browser-proof`/i,
  /Brave MCP live DOM/i,
  /Brave-backed browser MCP/i,
  /Brave-backed DevTools MCP/i,
  /DevTools MCP path for live browser debugging/i,
  /Use Brave DevTools MCP when/i,
  /Use Brave DevTools MCP only as an additional proof pass/i,
  /use isolated DevTools MCP only/i,
  /isolated\/public proof lane/i,
  /browser proof still runs in Brave/i,
  /only when the authenticated QA browser is Chrome\/Edge/i,
  /Brave-only QA/i,
  /Chrome\/Edge QA profiles/i,
  /for Brave-only QA/i,
];

const staleGuidanceFiles = [
  ...new Set(staleGuidanceRoots.flatMap((root) => walkGuidanceFiles(join(repoRoot, root)))),
];

for (const filePath of staleGuidanceFiles) {
  const relPath = relative(repoRoot, filePath);
  const text = readFileSync(filePath, 'utf8');
  for (const pattern of stalePatterns) {
    if (pattern.test(text)) {
      fail(`${relPath}: stale isolated-browser QA guidance matched ${pattern}`);
    }
  }
}

const packageJsonPath = join(repoRoot, 'package.json');
if (existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const scripts = packageJson.scripts ?? {};

  if (scripts['check:browser-verification-policy'] !== 'bun scripts/check-browser-verification-policy.mjs') {
    fail('package.json: missing check:browser-verification-policy script');
  }

  if (!scripts['agentic:check']?.includes('check:browser-verification-policy')) {
    fail('package.json: agentic:check must run check:browser-verification-policy');
  }

  const browserProofGuard = 'bun scripts/require-authenticated-browser-qa.mjs && ';

  if (scripts['agentic:browser-proof'] !== 'bun run browser-proof:routes') {
    fail('package.json: agentic:browser-proof must delegate to browser-proof:routes');
  }

  if (!scripts['browser-proof:routes']?.startsWith(browserProofGuard)) {
    fail('package.json: browser-proof:routes must be guarded by require-authenticated-browser-qa.mjs');
  }

  if (
    scripts['agentic:verify'] &&
    scripts['agentic:verify'].includes('ui:verify') &&
    !scripts['agentic:verify'].startsWith('bun scripts/require-authenticated-browser-qa.mjs')
  ) {
    fail('package.json: local agentic:verify browser lane must be guarded by require-authenticated-browser-qa.mjs');
  }
}

if (failures.length > 0) {
  console.error('Authenticated browser QA policy check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Authenticated browser QA policy check passed for ${requiredPolicyFiles.length} guidance file(s).`,
);
