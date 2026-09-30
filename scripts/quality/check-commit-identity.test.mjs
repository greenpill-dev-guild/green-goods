import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { clearRepositoryLocalGitVariables, fixtureGitEnvironment } from "../lib/dev-shared.js";
import {
  commitsInRange,
  findTestIdentities,
  parseGitLog,
  parseIdent,
  parsePullRequestCommits,
  report,
} from "./check-commit-identity.mjs";

// This check walks real repositories, so it needs the same isolation it exists to protect.
clearRepositoryLocalGitVariables();

const script = fileURLToPath(new URL("./check-commit-identity.mjs", import.meta.url));

function fixtureRepository(t) {
  const directory = mkdtempSync(join(tmpdir(), "commit-identity-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  // fixtureGitEnvironment commits as fixture@example.invalid, which is exactly what this check
  // rejects. Keep its isolation, drop its identity: the baseline is a person, and each test
  // supplies a leaked identity itself or leaves it to the repository's config.
  const { GIT_AUTHOR_NAME, GIT_AUTHOR_EMAIL, GIT_COMMITTER_NAME, GIT_COMMITTER_EMAIL, ...isolated } =
    fixtureGitEnvironment();
  const env = {
    ...isolated,
    GIT_AUTHOR_NAME: "Ada",
    GIT_AUTHOR_EMAIL: "ada@dev.local",
    GIT_COMMITTER_NAME: "Ada",
    GIT_COMMITTER_EMAIL: "ada@dev.local",
  };
  const git = (...args) => execFileSync("git", args, { cwd: directory, env, encoding: "utf8", stdio: "pipe" });
  git("init", "-q", "-b", "main");
  const commit = (subject, identity = {}) => {
    writeFileSync(join(directory, "file.txt"), `${subject}\n`);
    execFileSync("git", ["add", "file.txt"], { cwd: directory, env });
    execFileSync("git", ["commit", "-q", "-m", subject], { cwd: directory, env: { ...env, ...identity } });
  };
  return { directory, env, isolated, git, commit };
}

test("a commit is flagged when either side of it carries an address reserved for tests", () => {
  const base = { authorName: "Ada", authorEmail: "ada@dev.local", committerName: "Ada", committerEmail: "ada@dev.local" };
  assert.deepEqual(findTestIdentities([{ sha: "a1", subject: "ok", ...base }]), []);

  const byAuthor = findTestIdentities([
    { sha: "b2", subject: "leaked", ...base, authorName: "Release Operator Test", authorEmail: "x@example.invalid" },
  ]);
  assert.equal(byAuthor.length, 1);
  assert.deepEqual(byAuthor[0].roles, ["author Release Operator Test <x@example.invalid>"]);

  // A rebase keeps the author and replaces the committer, so a leak can hide on either side.
  const byCommitter = findTestIdentities([
    { sha: "c3", subject: "rebased", ...base, committerName: "Validation Test", committerEmail: "v@example.com" },
  ]);
  assert.deepEqual(byCommitter[0].roles, ["committer Validation Test <v@example.com>"]);

  // Addresses that merely look similar belong to people.
  for (const email of ["ada@myexample.com", "ada@users.noreply.github.com", "ada@contest.com"]) {
    assert.deepEqual(findTestIdentities([{ sha: "d4", subject: "real", ...base, authorEmail: email }]), [], email);
  }
});

test("git log records and identity lines parse into the shape the check reads", () => {
  const record = "abc123\x1fAda\x1fada@dev.local\x1fBo\x1fbo@dev.local\x1ffix(x): subject, with a comma\x1e";
  assert.deepEqual(parseGitLog(`${record}\n`), [
    {
      sha: "abc123",
      authorName: "Ada",
      authorEmail: "ada@dev.local",
      committerName: "Bo",
      committerEmail: "bo@dev.local",
      subject: "fix(x): subject, with a comma",
    },
  ]);
  assert.deepEqual(parseGitLog(""), []);
  assert.deepEqual(parseIdent("Ada O'Neil <ada@dev.local> 1758153600 -0700"), {
    name: "Ada O'Neil",
    email: "ada@dev.local",
  });
});

test("the pull-request payload maps onto the same shape, with the subject only", () => {
  assert.deepEqual(
    parsePullRequestCommits([
      {
        sha: "e5f6",
        commit: {
          author: { name: "Release Operator Test", email: "release-operator@example.invalid" },
          committer: { name: "Ada", email: "ada@dev.local" },
          message: "fix(contracts): one thing\n\nA body that is not the subject.",
        },
      },
    ]),
    [
      {
        sha: "e5f6",
        authorName: "Release Operator Test",
        authorEmail: "release-operator@example.invalid",
        committerName: "Ada",
        committerEmail: "ada@dev.local",
        subject: "fix(contracts): one thing",
      },
    ],
  );
  assert.deepEqual(parsePullRequestCommits([{ sha: "f7", commit: {} }])[0].authorEmail, "");
});

test("a range walk finds the leaked commit and leaves the sound ones alone", (t) => {
  const { directory, commit, git } = fixtureRepository(t);
  commit("chore: base");
  const base = git("rev-parse", "HEAD").trim();
  commit("feat: honest work", { GIT_AUTHOR_NAME: "Ada", GIT_AUTHOR_EMAIL: "ada@dev.local" });
  commit("fix: leaked", {
    GIT_AUTHOR_NAME: "Release Operator Test",
    GIT_AUTHOR_EMAIL: "release-operator@example.invalid",
  });

  const flagged = findTestIdentities(commitsInRange(base, { cwd: directory }));
  assert.equal(flagged.length, 1);
  assert.equal(flagged[0].subject, "fix: leaked");
  assert.match(flagged[0].roles[0], /^author Release Operator Test/);
});

test("the pre-commit mode fails on a poisoned config and passes on a real identity", (t) => {
  const { directory, env, isolated } = fixtureRepository(t);
  // No identity in the environment, so git falls back to the config, which is where a leak lands.
  const run = () => spawnSync(process.execPath, [script, "--pending"], { cwd: directory, env: isolated, encoding: "utf8" });

  execFileSync("git", ["config", "user.name", "Release Operator Test"], { cwd: directory, env });
  execFileSync("git", ["config", "user.email", "release-operator@example.invalid"], { cwd: directory, env });
  const poisoned = run();
  assert.equal(poisoned.status, 1);
  assert.match(poisoned.stderr, /reserved for tests/);
  assert.match(poisoned.stderr, /git config --local --get-regexp/);
  // There is no hash to name yet, so the line says which commit it means.
  assert.match(poisoned.stderr, /\(the commit being made\)/);

  execFileSync("git", ["config", "user.name", "Ada"], { cwd: directory, env });
  execFileSync("git", ["config", "user.email", "ada@dev.local"], { cwd: directory, env });
  assert.equal(run().status, 0);
});

test("the failure names every offending commit and how to repair it", () => {
  const lines = [];
  report(
    [
      {
        sha: "9169d49bc0000000",
        subject: "fix(shared): a thing",
        roles: ["author Release Operator Test <release-operator@example.invalid>"],
      },
    ],
    { log: (line) => lines.push(line) },
  );
  const text = lines.join("\n");
  assert.match(text, /9169d49bc fix\(shared\): a thing/);
  assert.match(text, /author Release Operator Test/);
  assert.match(text, /git rebase <base> --exec/);
});
