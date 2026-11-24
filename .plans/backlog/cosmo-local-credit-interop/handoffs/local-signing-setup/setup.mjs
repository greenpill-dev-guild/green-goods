// One-time, user-operated setup. Never run install/unlock from an agent tool: they access the
// user's private key through ssh-add. Review/check modes and exported pure helpers do not.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO = "/Users/afo/Code/greenpill/green-goods";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const quote = (text) => `'${text.replaceAll("'", "'\\''")}'`;

export function publicKey(text) {
  const lines = text.trim().split(/\r?\n/);
  assert.equal(lines.length, 1, "Select exactly one dedicated signing key");
  const [type, data] = lines[0].trim().split(/\s+/);
  assert.equal(type, "ssh-ed25519", "This bounded setup accepts an Ed25519 signing key");
  assert.match(data ?? "", /^[A-Za-z0-9+/]+={0,2}$/);
  const wire = Buffer.from(data, "base64");
  assert.equal(wire.length, 51, "Invalid Ed25519 public key");
  assert.equal(wire.readUInt32BE(0), 11);
  assert.equal(wire.subarray(4, 15).toString(), "ssh-ed25519");
  assert.equal(wire.readUInt32BE(15), 32);
  return `${type} ${data}`;
}

export function socketConfig(text, socket) {
  assert.ok(path.isAbsolute(socket) && !/[\r\n]/.test(socket) && !socket.includes("\0"));
  assert.ok(Buffer.byteLength(socket) < 100, "Socket path exceeds macOS limit");
  const before = Bun.TOML.parse(text);
  assert.equal(before.sandbox_mode, "workspace-write");
  assert.equal(before.approval_policy, "on-request");
  assert.equal(before.approvals_reviewer, "auto_review");
  assert.equal(before.default_permissions, "balanced");
  assert.ok(before.permissions?.balanced?.network, "Expected existing balanced profile");
  assert.notEqual(before.permissions.balanced.network.dangerously_allow_all_unix_sockets, true);
  const existing = before.permissions.balanced.network.unix_sockets ?? {};
  assert.notEqual(
    existing[socket],
    "deny",
    "An explicit socket denial requires policy-owner review"
  );
  if (existing[socket] === "allow") return text;
  const header = "[permissions.balanced.network.unix_sockets]";
  let candidate;
  if (before.permissions.balanced.network.unix_sockets) {
    const start = text.indexOf(header);
    assert.ok(start >= 0, "Existing socket table uses another spelling; edit it deliberately");
    const body = start + header.length;
    const match = /\n\s*\[/.exec(text.slice(body));
    const end = match ? body + match.index : text.length;
    candidate = `${text.slice(0, end).trimEnd()}\n${JSON.stringify(socket)} = "allow"\n${text.slice(end)}`;
  } else {
    candidate = `${text.trimEnd()}\n\n# Dedicated Green Goods Git signer; private-key file denials remain unchanged.\n${header}\n${JSON.stringify(socket)} = "allow"\n`;
  }
  const expected = structuredClone(before);
  expected.permissions.balanced.network.unix_sockets = { ...existing, [socket]: "allow" };
  assert.deepEqual(
    Bun.TOML.parse(candidate),
    expected,
    "Unexpected permission/configuration change"
  );
  return candidate;
}

export function signerProgram(socket) {
  assert.ok(path.isAbsolute(socket) && !/[\r\n]/.test(socket) && !socket.includes("\0"));
  return `#!/bin/sh
set -eu
# Fixed agent and Git namespace. Git configuration supplies a public key, never a private key.
case "$1:$2" in -Y:sign|-Y:verify|-Y:find-principals|-Y:check-novalidate) ;; *) exit 1;; esac
op="$2"
shift 2
if [ "$op" != find-principals ]; then
  has_git_namespace=0
  previous=''
  for argument in "$@"; do
    if [ "$previous" = -n ]; then
      [ "$argument" = git ] || exit 1
      has_git_namespace=1
    fi
    previous="$argument"
  done
  [ "$has_git_namespace" = 1 ] || exit 1
fi
export SSH_AUTH_SOCK=${quote(socket)}
exec /usr/bin/ssh-keygen -Y "$op" "$@"
`;
}

export function removeSocketConfig(text, socket, tableExisted) {
  const before = Bun.TOML.parse(text);
  assert.equal(before.permissions.balanced.network.unix_sockets?.[socket], "allow");
  const line = `${JSON.stringify(socket)} = "allow"`;
  assert.equal(
    text.split("\n").filter((value) => value === line).length,
    1,
    "Socket rule changed; inspect it"
  );
  let candidate = text
    .split("\n")
    .filter((value) => value !== line)
    .join("\n");
  const remaining = { ...before.permissions.balanced.network.unix_sockets };
  delete remaining[socket];
  if (!tableExisted && Object.keys(remaining).length === 0) {
    candidate = candidate
      .replace("[permissions.balanced.network.unix_sockets]\n", "")
      .replace(
        "# Dedicated Green Goods Git signer; private-key file denials remain unchanged.\n",
        ""
      );
  }
  const expected = structuredClone(before);
  if (!tableExisted && Object.keys(remaining).length === 0)
    delete expected.permissions.balanced.network.unix_sockets;
  else expected.permissions.balanced.network.unix_sockets = remaining;
  assert.deepEqual(Bun.TOML.parse(candidate), expected);
  return candidate;
}

function run(command, args, options = {}) {
  const r = spawnSync(command, args, { encoding: "utf8", ...options });
  if (r.error) throw r.error;
  if (r.status !== 0)
    throw new Error(`${path.basename(command)} failed (${r.status}): ${r.stderr ?? ""}`);
  return typeof r.stdout === "string" ? r.stdout.trim() : (r.stdout ?? Buffer.alloc(0));
}
const git = (...args) => run("/usr/bin/git", ["-C", REPO, ...args]);

export function indexSnapshot(repository) {
  // Full object IDs, modes and NUL-delimited paths bind the staged changes without copying
  // potentially large file contents. HEAD is checked separately before and after setup.
  return sha(
    run(
      "/usr/bin/git",
      [
        "-C",
        repository,
        "diff",
        "--cached",
        "--raw",
        "--no-abbrev",
        "--no-renames",
        "--ignore-submodules=none",
        "--no-ext-diff",
        "-z",
      ],
      { encoding: null }
    )
  );
}

export function restoreOwnGitSettings(repository, previous, installed) {
  const local = (...args) => run("/usr/bin/git", ["-C", repository, "config", "--local", ...args]);
  // Inspect every affected key before restoring any. Preserve concurrent changes for review.
  for (const [key, value] of Object.entries(installed)) {
    assert.equal(local("--get", key), value, `Git setting changed after setup: ${key}`);
  }
  for (const key of Object.keys(installed)) {
    local("--unset-all", key);
    for (const value of previous[key]) local("--add", key, value);
  }
}
function writeNew(file, text, mode = 0o600) {
  fs.writeFileSync(file, text, { flag: "wx", mode });
}
function trustedDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const s = fs.lstatSync(directory);
  assert.ok(s.isDirectory() && !s.isSymbolicLink() && s.uid === process.getuid());
  assert.equal(s.mode & 0o077, 0, "Signer directory must be private to the user");
}
function fingerprint(key) {
  return run("/usr/bin/ssh-keygen", ["-lf", "/dev/stdin"], { input: `${key}\n` }).split(/\s+/)[1];
}

