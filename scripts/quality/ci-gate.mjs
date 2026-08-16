#!/usr/bin/env node

import { selectExpectedWorkflows } from "./select-validation.mjs";

export function expectedWorkflowNames(files) {
  return selectExpectedWorkflows({ changedPaths: files, intent: "merge", ci: true });
}

async function githubJson(token, path) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${response.status} for ${path}: ${body.slice(0, 500)}`);
  }

  return response.json();
}

async function changedFiles(token, repository, pullNumber) {
  const files = [];
  for (let page = 1; ; page += 1) {
    const batch = await githubJson(
      token,
      `/repos/${repository}/pulls/${pullNumber}/files?per_page=100&page=${page}`
    );
    files.push(...batch.map((file) => file.filename));
    if (batch.length < 100) return files;
  }
}

export function latestRunsByName(runs) {
  const latest = new Map();
  for (const run of runs) {
    if (run.name === "CI Gate") continue;
    const current = latest.get(run.name);
    if (!current || run.id > current.id) latest.set(run.name, run);
  }
  return latest;
}

async function workflowRuns(token, repository, headSha) {
  const data = await githubJson(
    token,
    `/repos/${repository}/actions/runs?head_sha=${headSha}&event=pull_request&per_page=100`
  );
  return latestRunsByName(data.workflow_runs);
}

export async function runGate(
  {
    token,
    repository,
    pullNumber,
    headSha,
    maxAttempts = 110,
    intervalMs = 20_000,
  },
  dependencies = {},
) {
  if (!token || !repository || !pullNumber || !headSha) {
    throw new Error("GITHUB_TOKEN, REPO, PR_NUMBER, and HEAD_SHA are required");
  }

  const {
    loadChangedFiles = changedFiles,
    selectWorkflows = expectedWorkflowNames,
    loadWorkflowRuns = workflowRuns,
    wait = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
    logger = console,
  } = dependencies;

  const files = await loadChangedFiles(token, repository, pullNumber);
  const expected = selectWorkflows(files);
  logger.log(`Changed files: ${files.length}`);
  logger.log(`Expected workflows: ${expected.length > 0 ? expected.join(", ") : "(none)"}`);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const runs = await loadWorkflowRuns(token, repository, headSha);
    const missing = expected.filter((name) => !runs.has(name));
    const pending = expected
      .map((name) => runs.get(name))
      .filter((run) => run && run.status !== "completed");
    const failed = expected
      .map((name) => runs.get(name))
      .filter((run) => run?.status === "completed" && run.conclusion !== "success");

    if (failed.length > 0) {
      for (const run of failed) {
        logger.error(`::error::${run.name} concluded ${run.conclusion}: ${run.html_url}`);
      }
      throw new Error(`${failed.length} expected workflow(s) did not succeed`);
    }

    if (missing.length > 0 || pending.length > 0) {
      logger.log(
        `Attempt ${attempt}/${maxAttempts}: missing ${missing.length}, pending ${pending.length}`
      );
      for (const name of missing) logger.log(`  - missing: ${name}`);
      for (const run of pending) logger.log(`  - pending: ${run.name} [${run.status}]`);
      if (attempt < maxAttempts) await wait(intervalMs);
      continue;
    }

    for (const name of expected) {
      const run = runs.get(name);
      logger.log(`  - ${name}: ${run.conclusion}`);
    }

    logger.log("CI Gate passed: every expected path-filtered workflow reported success.");
    return;
  }

  throw new Error("CI Gate timed out before every expected workflow registered and completed");
}

const isDirectRun = process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href;
if (isDirectRun) {
  runGate({
    token: process.env.GITHUB_TOKEN,
    repository: process.env.REPO,
    pullNumber: process.env.PR_NUMBER,
    headSha: process.env.HEAD_SHA,
  }).catch((error) => {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  });
}
