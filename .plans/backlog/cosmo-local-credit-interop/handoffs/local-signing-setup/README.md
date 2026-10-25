# Local signed checkpoints

Prepared for the user's 22 October request to commit validated slices promptly, with signing
required and sandbox protections retained. The 145-path checkpoint is committed locally as
`0f4e62bae5d7696f9d07b0cdb8715f8aeec5e86e` on `feature/cosmo-local-contracts`.
`git verify-commit HEAD` reports a good Ed25519 signature and Git reports signature status `G`.
The commit check confirmed an empty index, unchanged bytes and modes for all 315 observed working
files, and the unrelated Portuguese translation still unstaged. Nothing was pushed.

**22 October source consolidation:** the 13 disposable-fixture checks pass again. Direct strict
lint exposed CLI console output, a control-character regex warning and redundant quote escapes;
the source now uses standard output/error and equivalent explicit NUL rejection. No diagnostics
were disabled. These sources were reviewed as historical, user-operated setup tooling. No real
installation, unlock, rollback, key-file access or permission/configuration change was performed
in this continuation. Existing agent-backed signed commits remain a separate proof boundary.

The default sandbox still rejects the dedicated agent socket with `Operation not permitted`.
A scoped approved command reaches it and successfully signs; this is **approval-backed signing**,
not proof of signing without approval inside the default sandbox. No permission settings, private-key
file access, persistent hooks or signing requirements were changed during this verification.
After the four-hour key lifetime expired, the user unlocked the existing key in Terminal.
The disposable signed-commit probe then passed, including wrong-trust and unavailable-signer
rejection, before the actual checkpoint was committed with its reviewed no-stash hook adapter.

## One-time activation

Review [setup.mjs](setup.mjs), then run this yourself in your normal Terminal:

```sh
bun --no-env-file /Users/afo/Code/greenpill/green-goods/.plans/backlog/cosmo-local-credit-interop/handoffs/local-signing-setup/setup.mjs install
```

The first Terminal attempt stopped with `ENOBUFS` while capturing `git diff --cached --binary`.
It stopped before creating the signing directory or accessing a key. The corrected installer
hashes staged object IDs, file modes and paths instead of capturing file contents; it checks HEAD
separately. A retry then completed successfully. No cleanup, unstaging or signing-policy change
was needed. The activation steps below are retained for reference; the installed workflow uses
`unlock` for subsequent sessions.

The setup creates a dedicated Ed25519 signing key at `~/.ssh/green_goods_git_signing`. Choose a
passphrase in the terminal prompt. It refuses to overwrite an existing key. To deliberately reuse
an existing **signing-only** Ed25519 key, use `install --existing-key /absolute/key/path` instead.
Do not put private key contents or passphrases into chat. The agent must not run install/unlock:
the active permission profile prohibits private-key file access. The installer checks for a user TTY
before attempting key setup. No real private key has been accessed in the preparation proof.

It then:

1. Loads only that key into a separate SSH agent for **four hours**. The private key stays in the
   user's protected storage. The socket is `~/.local/share/green-goods-signing/agent.sock`.
2. Installs a fixed-agent Git signer, public key and local verification trust file in that private
   user directory. The Git wrapper requires the `git` signature namespace. This is a convenience
   boundary; access to the agent socket grants use of its loaded key. Do not load general SSH
   authentication keys into this agent. The key is not cryptographically restricted to one repo.
3. Runs a real agent-backed signature and `git verify-commit` in a disposable local repository,
   including wrong-trust and unavailable-signer rejection. This does not modify Green Goods HEAD
   or its index and does not broadcast or publish anything.
4. Sets **repository-local** SSH signing and trusted public-key configuration, with
   `commit.gpgsign=true`. The global OpenPGP configuration and every other repository stay unchanged.
5. Adds one exact Unix-socket allowance under the existing `balanced` profile. A TOML comparison
   proves that every other value, including filesystem denials, network domains, default profile,
   `workspace-write`, on-request approvals and Auto-review, is identical. No wildcard sockets,
   Full Access, approval bypass or key-directory grant is added. The socket allowance applies to
   sessions using `balanced`; it is not a repository-specific access-control rule.

Reload Codex and resume this chat so the effective permission profile can change. The next agent
step is to read the **public** receipt, test the exact socket and signer in the fresh sandbox,
verify a disposable signed commit, and then commit the exact staged checkpoint using the existing
no-stash, partial-index-preserving hook adapter. Signing failure must stop the commit. Existing
identity/format checks, validation requirements and all release gates remain required.
This activation sequence has now completed through scoped approval, as recorded above.

The receipt is `~/.local/share/green-goods-signing/receipt.json`. A successful host rehearsal is not
proof that this desktop executor accepts the socket rule. The current macOS launchd agent was
unreachable even during an approved public-fingerprint command. Official configuration guidance
also warns that legacy sandbox settings can take precedence over permission profiles. This setup
preserves the existing mixed settings; it does not migrate them. If the fresh sandbox still rejects
the socket or managed policy excludes the rule, stop and review the effective policy. Do not remove
file denials or enable unrestricted sockets as a workaround.

The new key is local. It is not registered with GitHub by this setup. Local cryptographic validity
does not establish GitHub's Verified badge; register only its public key as a signing key separately
if that later becomes necessary and authorized.

## Subsequent work sessions

While the key is loaded, the agent can request signed local commits through scoped approval
without reading key files. Direct signing in the default sandbox remains unproved. After the four-hour key
lifetime expires, unlock the same agent from Terminal:

```sh
bun --no-env-file "$HOME/.local/share/green-goods-signing/setup.mjs" unlock
```

