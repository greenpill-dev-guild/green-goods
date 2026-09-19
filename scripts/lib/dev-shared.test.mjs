import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  REPOSITORY_LOCAL_GIT_VARIABLES,
  clearRepositoryLocalGitVariables,
  findCompatibleNode,
  findInheritedFixtureIdentity,
  findSharedGitSettingChanges,
  fixtureGitEnvironment,
  dockerEnvironment,
  assertDockerReady,
  parseSubmoduleStatus,
  profileRequiresContractSubmodules,
  readSharedGitSettings,
  reexecUnderCompatibleNodeIfNeeded,
  resolveSubmoduleSetupAction,
  resolveVitestMaxWorkers,
} from "./dev-shared.js";

const GIBIBYTE = 1024 ** 3;

test("Docker repairs a missing local socket without overriding an intentional endpoint", () => {
  const home = "/home/dev";
  const socket = `${home}/.orbstack/run/docker.sock`;
  const existing = new Set([socket, "/usr/local/bin/docker", "/live.sock"]);
  const resolve = (env) => dockerEnvironment({ env, home, exists: (file) => existing.has(file) });
  const stale = { PATH: "/bin", DOCKER_HOST: "unix:///missing.sock" };
  assert.equal(resolve(stale).DOCKER_HOST, `unix://${socket}`);
  assert.equal(stale.DOCKER_HOST, "unix:///missing.sock");
  assert.ok(resolve(stale).PATH.includes("/usr/local/bin"));
  const desktop = resolve({ DOCKER_CONTEXT: "desktop-linux", DOCKER_HOST: `unix://${home}/.docker/run/docker.sock` });
  assert.equal(desktop.DOCKER_CONTEXT, "orbstack");
  assert.equal(desktop.DOCKER_HOST, `unix://${socket}`);
  for (const env of [
    { DOCKER_HOST: "unix:///live.sock" },
    { DOCKER_HOST: "ssh://docker-host" },
    { DOCKER_HOST: "unix:///missing.sock", DOCKER_CONTEXT: "remote" },
    {},
  ]) assert.equal(resolve(env).DOCKER_HOST, env.DOCKER_HOST);
  existing.delete(socket);
  assert.equal(resolve(stale).DOCKER_HOST, stale.DOCKER_HOST);
});

test("Docker preflight fails clearly when no CLI can be reached", () => {
  assert.throws(() => assertDockerReady({ PATH: "/nonexistent" }), /Docker is unavailable.*No services were started/);
});

test("submodule status parser distinguishes every actionable git state", () => {
  const fixtures = [
    [" e2041f packages/contracts/lib/kernel\n", "ready"],
    ["-e2041f packages/contracts/lib/kernel\n", "uninitialized"],
    ["+e2041f packages/contracts/lib/kernel\n", "mismatched"],
    ["Ue2041f packages/contracts/lib/kernel\n", "conflicted"],
  ];

  for (const [stdout, expected] of fixtures) {
    assert.equal(parseSubmoduleStatus({ stdout, status: 0 }).state, expected);
  }
  assert.equal(parseSubmoduleStatus({ stdout: "", status: 0 }).state, "ready");
  assert.equal(parseSubmoduleStatus({ stdout: "", status: 128 }).state, "command-error");
  assert.equal(parseSubmoduleStatus({ stdout: "?unexpected" }).state, "command-error");
});

test("setup initializes only missing pinned submodules", () => {
  assert.equal(resolveSubmoduleSetupAction({ state: "ready", installMode: "always" }), "none");
  assert.equal(
    resolveSubmoduleSetupAction({ state: "uninitialized", installMode: "auto" }),
    "initialize",
  );
  assert.equal(
    resolveSubmoduleSetupAction({ state: "uninitialized", installMode: "always" }),
    "initialize",
  );
  for (const state of ["uninitialized", "mismatched", "conflicted", "modified", "command-error"]) {
    assert.equal(resolveSubmoduleSetupAction({ state, installMode: "skip" }), "stop");
  }
  for (const state of ["mismatched", "conflicted", "modified", "command-error"]) {
    assert.equal(resolveSubmoduleSetupAction({ state, installMode: "auto" }), "stop");
  }
});

test("contract and full doctor profiles require pinned submodules", () => {
  assert.equal(profileRequiresContractSubmodules("contracts"), true);
  assert.equal(profileRequiresContractSubmodules("full"), true);
  for (const profile of ["web", "upload", "prod", "prod-mirror"]) {
    assert.equal(profileRequiresContractSubmodules(profile), false);
  }
});

