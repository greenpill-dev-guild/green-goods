#!/usr/bin/env node
/**
 * Manual, read-only month-in-review metrics.
 *
 * Usage:
 *   node scripts/ops/month-metrics.mjs --month YYYY-MM [--json]
 *
 * GitHub data is fetched with read-only `gh api graphql`. When that surface is
 * unavailable, the script still returns local/static metrics and clearly marks
 * reviewed-PR coverage unavailable rather than inventing a value.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(SCRIPT_PATH), "../..");
const E2E_SPECS_DIR = join(REPO_ROOT, "tests/specs");
const ACTIVE_PLANS_DIR = join(REPO_ROOT, ".plans/active");

const TEST_DECLARATION_PATTERN = /\b(?:test|it)(?:\.(?:skip|only|fixme|fail))?\s*\(\s*["'`]/g;
const STATIC_SKIP_PATTERN = /\b(?:test|it)\.skip\s*\(\s*["'`]/g;
const RUNTIME_SKIP_PATTERN = /\b(?:test|it)\.skip\s*\(\s*(?!["'`])/g;

const KNOWN_EMAIL_ALIASES = new Map([
  ["afo@greenpill.builders", "afo@greenpill.builders"],
  ["contact@afolabi.info", "afo@greenpill.builders"],
  ["obaone01@gmail.com", "afo@greenpill.builders"],
]);

const PULL_REQUEST_QUERY = `
query MonthMetrics($searchQuery: String!, $cursor: String) {
  search(query: $searchQuery, type: ISSUE, first: 100, after: $cursor) {
    nodes {
      ... on PullRequest {
        number
        author { login }
        mergedAt
        reviews(first: 100) {
          nodes { author { login } state }
        }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

function fail(message) {
  throw new Error(`month-metrics — ${message}`);
}

function countMatches(source, pattern) {
  return source.match(pattern)?.length ?? 0;
}

function percentage(numerator, denominator) {
  if (denominator === 0) return null;
  return (numerator / denominator) * 100;
}

function formatPercentage(value) {
  return value === null ? "n/a" : `${value.toFixed(1)}%`;
}

function runCommand(command, args) {
  return execFileSync(command, args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export function parseArgs(args) {
  let month;
  let json = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--month") {
      month = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      return { help: true, json: false, month: null };
    }
    fail(`unknown argument "${arg}"`);
  }

  if (!month) fail("missing --month YYYY-MM");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    fail(`invalid month "${month}" (expected YYYY-MM)`);
  }

  return { help: false, json, month };
}

export function monthBounds(month) {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const nextMonth = new Date(Date.UTC(year, monthIndex + 1, 1));
  const nextYear = nextMonth.getUTCFullYear();
  const nextMonthNumber = String(nextMonth.getUTCMonth() + 1).padStart(2, "0");

  return {
    firstDay: `${month}-01`,
    lastDay: `${month}-${String(lastDay).padStart(2, "0")}`,
    nextMonth: `${nextYear}-${nextMonthNumber}-01`,
  };
}

export function parseGitHubRepository(remote) {
  const match = remote.trim().match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
  if (!match) fail("could not derive an owner/repository from remote.origin.url");
  return match[1];
}

export function parsePullRequestPage(output) {
  const payload = JSON.parse(output);
  if (payload.errors?.length) fail("GitHub GraphQL returned errors");

  const search = payload.data?.search;
  if (!search) fail("GitHub GraphQL response did not include search data");

  return {
    pullRequests: (search.nodes ?? []).filter((node) => typeof node?.number === "number"),
    pageInfo: search.pageInfo ?? { hasNextPage: false, endCursor: null },
  };
}

export function reviewedPullRequestMetrics(pullRequests) {
  const reviewed = pullRequests.filter((pullRequest) => {
    const author = pullRequest.author?.login?.toLowerCase();
    if (!author) return false;

    return (pullRequest.reviews?.nodes ?? []).some((review) => {
      const reviewer = review.author?.login?.toLowerCase();
      return reviewer && reviewer !== author && review.state !== "PENDING";
    });
  }).length;

  return {
    total: pullRequests.length,
    reviewed,
    percentage: percentage(reviewed, pullRequests.length),
  };
}

export function inspectE2eSpecSources(sources) {
  const totalTests = sources.reduce(
    (total, source) => total + countMatches(source, TEST_DECLARATION_PATTERN),
    0
  );
  const staticSkips = sources.reduce(
    (total, source) => total + countMatches(source, STATIC_SKIP_PATTERN),
    0
  );
  const runtimeGuards = sources.reduce(
    (total, source) => total + countMatches(source, RUNTIME_SKIP_PATTERN),
    0
  );

  return {
    specFiles: sources.length,
    totalTests,
    staticSkips,
    runtimeGuards,
    enabledTests: totalTests - staticSkips,
    enabledPercentage: percentage(totalTests - staticSkips, totalTests),
  };
}

export function normalizeContributorEmail(email) {
  const normalized = email.trim().toLowerCase();
  return KNOWN_EMAIL_ALIASES.get(normalized) ?? normalized;
}

export function parseShortlog(output) {
  return output
    .split("\n")
    .map((line) => line.match(/^\s*(\d+)\s+(.+?)\s+<([^>]+)>$/))
    .filter(Boolean)
    .map((match) => ({
      commits: Number(match[1]),
      name: match[2],
      email: normalizeContributorEmail(match[3]),
    }));
}

export function distinctContributorCount(shortlog) {
  return new Set(shortlog.map((contributor) => contributor.email)).size;
}

export function countActivePlanDirectories(entries) {
  return entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith("_")).length;
}

function listE2eSpecSources(directory) {
  const sources = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      sources.push(...listE2eSpecSources(path));
      continue;
    }
    if (entry.isFile() && extname(entry.name) === ".ts" && entry.name.endsWith(".spec.ts")) {
      sources.push(readFileSync(path, "utf8"));
    }
  }
  return sources;
}

function fetchMergedPullRequests(run, repository, bounds) {
  const searchQuery = `repo:${repository} is:pr is:merged merged:${bounds.firstDay}..${bounds.lastDay}`;
  const pullRequests = [];
  let cursor = null;

  do {
    const args = [
      "api",
      "graphql",
      "-f",
      `query=${PULL_REQUEST_QUERY}`,
      "-f",
      `searchQuery=${searchQuery}`,
    ];
    if (cursor) args.push("-f", `cursor=${cursor}`);

    const page = parsePullRequestPage(run("gh", args));
    pullRequests.push(...page.pullRequests);
    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (cursor);

  return pullRequests;
}

export function ghPrListComparisonCommand(repository, bounds) {
  return `gh pr list --repo ${repository} --state merged --search "merged:${bounds.firstDay}..${bounds.lastDay}" --limit 1000 --json number --jq 'length'`;
}

export function buildMonthReport({
  month,
  run = runCommand,
  repository,
  specSources = listE2eSpecSources(E2E_SPECS_DIR),
  activePlanEntries = readdirSync(ACTIVE_PLANS_DIR, { withFileTypes: true }),
}) {
  const bounds = monthBounds(month);
  const e2e = inspectE2eSpecSources(specSources);
  const contributors = distinctContributorCount(
    parseShortlog(run("git", ["shortlog", "-sne", `--since=${bounds.firstDay}`, `--before=${bounds.nextMonth}`, "HEAD"]))
  );
  const activePlans = countActivePlanDirectories(activePlanEntries);

  const report = {
    month,
    reviewed_prs: {
      available: false,
      reviewed: null,
      total: null,
      percentage: null,
      definition: "Merged pull requests with a non-pending review from someone other than the author.",
    },
    e2e_enabled: {
      ...e2e,
      definition: "Static test/it skip declarations are excluded; runtime skip guards are reported separately.",
    },
    active_plan_directories: activePlans,
    distinct_contributors: contributors,
    comparison_command: null,
  };

  try {
    const resolvedRepository = repository ?? parseGitHubRepository(run("git", ["config", "--get", "remote.origin.url"]));
    const mergedPullRequests = fetchMergedPullRequests(run, resolvedRepository, bounds);
    report.reviewed_prs = {
      available: true,
      ...reviewedPullRequestMetrics(mergedPullRequests),
      definition: "Merged pull requests with a non-pending review from someone other than the author.",
    };
    report.comparison_command = ghPrListComparisonCommand(resolvedRepository, bounds);
  } catch {
    report.reviewed_prs.reason = "GitHub data unavailable; run with authenticated network access to query read-only gh api.";
  }

  return report;
}

export function formatReport(report) {
  const reviewed = report.reviewed_prs.available
    ? `${formatPercentage(report.reviewed_prs.percentage)} (${report.reviewed_prs.reviewed}/${report.reviewed_prs.total})`
    : "unavailable";
  const rows = [
    ["Metric", "Result", "Definition"],
    ["Reviewed PRs", reviewed, report.reviewed_prs.definition],
    [
      "E2E enabled",
      `${formatPercentage(report.e2e_enabled.enabledPercentage)} (${report.e2e_enabled.enabledTests}/${report.e2e_enabled.totalTests})`,
      `${report.e2e_enabled.staticSkips} static skips across ${report.e2e_enabled.specFiles} specs; ${report.e2e_enabled.runtimeGuards} runtime guards reported separately.`,
    ],
    ["Active plan directories", String(report.active_plan_directories), "Top-level non-private directories in .plans/active."],
    ["Distinct contributors", String(report.distinct_contributors), "git shortlog -sne, with known email aliases folded."],
  ];

  const markdownRows = rows.map((row) => `| ${row.join(" | ")} |`);
  markdownRows.splice(1, 0, "| --- | --- | --- |");

  const footer = [];
  if (!report.reviewed_prs.available) footer.push(`Reviewed PR source: ${report.reviewed_prs.reason}`);
  if (report.comparison_command) footer.push(`Read-only population check: ${report.comparison_command}`);

  return [`# Month in review — ${report.month}`, "", ...markdownRows, ...(footer.length ? ["", ...footer] : [])].join("\n");
}

function printUsage() {
  console.log("Usage: node scripts/ops/month-metrics.mjs --month YYYY-MM [--json]");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }

  const report = buildMonthReport({ month: args.month });
  console.log(args.json ? JSON.stringify(report, null, 2) : formatReport(report));
}

if (process.env.NODE_TEST_CONTEXT) {
  test("parses a valid month argument", () => {
    assert.deepEqual(parseArgs(["--month", "2026-06", "--json"]), {
      help: false,
      json: true,
      month: "2026-06",
    });
    assert.throws(() => parseArgs(["--month", "2026-6"]), /invalid month/);
  });

  test("counts reviewed pull requests only when reviewer differs from author", () => {
    const page = parsePullRequestPage(
      JSON.stringify({
        data: {
          search: {
            nodes: [
              {
                number: 1,
                author: { login: "author" },
                reviews: { nodes: [{ author: { login: "author" }, state: "APPROVED" }] },
              },
              {
                number: 2,
                author: { login: "author" },
                reviews: { nodes: [{ author: { login: "reviewer" }, state: "COMMENTED" }] },
              },
              {
                number: 3,
                author: { login: "author" },
                reviews: { nodes: [{ author: { login: "reviewer" }, state: "PENDING" }] },
              },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      })
    );

    const metrics = reviewedPullRequestMetrics(page.pullRequests);
    assert.equal(metrics.total, 3);
    assert.equal(metrics.reviewed, 1);
    assert.ok(Math.abs(metrics.percentage - 100 / 3) < 1e-12);
  });

  test("separates static E2E skips from runtime guards", () => {
    const metrics = inspectE2eSpecSources([
      'test("runs", () => {}); test.skip("static", () => {}); test.skip(true, "runtime");',
      'it("also runs", () => {});',
    ]);

    assert.equal(metrics.specFiles, 2);
    assert.equal(metrics.totalTests, 3);
    assert.equal(metrics.staticSkips, 1);
    assert.equal(metrics.runtimeGuards, 1);
    assert.equal(metrics.enabledTests, 2);
    assert.ok(Math.abs(metrics.enabledPercentage - 200 / 3) < 1e-12);
  });

  test("folds known contributor email aliases without exposing them in the report", () => {
    const contributors = parseShortlog(
      [
        "  4  Afo <contact@afolabi.info>",
        "  3  Afolabi <afo@greenpill.builders>",
        "  2  Afo <obaone01@gmail.com>",
        "  1  Other <other@example.com>",
      ].join("\n")
    );
    const report = formatReport({
      month: "2026-06",
      reviewed_prs: { available: false, reason: "unavailable", definition: "review definition" },
      e2e_enabled: {
        enabledPercentage: 100,
        enabledTests: 2,
        totalTests: 2,
        staticSkips: 0,
        specFiles: 1,
        runtimeGuards: 0,
      },
      active_plan_directories: 2,
      distinct_contributors: distinctContributorCount(contributors),
      comparison_command: null,
    });

    assert.equal(distinctContributorCount(contributors), 2);
    assert.doesNotMatch(report, /@afolabi|@greenpill|@example/);
  });
}

if (!process.env.NODE_TEST_CONTEXT && process.argv[1] && resolve(process.argv[1]) === SCRIPT_PATH) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