Supply `--existing-key /absolute/key/path` again if you chose a non-default key. No key rotation is
automatic. If a stale socket remains after an OS restart, the setup stops for inspection rather
than replacing it blindly. Existing task-owned changes are staged only after their selected proof;
no broad `git add`, auto-stash, reset, push or unsigned fallback is part of this workflow.

## Rollback

From Terminal:

```sh
bun --no-env-file "$HOME/.local/share/green-goods-signing/setup.mjs" rollback
```

This restores the recorded repository-local signing settings, retains required signing, removes
only the socket rule added by this setup, and unloads only the selected key from this dedicated
agent. It preserves unrelated later configuration edits and refuses to overwrite conflicting edits.
Private key files remain yours. Reload Codex after rollback. A partially interrupted installation
requires inspection of the private installation directory and its `previous-git-settings.json`;
do not retry by deleting unrelated files or disabling signing.

## Preparation evidence

Run the one-shot verification through its disposable Bun wrapper:

```sh
bun --no-env-file run --cwd /private/tmp/green-goods-signing-setup-20261022/verification test
```

[verify.mjs](verify.mjs) covers precise permission changes, unchanged file denials/defaults/domains,
idempotence, explicit denial, user-terminal enforcement, public-key validation, namespace rejection,
actual signature/principal verification, altered-payload rejection, real Git verification, wrong
trust, unavailable signers and bounded rollback that preserves concurrent edits. Two additional
checks cover a staged binary larger than the subprocess buffer and detection of staged content,
mode, path and removal changes while ignoring independent unstaged edits.

The fixture uses a newly generated disposable private key, with the agent edge replaced by that
explicit fixture key. It is accurately labeled cryptographic/interface proof, not real-user,
host-agent or desktop-sandbox proof. The initial syntax failure, verification-wrapper assertion
failure and fixture argument repair are retained separately; no compiler/fixture failure is called
behavioral RED. Thirteen final checks pass. Exact logs and the candidate configuration hashes are
under `/private/tmp/green-goods-signing-setup-20261022/`; neither real keys nor configuration contents
are copied there. The public setup source stays in this Plan Hub; no production runtime,
repository manifest, persistent hook, dependency or agent permission has been changed yet.

The only added `package.json` is a disposable **test wrapper** in that temporary evidence folder;
it installs no dependencies and changes no repository package manifest or lockfile. JavaScript in
Plan Hubs is ignored by the repository formatter, so these two sources were formatted through its
stdin interface without changing the formatter configuration. Both stdin lint candidates pass and
are byte-identical to the source; the initial no-write stdin invocation was a CLI protocol failure,
not a source lint finding. The sensitive QA selector passes **2/2 fresh**, but both commands process
zero files because Plan Hub code is excluded. Meaningful source proof is the thirteen checks and the
two explicit stdin formatter/linter checks. Plan validation passes **34 hubs**; guidance links pass
**94 files** with the existing DL-042 warning retained. Exact logs are alongside the final test log;
none recertifies the older staged contract checkpoint as a new commit.

The failed Terminal attempt and fresh-session investigation are recorded under
`/private/tmp/green-goods-signing-sandbox-20261022/`. The large-checkpoint regression reproduced
the reported `ENOBUFS` failure before the fix. Its initial subsequent run caught a fixture mode
mismatch; that fixture was repaired without forcing removal. The final thirteen checks pass.
The 145 committed blobs match the approved checkpoint, with the independent Portuguese translation
retained outside the index. Host signing passed after installation and again after a user-operated
unlock. Fresh-session default-sandbox access was denied; scoped approved signing passed.
`active-signer-proof.json` records the disposable probe. `checkpoint-commit-result.json` records
the exact committed blobs, unchanged working files, empty index and preserved partial translation.
Earlier checks remain working-tree evidence; their 134 non-plan source hashes still matched
before the commit. No new commit-attributed validation receipt, member passkey proof or release
readiness is claimed by this signing check. This setup source and its post-commit record remain
local and outside that checkpoint.

Sources: [Git signing configuration](https://git-scm.com/docs/git-config/2.46.1.html),
[OpenSSH signing](https://man.openbsd.org/ssh-keygen),
[Codex permission profiles and exact Unix-socket rules](https://learn.chatgpt.com/docs/permissions).

Task record: cosmo-local-credit-interop | Type: local signing workflow | Outcome: complete for the requested signed checkpoint; default-sandbox socket access remains blocked
Agent/model: Codex / model identifier unknown | Coverage: setup and signed checkpoint continuations only

| Phase | Start → end (UTC) | Result / evidence or blocker |
|---|---|---|
| Investigate | Unknown → 2026-10-22 07:17:47 | Required GPG signing retained; existing SSH agent blocked; published exact-socket rules and actual configuration inspected |
| Implement / verify | Unknown → 2026-10-22 07:39:15 | Prepared user-operated setup, fail-closed signer and rollback; eleven checks and selected/static validation pass with stated proof limits |
| Wait | Unknown → 2026-10-22 10:01:37 | User-operated installation completed; later four-hour expiry required another user-operated unlock |
| Diagnose / repair installer | 2026-10-22 09:48:41 → 2026-10-22 09:57:46 | Matched all 145 staged blobs; reproduced and repaired large-diff output overflow; thirteen focused checks pass; no key access, permission change or checkpoint commit |
| Verify / commit | 2026-10-22 17:56:26 → 2026-10-22 18:00:22 | Default socket access denied; scoped approval and user unlock enabled the disposable probe and exact 145-path commit; signature, committed blobs and 315 unchanged working files verified |

Human corrections: 0 observed in this segment; attention: unknown.