test("local Vitest workers respect CPU, memory, and concurrent package share", () => {
  const cases = [
    {
      name: "16 GB and 10 cores",
      input: { cpus: 10, totalMemoryBytes: 16 * GIBIBYTE, ci: false },
      expected: 8,
    },
    {
      name: "8 GB is memory bound",
      input: { cpus: 10, totalMemoryBytes: 8 * GIBIBYTE, ci: false },
      expected: 4,
    },
    {
      name: "CI keeps its existing worker policy",
      input: { cpus: 10, totalMemoryBytes: 16 * GIBIBYTE, ci: true },
      expected: undefined,
    },
    {
      name: "three concurrent packages share the local cap",
      input: { cpus: 10, totalMemoryBytes: 16 * GIBIBYTE, ci: false, share: 3 },
      expected: 2,
    },
  ];

  for (const { name, input, expected } of cases) {
    assert.equal(resolveVitestMaxWorkers(input), expected, name);
  }
});

test("compatible Node selection honors candidate order and skips Bun shims", () => {
  const versions = new Map([
    ["/mise-shim/node", "bun:1.4.2"],
    ["/env/node", "20.18.0"],
    ["/path/node", "22.22.1"],
    ["/mise-install/node", "22.21.0"],
  ]);
  const probed = [];
  const selected = findCompatibleNode({
    isSupported: (version) => version === "22.22.1",
    candidates: [...versions.keys()],
    exists: () => true,
    probe(candidate) {
      probed.push(candidate);
      return versions.get(candidate);
    },
  });

  assert.equal(selected, "/path/node");
  assert.deepEqual(probed, ["/mise-shim/node", "/env/node", "/path/node"]);
});

