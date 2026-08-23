import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  findCompatibleNode,
  reexecUnderCompatibleNodeIfNeeded,
  resolveVitestMaxWorkers,
} from "./dev-shared.js";

const GIBIBYTE = 1024 ** 3;

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
    ["/mise-shim/node", "bun:1.3.14"],
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
  const bun = path.join(miseData, "installs/bun/1.3.14/bin/bun");
  const forge = path.join(miseData, "installs/foundry/1.7.1/forge");
  for (const executable of [node, bun, forge]) {
    mkdirSync(path.dirname(executable), { recursive: true });
    writeFileSync(executable, "");
    chmodSync(executable, 0o755);
  }
  writeFileSync(
    path.join(directory, ".mise.toml"),
    '[tools]\nnode = "22.22.1"\nbun = "1.3.14"\nfoundry = "1.7.1"\n',
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