export function rehearse(directory, program, key, email, name, environment) {
  const fixture = fs.mkdtempSync(path.join(directory, "rehearsal-"));
  try {
    const fixtureGit = (...args) =>
      run("/usr/bin/git", ["-C", fixture, ...args], { env: environment });
    fixtureGit("init", "-q");
    const settings = {
      "user.name": name,
      "user.email": email,
      "commit.gpgsign": "true",
      "gpg.format": "ssh",
      "user.signingkey": `key::${key}`,
      "gpg.ssh.program": program,
      "gpg.ssh.allowedSignersFile": path.join(directory, "allowed_signers"),
    };
    for (const [k, v] of Object.entries(settings)) fixtureGit("config", "--local", k, v);
    const tree = fixtureGit("mktree");
    const commit = fixtureGit(
      "commit-tree",
      "-S",
      "-m",
      "chore: disposable local signing rehearsal",
      tree
    );
    fixtureGit("verify-commit", commit);
    assert.equal(fixtureGit("log", "-1", "--format=%G?", commit), "G");
    const emptyTrust = path.join(fixture, "untrusted_signers");
    writeNew(emptyTrust, "");
    const invalid = spawnSync(
      "/usr/bin/git",
      ["-C", fixture, "-c", `gpg.ssh.allowedSignersFile=${emptyTrust}`, "verify-commit", commit],
      { env: environment }
    );
    assert.notEqual(invalid.status, 0, "Wrong trust must fail verification");
    const failed = spawnSync(
      "/usr/bin/git",
      [
        "-C",
        fixture,
        "-c",
        "gpg.ssh.program=/usr/bin/false",
        "commit-tree",
        "-S",
        "-m",
        "must fail",
        tree,
      ],
      { env: environment }
    );
    assert.notEqual(failed.status, 0, "Unavailable signer must fail closed");
    return {
      fixtureCommit: commit,
      signatureVerified: true,
      wrongTrustRejected: true,
      unavailableSignerRejected: true,
    };
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
}

function install(unlock, existingKey) {
  assert.ok(
    process.stdin.isTTY && process.stdout.isTTY,
    "Run install/unlock yourself in Terminal; agent tools must not access your private-key files"
  );
  assert.equal(
    git("config", "--get", "commit.gpgsign"),
    "true",
    "Signing must already be required"
  );
  const home = os.homedir();
  const directory = path.join(home, ".local/share/green-goods-signing");
  const socket = path.join(directory, "agent.sock");
  const keyFile = existingKey
    ? path.resolve(existingKey)
    : path.join(home, ".ssh/green_goods_git_signing");
  const config = path.join(home, ".codex/config.toml");
  const originalConfig = fs.readFileSync(config, "utf8");
  const nextConfig = socketConfig(originalConfig, socket);
  const indexBefore = indexSnapshot(REPO);
  const headBefore = git("rev-parse", "HEAD");
  const name = git("config", "--get", "user.name");
  const email = git("config", "--get", "user.email");
  assert.match(email, /^[^\s,"\r\n]+@[^\s,"\r\n]+$/);
  trustedDirectory(directory);
  if (!unlock) {
    assert.ok(
      !fs.existsSync(path.join(directory, "receipt.json")),
      "Already installed; use unlock to refresh the timed agent"
    );
    assert.ok(!fs.existsSync(socket), "Socket already exists; inspect it, do not replace it");
  }
  if (!existingKey && !fs.existsSync(keyFile)) {
    fs.mkdirSync(path.dirname(keyFile), { recursive: true, mode: 0o700 });
    run(
      "/usr/bin/ssh-keygen",
      ["-t", "ed25519", "-f", keyFile, "-C", "Green Goods local Git signing"],
      { stdio: "inherit" }
    );
  } else if (!existingKey && !unlock) {
    throw new Error(
      "Default key already exists. Reuse it deliberately with --existing-key PATH, or inspect it first"
    );
  }
  const key = publicKey(fs.readFileSync(`${keyFile}.pub`, "utf8"));
  const keyFingerprint = fingerprint(key);
  const env = { ...process.env, SSH_AUTH_SOCK: socket };
  let agentPid;
  let configChanged = false;
  let previousSettings;
  const installedSettings = {};
  if (!fs.existsSync(socket)) {
    const started = run("/usr/bin/ssh-agent", ["-a", socket, "-s"]);
    agentPid = Number(/SSH_AGENT_PID=(\d+);/.exec(started)?.[1]);
    assert.ok(Number.isSafeInteger(agentPid) && agentPid > 1);
  }
  try {
    const current = spawnSync("/usr/bin/ssh-add", ["-L"], { env, encoding: "utf8" });
    if (current.status === 0)
      assert.equal(publicKey(current.stdout), key, "Dedicated agent contains another key; stop");
    else assert.equal(current.status, 1, "Cannot connect to dedicated signing agent");
    if (unlock) {
      const installed = JSON.parse(fs.readFileSync(path.join(directory, "receipt.json"), "utf8"));
      assert.equal(
        installed.fingerprint,
        keyFingerprint,
        "Key rotation requires a separate decision"
      );
    }
    run("/usr/bin/ssh-add", ["-t", "4h", keyFile], { env, stdio: "inherit" });
    assert.equal(publicKey(run("/usr/bin/ssh-add", ["-L"], { env })), key);
    const program = path.join(directory, "git-ssh-sign");
    if (!unlock) {
      writeNew(
        path.join(directory, "setup.mjs"),
        fs.readFileSync(fileURLToPath(import.meta.url)),
        0o700
      );
      writeNew(program, signerProgram(socket), 0o700);
      writeNew(path.join(directory, "signing.pub"), `${key}\n`);
      writeNew(path.join(directory, "allowed_signers"), `${email} namespaces="git" ${key}\n`);
    } else
      assert.equal(
        fs.readFileSync(program, "utf8"),
        signerProgram(socket),
        "Signer program changed; inspect before use"
      );
    const proof = rehearse(directory, program, key, email, name, env);
    if (!unlock) {
      const settings = {
        "commit.gpgsign": "true",
        "gpg.format": "ssh",
        "gpg.ssh.program": program,
        "user.signingkey": `key::${key}`,
        "gpg.ssh.allowedSignersFile": path.join(directory, "allowed_signers"),
      };
      const previous = {};
      for (const k of Object.keys(settings)) {
        const r = spawnSync("/usr/bin/git", ["-C", REPO, "config", "--local", "--get-all", k], {
          encoding: "utf8",
        });
        assert.ok(r.status === 0 || r.status === 1);
        previous[k] = r.status === 1 ? [] : r.stdout.trimEnd().split("\n");
      }
      // Validate the complete candidate before changing configuration. Never export its contents:
      // user config may contain credentials unrelated to this workflow.
      assert.equal(
        fs.readFileSync(config, "utf8"),
        originalConfig,
        "Codex config changed during setup"
      );
      const stat = fs.lstatSync(config);
      assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.uid === process.getuid());
      writeNew(
        path.join(directory, "previous-git-settings.json"),
        `${JSON.stringify(previous, null, 2)}\n`
      );
      writeNew(
        path.join(directory, "socket-config-addition.txt"),
        `[permissions.balanced.network.unix_sockets]\n${JSON.stringify(socket)} = "allow"\n`
      );
      const temporary = `${config}.green-goods-signing-${process.pid}`;
      writeNew(temporary, nextConfig, stat.mode & 0o777);
      previousSettings = previous;
      try {
        for (const [k, v] of Object.entries(settings)) {
          git("config", "--local", k, v);
          installedSettings[k] = v;
        }
        assert.equal(
          fs.readFileSync(config, "utf8"),
          originalConfig,
          "Codex config changed before install"
        );
        fs.renameSync(temporary, config);
        configChanged = nextConfig !== originalConfig;
      } finally {
        if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
      }
      assert.equal(git("config", "--get", "commit.gpgsign"), "true");
      assert.equal(git("config", "--get", "gpg.format"), "ssh");
    }
    assert.equal(indexSnapshot(REPO), indexBefore, "Staged work changed; stop");
    assert.equal(git("rev-parse", "HEAD"), headBefore, "HEAD changed; stop");
    const priorReceipt = unlock
      ? JSON.parse(fs.readFileSync(path.join(directory, "receipt.json"), "utf8"))
      : {};
    const receipt = {
      ...priorReceipt,
      recordedAt: new Date().toISOString(),
      repo: REPO,
      fingerprint: keyFingerprint,
      publicKey: key,
      socket,
      agentPid,
      keyLifetime: "4h",
      hostRehearsal: proof,
      sandboxRehearsal: "pending fresh session",
      ...(!unlock
        ? {
            socketRuleAdded: nextConfig !== originalConfig,
            socketTableExisted: Boolean(
              Bun.TOML.parse(originalConfig).permissions.balanced.network.unix_sockets
            ),
            originalConfigSha256: sha(originalConfig),
            configuredConfigSha256: sha(nextConfig),
          }
        : {}),
      indexUnchanged: true,
      headUnchanged: true,
    };
    fs.writeFileSync(
      path.join(directory, "receipt.json"),
      `${JSON.stringify(receipt, null, 2)}\n`,
      { mode: 0o600 }
    );
    process.stdout.write(
      `Host signing rehearsal passed: ${keyFingerprint}\nRestart/resume Codex to load the one-socket rule. Sandbox signing and the actual checkpoint commit still need verification.\nReceipt: ${directory}/receipt.json\n`
    );
  } catch (error) {
    try {
      if (configChanged) {
        assert.equal(
          fs.readFileSync(config, "utf8"),
          nextConfig,
          "Config changed after setup; preserve it for review"
        );
        const rollbackFile = `${config}.green-goods-rollback-${process.pid}`;
        writeNew(rollbackFile, originalConfig, fs.statSync(config).mode & 0o777);
        fs.renameSync(rollbackFile, config);
      }
      if (previousSettings) restoreOwnGitSettings(REPO, previousSettings, installedSettings);
    } finally {
      if (agentPid) process.kill(agentPid, "SIGTERM");
    }
    throw error;
  }
}