test("default candidates put mise, NODE, and non-Bun PATH entries in policy order", () => {
  const original = {
    miseData: process.env.MISE_DATA_DIR,
    node: process.env.NODE,
    path: process.env.PATH,
  };
  const executable = process.platform === "win32" ? "node.exe" : "node";
  const miseData = path.join(tmpdir(), "mise-candidate-order");
  const pathA = path.join(tmpdir(), "node-path-a");
  const pathB = path.join(tmpdir(), "node-path-b");
  process.env.MISE_DATA_DIR = miseData;
  process.env.NODE = path.join(tmpdir(), "node-from-env");
  process.env.PATH = [
    pathA,
    path.join(tmpdir(), ".bun", "bin"),
    path.join(tmpdir(), "bun-node-shim"),
    pathB,
  ].join(path.delimiter);

  try {
    const probed = [];
    findCompatibleNode({
      isSupported: () => false,
      exists: () => true,
      probe(candidate) {
        probed.push(candidate);
        return "21.0.0";
      },
    });

    assert.deepEqual(probed, [
      path.join(miseData, "shims", executable),
      process.env.NODE,
      path.join(pathA, executable),
      path.join(pathB, executable),
    ]);
  } finally {
    for (const [name, value] of Object.entries(original)) {
      const key = name === "miseData" ? "MISE_DATA_DIR" : name.toUpperCase();
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("missing compatible Node leaves the current process in place", () => {
  let spawned = false;
  let exited = false;
  const reexecuted = reexecUnderCompatibleNodeIfNeeded({
    scriptPath: "/workspace/ci-local.js",
    sentinel: "GREEN_GOODS_TEST_MISSING_REEXEC",
    cwd: "/workspace",
    isSupported: () => false,
    candidates: ["/missing/node"],
    exists: () => false,
    spawn() {
      spawned = true;
    },
    exit() {
      exited = true;
    },
  });

  assert.equal(reexecuted, false);
  assert.equal(spawned, false);
  assert.equal(exited, false);
});

test("successful re-entry carries the pinned Node, Bun, and Foundry toolchain", (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), "compatible-node-reexec-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const miseData = path.join(directory, "mise");
  const node = path.join(miseData, "installs/node/22.22.1/bin/node");
  const bun = path.join(miseData, "installs/bun/1.4.2/bin/bun");
  const forge = path.join(miseData, "installs/foundry/1.7.1/forge");
  for (const executable of [node, bun, forge]) {
    mkdirSync(path.dirname(executable), { recursive: true });
    writeFileSync(executable, "");
    chmodSync(executable, 0o755);
  }
  writeFileSync(
    path.join(directory, ".mise.toml"),
    '[tools]\nnode = "22.22.1"\nbun = "1.4.2"\nfoundry = "1.7.1"\n',
  );

  const originalMiseData = process.env.MISE_DATA_DIR;
  process.env.MISE_DATA_DIR = miseData;
  let child;
  let exitCode;
  try {
    const reexecuted = reexecUnderCompatibleNodeIfNeeded({
      scriptPath: path.join(directory, "ci-local.js"),
      sentinel: "GREEN_GOODS_TEST_SUCCESS_REEXEC",
      cwd: directory,
      isSupported: (version) => version === "fixture-node-22",
      candidates: [node],
      exists: () => true,
      probe: () => "fixture-node-22",
      spawn(command, args, options) {
        child = { command, args, options };
        return { status: 7 };
      },
      exit(code) {
        exitCode = code;
      },
    });
    assert.equal(reexecuted, true);
  } finally {
    if (originalMiseData === undefined) delete process.env.MISE_DATA_DIR;
    else process.env.MISE_DATA_DIR = originalMiseData;
  }

  assert.equal(child.command, node);
  assert.equal(child.args[0], path.join(directory, "ci-local.js"));
  assert.equal(child.options.cwd, directory);
  assert.equal(child.options.env.GREEN_GOODS_TEST_SUCCESS_REEXEC, "1");
  assert.equal(child.options.env.NODE, node);
  assert.equal(child.options.env.npm_node_execpath, node);
  assert.deepEqual(child.options.env.PATH.split(path.delimiter).slice(0, 3), [
    path.dirname(bun),
    path.dirname(forge),
    path.dirname(node),
  ]);
  assert.equal(exitCode, 7);
});

test("the re-entry sentinel prevents an infinite spawn loop", () => {
  const sentinel = "GREEN_GOODS_TEST_SENTINEL_REEXEC";
  const original = process.env[sentinel];
  process.env[sentinel] = "1";
  try {
    const reexecuted = reexecUnderCompatibleNodeIfNeeded({
      scriptPath: "/workspace/ci-local.js",
      sentinel,
      cwd: "/workspace",
      isSupported: () => false,
      candidates: ["/compatible/node"],
      exists: () => true,
      probe: () => "22.22.1",
      spawn() {
        assert.fail("sentinel re-entry must not spawn");
      },
      exit() {
        assert.fail("sentinel re-entry must not exit");
      },
    });
    assert.equal(reexecuted, false);
  } finally {
    if (original === undefined) delete process.env[sentinel];
    else process.env[sentinel] = original;
  }
});

test("a fixture's git stays in its own directory while a hook binds git to the pushed repository", (t) => {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "git-fixture-isolation-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const pushed = path.join(root, "pushed");
  const fixture = path.join(root, "fixture");
  mkdirSync(pushed);
  mkdirSync(fixture);
  const git = (cwd, env, ...args) => execFileSync("git", args, { cwd, env, encoding: "utf8" }).trim();

  const unbound = fixtureGitEnvironment();
  git(pushed, unbound, "init", "--quiet");
  git(pushed, unbound, "commit", "--quiet", "--allow-empty", "-m", "pushed work");
  const pushedHead = git(pushed, unbound, "rev-parse", "HEAD");
  const pushedSettings = readSharedGitSettings({ cwd: pushed });

  // What git hands every child of a hook in a linked worktree: `cwd` no longer chooses.
  const hook = {
    ...process.env,
    GIT_DIR: path.join(pushed, ".git"),
    GIT_INDEX_FILE: path.join(pushed, ".git/index"),
  };
  assert.equal(git(fixture, hook, "rev-parse", "--absolute-git-dir"), path.join(pushed, ".git"));

  const isolated = fixtureGitEnvironment(hook);
  git(fixture, isolated, "init", "--quiet");
  writeFileSync(path.join(fixture, "seed.txt"), "seed\n");
  git(fixture, isolated, "add", ".");
  git(fixture, isolated, "commit", "--quiet", "-m", "fixture work");

  assert.equal(git(fixture, isolated, "rev-parse", "--absolute-git-dir"), path.join(fixture, ".git"));
  assert.equal(git(fixture, isolated, "log", "-1", "--format=%an <%ae>"), "Fixture <fixture@example.invalid>");
  assert.equal(existsSync(path.join(fixture, ".git/config")), true);
  assert.equal(git(pushed, unbound, "rev-parse", "HEAD"), pushedHead);
  assert.equal(git(pushed, unbound, "status", "--porcelain"), "");
  assert.deepEqual(readSharedGitSettings({ cwd: pushed }), pushedSettings);
});

test("clearing git's repository-local variables releases a hook's binding and keeps the rest", () => {
  const environment = {
    PATH: "/bin",
    GIT_DIR: "/pushed/.git/worktrees/lane",
    GIT_INDEX_FILE: "/pushed/.git/worktrees/lane/index",
    GIT_WORK_TREE: "/pushed",
    GIT_EDITOR: "true",
    GIT_SSH_COMMAND: "ssh -i key",
  };
  assert.equal(clearRepositoryLocalGitVariables(environment), environment);
  assert.deepEqual(environment, { PATH: "/bin", GIT_EDITOR: "true", GIT_SSH_COMMAND: "ssh -i key" });

  // The list of record is git's own: a git that binds through a new variable must extend ours.
  const listedByGit = execFileSync("git", ["rev-parse", "--local-env-vars"], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
  assert.deepEqual(
    listedByGit.filter((variable) => !REPOSITORY_LOCAL_GIT_VARIABLES.includes(variable)),
    [],
  );
});

test("shared git settings come from the repository's own config, and are absent without one", () => {
  const calls = [];
  const answering = (stdout, status) => (command, args, options) => {
    calls.push({ command, args, cwd: options.cwd, bound: "GIT_DIR" in options.env });
    return { stdout, status };
  };

  assert.deepEqual(
    readSharedGitSettings({
      cwd: "/repo",
      run: answering("core.bare false\nuser.name Release Operator Test\n", 0),
    }),
    { "core.bare": "false", "user.name": "Release Operator Test" },
  );
  // --local keeps a developer's global identity out of the comparison.
  assert.equal(calls[0].command, "git");
  assert.deepEqual(calls[0].args.slice(0, 2), ["config", "--local"]);
  assert.deepEqual([calls[0].cwd, calls[0].bound], ["/repo", false]);

  assert.deepEqual(readSharedGitSettings({ cwd: "/repo", run: answering("", 1) }), {});
  assert.equal(readSharedGitSettings({ cwd: "/tarball", run: answering("", 128) }), null);
});

test("an inherited fixture identity is reported, and a contributor's own identity is not", () => {
  const healthy = { problems: [], repairs: [] };
  assert.deepEqual(findInheritedFixtureIdentity({ "core.bare": "false" }), healthy);
  assert.deepEqual(findInheritedFixtureIdentity(null), healthy);
  // A per-repository identity is legitimate, whatever its domain resembles.
  for (const email of ["ada@contest.com", "ada@myexample.com", "ada@users.noreply.github.com"]) {
    assert.deepEqual(findInheritedFixtureIdentity({ "user.name": "Ada", "user.email": email }), healthy, email);
  }

  assert.deepEqual(
    findInheritedFixtureIdentity({
      "user.name": "Release Operator Test",
      "user.email": "release-operator@example.invalid",
    }),
    {
      problems: ["user.email is release-operator@example.invalid, an address reserved for tests"],
      repairs: ["git config --local --unset-all user.name", "git config --local --unset-all user.email"],
    },
  );
  for (const email of ["validation@example.com", "t@docs.example.org", "ci@runner.test"]) {
    assert.equal(findInheritedFixtureIdentity({ "user.email": email }).problems.length, 1, email);
  }

  // What the fixtures actually left behind: the identity, signing off, and a bare repository.
  // Repairing only the identity would leave every later commit unsigned.
  assert.deepEqual(
    findInheritedFixtureIdentity({
      "core.bare": "true",
      "commit.gpgsign": "false",
      "user.name": "Release Operator Test",
      "user.email": "release-operator@example.invalid",
    }).repairs,
    [
      "git config --local --unset-all user.name",
      "git config --local --unset-all user.email",
      "git config --local --unset-all commit.gpgsign",
      "git config --local core.bare false",
    ],
  );
  // Without a fixture identity, a contributor's own signing choice is theirs to keep.
  assert.deepEqual(findInheritedFixtureIdentity({ "commit.gpgsign": "false", "core.bare": "false" }), healthy);
});

test("settings a run changed in the shared git config are reported with the commands that restore them", () => {
  const before = { "core.bare": "false", "user.name": "Ada O'Neil" };
  assert.deepEqual(findSharedGitSettingChanges(before, { ...before }), { problems: [], repairs: [] });
  assert.deepEqual(findSharedGitSettingChanges(null, before), { problems: [], repairs: [] });

  assert.deepEqual(
    findSharedGitSettingChanges(before, {
      "core.bare": "true",
      "user.name": "Validation Test",
      "user.email": "validation@example.com",
      "commit.gpgsign": "false",
    }),
    {
      problems: [
        "core.bare changed from false to true while validation ran",
        "user.name changed from Ada O'Neil to Validation Test while validation ran",
        "user.email changed from unset to validation@example.com while validation ran",
        "commit.gpgsign changed from unset to false while validation ran",
      ],
      repairs: [
        "git config --local core.bare 'false'",
        "git config --local user.name 'Ada O'\\''Neil'",
        "git config --local --unset-all user.email",
        "git config --local --unset-all commit.gpgsign",
      ],
    },
  );
});
