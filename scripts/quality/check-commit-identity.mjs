#!/usr/bin/env node
/**
 * Refuse commits authored or committed under an address reserved for tests.
 *
 * A test fixture once leaked its identity into the repository's shared git config, and every
 * commit made afterwards carried it; 42 of them were only noticed two weeks later, 28 after they
 * had already merged. `scripts/lib/dev-shared.js` keeps that from happening again on a checkout
 * that has it, but nothing stopped such a commit from arriving from somewhere else. This does.
 *
 * Modes:
 *   --pending            the identity git would use for the commit being made (the pre-commit hook)
 *   --base <ref>         every commit in <ref>..HEAD (local runs and any checkout with history)
 *   --pull-request       the pull request's own commits, read from the API (CI Gate, which checks
 *                        out at depth 1 and so has no range to walk)
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { isReservedTestEmail } from "../lib/dev-shared.js";

const API = "https://api.github.com";

/** Commits whose author or committer address is one no contributor can own. */
export function findTestIdentities(commits) {
  const flagged = [];
  for (const commit of commits) {
    const roles = [];
    if (isReservedTestEmail(commit.authorEmail)) roles.push(`author ${commit.authorName} <${commit.authorEmail}>`);
    if (isReservedTestEmail(commit.committerEmail)) {
      roles.push(`committer ${commit.committerName} <${commit.committerEmail}>`);
    }
    if (roles.length > 0) flagged.push({ ...commit, roles });
  }
  return flagged;
}

/** Parse `git log --format=%H%x1f%an%x1f%ae%x1f%cn%x1f%ce%x1f%s%x1e`. */
export function parseGitLog(output) {
  return output
    .split("\x1e")
    .map((record) => record.replace(/^\r?\n/, ""))
    .filter((record) => record.trim().length > 0)
    .map((record) => {
      const [sha, authorName, authorEmail, committerName, committerEmail, subject] = record.split("\x1f");
      return { sha, authorName, authorEmail, committerName, committerEmail, subject };
    });
}

/** Parse one `git var GIT_AUTHOR_IDENT` line: `Name <email> 1758… -0700`. */
export function parseIdent(line) {
  const match = /^(.*?)\s*<([^>]*)>/.exec(line.trim());
  return match ? { name: match[1], email: match[2] } : { name: "", email: "" };
}

/** Map the GitHub pull-request commits payload onto the shape above. */
export function parsePullRequestCommits(payload) {
  return payload.map((entry) => ({
    sha: entry.sha,
    authorName: entry.commit?.author?.name ?? "",
    authorEmail: entry.commit?.author?.email ?? "",
    committerName: entry.commit?.committer?.name ?? "",
    committerEmail: entry.commit?.committer?.email ?? "",
    subject: (entry.commit?.message ?? "").split("\n")[0],
  }));
}

function git(args, { cwd = process.cwd() } = {}) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.error?.message ?? result.stderr?.trim()}`);
  }
  return result.stdout;
}

export function commitsInRange(base, { cwd = process.cwd() } = {}) {
  return parseGitLog(git(["log", `${base}..HEAD`, "--format=%H%x1f%an%x1f%ae%x1f%cn%x1f%ce%x1f%s%x1e"], { cwd }));
}

export function pendingIdentity({ cwd = process.cwd() } = {}) {
  const author = parseIdent(git(["var", "GIT_AUTHOR_IDENT"], { cwd }));
  const committer = parseIdent(git(["var", "GIT_COMMITTER_IDENT"], { cwd }));
  return [
    {
      sha: "(the commit being made)",
      authorName: author.name,
      authorEmail: author.email,
      committerName: committer.name,
      committerEmail: committer.email,
      subject: "",
    },
  ];
}

async function pullRequestCommits({ token, repository, pullNumber }) {
  const commits = [];
  for (let page = 1; page <= 10; page++) {
    const response = await fetch(`${API}/repos/${repository}/pulls/${pullNumber}/commits?per_page=100&page=${page}`, {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "user-agent": "green-goods-commit-identity-check",
      },
    });
    if (!response.ok) throw new Error(`GitHub API ${response.status} for pull request ${pullNumber}`);
    const payload = await response.json();
    commits.push(...parsePullRequestCommits(payload));
    if (payload.length < 100) break;
  }
  return commits;
}

export function report(flagged, { log = console.error } = {}) {
  log("Commits made under an address reserved for tests:");
  for (const commit of flagged) {
    // The pending check has no hash yet, so it labels itself instead.
    const label = /^[0-9a-f]{7,40}$/i.test(commit.sha) ? commit.sha.slice(0, 9) : commit.sha;
    log(`  ${label} ${commit.subject}`.trimEnd());
    for (const role of commit.roles) log(`      ${role}`);
  }
  log("");
  log("That address belongs to a test fixture, not a person, so the work is credited to nobody.");
  log("Check this repository's config first, because a fixture may have written it:");
  log("  git config --local --get-regexp '^(user\\.|commit\\.gpgsign|core\\.bare)'");
  log("Then re-author the commits, from the branch they are on:");
  log("  git rebase <base> --exec 'git commit --amend --no-edit \\");
  log('    --author="$(git config --global user.name) <$(git config --global user.email)>"\'');
}

async function main(argv) {
  const mode = argv.find((argument) => argument.startsWith("--")) ?? "--pending";
  let commits;
  if (mode === "--pending") {
    commits = pendingIdentity();
  } else if (mode === "--base") {
    const base = argv[argv.indexOf("--base") + 1];
    if (!base) throw new Error("--base requires a git ref");
    commits = commitsInRange(base);
  } else if (mode === "--pull-request") {
    const token = process.env.GITHUB_TOKEN;
    const repository = process.env.REPO;
    const pullNumber = process.env.PR_NUMBER;
    if (!token || !repository || !pullNumber) throw new Error("GITHUB_TOKEN, REPO and PR_NUMBER are required");
    commits = await pullRequestCommits({ token, repository, pullNumber });
  } else {
    throw new Error(`Unknown option: ${mode}`);
  }

  const flagged = findTestIdentities(commits);
  if (flagged.length === 0) return 0;
  report(flagged);
  return 1;
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirectRun) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 2;
    });
}