function rollback() {
  assert.ok(process.stdin.isTTY, "Run rollback yourself in Terminal");
  const directory = path.join(os.homedir(), ".local/share/green-goods-signing");
  const receipt = JSON.parse(fs.readFileSync(path.join(directory, "receipt.json"), "utf8"));
  const previous = JSON.parse(
    fs.readFileSync(path.join(directory, "previous-git-settings.json"), "utf8")
  );
  const settings = {
    "commit.gpgsign": "true",
    "gpg.format": "ssh",
    "gpg.ssh.program": path.join(directory, "git-ssh-sign"),
    "user.signingkey": `key::${receipt.publicKey}`,
    "gpg.ssh.allowedSignersFile": path.join(directory, "allowed_signers"),
  };
  const config = path.join(os.homedir(), ".codex/config.toml");
  const original = fs.readFileSync(config, "utf8");
  const next = receipt.socketRuleAdded
    ? removeSocketConfig(original, receipt.socket, receipt.socketTableExisted)
    : original;
  restoreOwnGitSettings(REPO, previous, settings);
  assert.equal(git("config", "--get", "commit.gpgsign"), "true");
  if (next !== original) {
    assert.equal(
      fs.readFileSync(config, "utf8"),
      original,
      "Configuration changed during rollback"
    );
    const temporary = `${config}.green-goods-rollback-${process.pid}`;
    writeNew(temporary, next, fs.statSync(config).mode & 0o777);
    fs.renameSync(temporary, config);
  }
  const env = { ...process.env, SSH_AUTH_SOCK: receipt.socket };
  const keys = spawnSync("/usr/bin/ssh-add", ["-L"], { env, encoding: "utf8" });
  if (keys.status === 0) {
    assert.equal(
      publicKey(keys.stdout),
      receipt.publicKey,
      "Unexpected agent contents; preserve for review"
    );
    run("/usr/bin/ssh-add", ["-d", path.join(directory, "signing.pub")], { env });
  } else assert.equal(keys.status, 1, "Agent inaccessible; revoke/unload it in Terminal");
  fs.writeFileSync(
    path.join(directory, "receipt.json"),
    `${JSON.stringify({ ...receipt, rolledBackAt: new Date().toISOString() }, null, 2)}\n`,
    { mode: 0o600 }
  );
  process.stdout.write(
    "Previous repository signing settings restored; required signing retained. Only our socket rule was removed. Reload Codex. Private key files remain yours.\n"
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, flag, key] = process.argv.slice(2);
  if (mode === "rollback" && !flag) rollback();
  else if (
    !["install", "unlock"].includes(mode) ||
    (flag && (flag !== "--existing-key" || !key)) ||
    process.argv.length > 5
  ) {
    process.stdout.write(
      "User Terminal only: bun --no-env-file setup.mjs install|unlock [--existing-key PATH] | rollback\nNo changes made. Keep private keys out of chat; the agent must not run install/unlock.\n"
    );
    if (mode) process.exitCode = 1;
  } else install(mode === "unlock", flag ? key : undefined);
}
