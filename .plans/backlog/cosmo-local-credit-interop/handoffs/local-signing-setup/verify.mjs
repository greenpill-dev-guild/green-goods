// One-shot rehearsal tests. Keys below are disposable fixtures, never the user's keys.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  indexSnapshot,
  publicKey,
  rehearse,
  removeSocketConfig,
  restoreOwnGitSettings,
  signerProgram,
  socketConfig,
} from "./setup.mjs";

const socket = "/private/tmp/green-goods-fixture/agent.sock";
const config = `sandbox_mode="workspace-write"
approval_policy="on-request"
approvals_reviewer="auto_review"
default_permissions="balanced"
[permissions.balanced.filesystem]
":root"="read"
"/fixture/.gnupg"="deny"
"/fixture/.ssh"="deny"
"/fixture/project/.env"="deny"
[permissions.balanced.network]
enabled=true
mode="limited"
[permissions.balanced.network.domains]
"example.test"="allow"
`;
let passed = 0;
function check(name, action) {
  try {
    action();
    passed++;
    process.stdout.write(`PASS ${name}\n`);
  } catch (error) {
    process.stderr.write(`FAIL ${name}: ${error.stack}\n`);
    process.exitCode = 1;
  }
}
check("only one socket rule changes; protected files, domains and defaults stay identical", () => {
  const before = Bun.TOML.parse(config);
  const after = Bun.TOML.parse(socketConfig(config, socket));
  assert.deepEqual(after.permissions.balanced.filesystem, before.permissions.balanced.filesystem);
  assert.deepEqual(
    after.permissions.balanced.network.domains,
    before.permissions.balanced.network.domains
  );
  delete after.permissions.balanced.network.unix_sockets;
  assert.deepEqual(after, before);
});
check("socket setup is idempotent and retains existing local-service rules", () => {
  const withSocket = socketConfig(config, socket);
  assert.equal(socketConfig(withSocket, socket), withSocket);
  const other = `${config}\n[permissions.balanced.network.unix_sockets]\n"/fixture/other.sock"="deny"\n`;
  const next = Bun.TOML.parse(socketConfig(other, socket));
  assert.deepEqual(next.permissions.balanced.network.unix_sockets, {
    "/fixture/other.sock": "deny",
    [socket]: "allow",
  });
});
check("socket rollback removes only our grant and preserves concurrent configuration", () => {
  const installed = socketConfig(config, socket);
  assert.deepEqual(
    Bun.TOML.parse(removeSocketConfig(installed, socket, false)),
    Bun.TOML.parse(config)
  );
  const concurrent = `${installed}\n[another]\nkeep="later change"\n`;
  assert.equal(
    Bun.TOML.parse(removeSocketConfig(concurrent, socket, false)).another.keep,
    "later change"
  );
  const other = `${config}\n[permissions.balanced.network.unix_sockets]\n"/fixture/other.sock"="deny"\n`;
  const next = removeSocketConfig(socketConfig(other, socket), socket, true);
  assert.deepEqual(Bun.TOML.parse(next), Bun.TOML.parse(other));
});
check("explicit socket denial and changed security defaults fail closed", () => {
  assert.throws(() =>
    socketConfig(
      `${config}\n[permissions.balanced.network.unix_sockets]\n${JSON.stringify(socket)}="deny"\n`,
      socket
    )
  );
  for (const [from, to] of [
    ["workspace-write", "danger-full-access"],
    ["on-request", "never"],
    ["auto_review", "user"],
    ['default_permissions="balanced"', 'default_permissions="other"'],
  ]) {
    assert.throws(() => socketConfig(config.replace(from, to), socket));
  }
  assert.throws(() => socketConfig(config, "relative.sock"));
  assert.throws(() => socketConfig(config, "/" + "x".repeat(110)));
});
check("install cannot run without a user terminal and cannot change Git or credentials", () => {
  const r = spawnSync(
    process.execPath,
    ["--no-env-file", new URL("./setup.mjs", import.meta.url).pathname, "install"],
    { encoding: "utf8" }
  );
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Run install\/unlock yourself in Terminal/);
});

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "green-goods-signer-fixture-"));
try {
  const keyFile = path.join(directory, "fictional_key");
  const generated = spawnSync("/usr/bin/ssh-keygen", [
    "-q",
    "-t",
    "ed25519",
    "-N",
    "",
    "-f",
    keyFile,
  ]);
  assert.equal(generated.status, 0);
  const key = publicKey(fs.readFileSync(`${keyFile}.pub`, "utf8"));
  fs.writeFileSync(
    path.join(directory, "allowed_signers"),
    `fixture@example.invalid namespaces="git" ${key}\n`
  );
  check("malformed, multiple and wrong-algorithm public keys are rejected", () => {
    assert.throws(() => publicKey("ssh-ed25519 invalid"));
    assert.throws(() => publicKey(`${key}\n${key}`));
    assert.throws(() => publicKey(key.replace("ssh-ed25519", "ssh-rsa")));
    assert.equal(publicKey(`${key} fictional comment`), key);
  });
  const program = path.join(directory, "git-ssh-sign");
  fs.writeFileSync(program, signerProgram(socket), { mode: 0o700 });
  check("non-Git signature requests are refused before signing", () => {
    const r = spawnSync(program, ["-Y", "sign", "-n", "ssh-auth", "-f", keyFile], {
      input: "fictional data",
      encoding: "utf8",
    });
    assert.notEqual(r.status, 0);
  });
  check("Git find-principals remains available for signature verification", () => {
    const message = path.join(directory, "fictional-message");
    const contents = "fictional signing fixture\n";
    fs.writeFileSync(message, contents);
    const signed = spawnSync(
      "/usr/bin/ssh-keygen",
      ["-Y", "sign", "-n", "git", "-f", keyFile, message],
      { encoding: "utf8" }
    );
    assert.equal(signed.status, 0, signed.stderr);
    const r = spawnSync(
      program,
      [
        "-Y",
        "find-principals",
        "-f",
        path.join(directory, "allowed_signers"),
        "-s",
        `${message}.sig`,
      ],
      { encoding: "utf8" }
    );
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), "fixture@example.invalid");
    const args = [
      "-Y",
      "verify",
      "-f",
      path.join(directory, "allowed_signers"),
      "-I",
      "fixture@example.invalid",
      "-n",
      "git",
      "-s",
      `${message}.sig`,
    ];
    assert.equal(spawnSync(program, args, { input: contents }).status, 0);
    assert.notEqual(spawnSync(program, args, { input: "altered fixture" }).status, 0);
  });
  check("real Git SSH signatures verify; wrong trust and failed signer are rejected", () => {
    // Cryptographic fixture only: this explicit fake private key replaces the agent edge.
    // It proves Git/verification behavior, not real-agent access through the desktop sandbox.
    const fixtureProgram = path.join(directory, "fixture-signer");
    fs.writeFileSync(
      fixtureProgram,
      `#!/usr/bin/python3\nimport os,sys\nargs=sys.argv[1:]\nif args[1]=='sign': args[args.index('-f')+1]=${JSON.stringify(keyFile)}\nos.execv('/usr/bin/ssh-keygen',['/usr/bin/ssh-keygen',*args])\n`,
      { mode: 0o700 }
    );
    const proof = rehearse(
      directory,
      fixtureProgram,
      key,
      "fixture@example.invalid",
      "Fictional signing fixture",
      process.env
    );
    assert.equal(proof.signatureVerified, true);
    assert.equal(proof.wrongTrustRejected, true);
    assert.equal(proof.unavailableSignerRejected, true);
  });
  const repo = path.join(directory, "config-fixture");
  fs.mkdirSync(repo);
  const git = (...args) => {
    const r = spawnSync("/usr/bin/git", ["-C", repo, ...args], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };
  git("init", "-q");
  check("large staged content can be checked without exceeding the output buffer", () => {
    const file = path.join(repo, "large-fictional-checkpoint.bin");
    fs.writeFileSync(file, randomBytes(2 * 1024 * 1024));
    git("add", "--", "large-fictional-checkpoint.bin");
    const before = indexSnapshot(repo);
    assert.match(before, /^[a-f0-9]{64}$/);
    assert.equal(indexSnapshot(repo), before);
    fs.appendFileSync(file, "unstaged work must remain independent");
    assert.equal(indexSnapshot(repo), before);
  });
  check("staged identity binds contents, mode, path and removal", () => {
    const file = "identity-fixture.txt";
    fs.writeFileSync(path.join(repo, file), "first staged version");
    git("add", "--", file);
    let before = indexSnapshot(repo);
    fs.writeFileSync(path.join(repo, file), "second staged version");
    git("add", "--", file);
    assert.notEqual(indexSnapshot(repo), before);
    before = indexSnapshot(repo);
    fs.chmodSync(path.join(repo, file), 0o755);
    git("add", "--", file);
    assert.notEqual(indexSnapshot(repo), before);
    before = indexSnapshot(repo);
    git("mv", "--", file, "renamed-fixture.txt");
    assert.notEqual(indexSnapshot(repo), before);
    before = indexSnapshot(repo);
    git("rm", "--cached", "--", "renamed-fixture.txt");
    assert.notEqual(indexSnapshot(repo), before);
  });
  check("configuration rollback restores only our keys and preserves unrelated changes", () => {
    git("config", "--local", "gpg.format", "ssh");
    git("config", "--local", "test.unrelated", "preserve");
    restoreOwnGitSettings(repo, { "gpg.format": ["openpgp"] }, { "gpg.format": "ssh" });
    assert.equal(git("config", "--local", "--get", "gpg.format"), "openpgp");
    assert.equal(git("config", "--local", "--get", "test.unrelated"), "preserve");
  });
  check("configuration rollback refuses to overwrite a concurrent edit", () => {
    git("config", "--local", "gpg.format", "concurrent");
    assert.throws(
      () => restoreOwnGitSettings(repo, { "gpg.format": ["openpgp"] }, { "gpg.format": "ssh" }),
      /changed after setup/
    );
    assert.equal(git("config", "--local", "--get", "gpg.format"), "concurrent");
  });
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
process.stdout.write(
  `${passed}/13 local setup checks passed; real agent and sandbox proof remain separate\n`
);
