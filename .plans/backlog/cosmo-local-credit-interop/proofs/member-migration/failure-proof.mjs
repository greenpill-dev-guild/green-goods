// Characterization of real EntryPoint/Kernel boundaries; never a production migration runner.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  assertLocalRpc,
  assertNodeInfo,
  configs,
  EXPECTED,
  KERNEL_ABI,
  LEGACY,
  ownerCoordinates,
  PATCHED,
  prior,
  root,
  rootId,
  startFixture,
  v,
} from "./fixture.mjs";

const out = "/private/tmp/green-goods-helper-failure-20261022";
mkdirSync(out, { recursive: true });
function guards() {
  for (const rpc of [
    "https://127.0.0.1:1234/",
    "http://example.com:1234/",
    "http://127.0.0.1:1234/other",
    "http://user:pass@127.0.0.1:1234/",
    "http://127.0.0.1:1234/?x=1",
  ]) {
    assert.throws(() => assertLocalRpc(rpc));
  }
  assertLocalRpc("http://127.0.0.1:1234/");
  assert.throws(() =>
    assertNodeInfo(
      { environment: { chainId: 1 }, forkConfig: { forkBlockNumber: 1 } },
      { id: 100 },
      { number: "0x1" }
    )
  );
  assert.throws(() =>
    assertNodeInfo(
      { environment: { chainId: 100 }, forkConfig: { forkBlockNumber: 2 } },
      { id: 100 },
      { number: "0x1" }
    )
  );
  process.stdout.write("PASS loopback signing confinement and exact chain/block rejection\n");
}
guards();
if (process.argv[2] === "--guards") {
  assert.equal(process.argv.length, 3);
} else {
  assert.equal(process.argv[2], "--network");
  assert.equal(process.argv.length, 4);
  const name = process.argv[3];
  assert.ok(configs[name]);
  const inputs = [
    ".plans/backlog/cosmo-local-credit-interop/proofs/member-migration/fixture.mjs",
    ".plans/backlog/cosmo-local-credit-interop/proofs/member-migration/failure-proof.mjs",
    ".plans/backlog/cosmo-local-credit-interop/proofs/member-migration/alchemy-gateway.mjs",
    ".plans/backlog/cosmo-local-credit-interop/artifacts/member-readiness-2026-10-22.json",
    ".plans/backlog/cosmo-local-credit-interop/artifacts/member-migration-characterization-2026-10-22.json",
    "packages/contracts/.generated/foundry/out/default/MemberMigrationFailureFixture.sol/MemberMigrationFailureFixture.json",
    "packages/contracts/test/helpers/MemberMigrationFailureFixture.sol",
    "packages/contracts/foundry.toml",
    "packages/contracts/foundry.lock",
    "packages/contracts/package.json",
    "packages/shared/package.json",
    "bun.lock",
  ];
  const digest = () =>
    Object.fromEntries(
      inputs.map((file) => [
        file,
        createHash("sha256")
          .update(readFileSync(path.join(root, file)))
          .digest("hex"),
      ])
    );
  const beforeHashes = digest();
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const status = execFileSync(
    "git",
    ["status", "--porcelain=v1", "--untracked-files=all", "--", ...inputs],
    { cwd: root, encoding: "utf8" }
  );
  const f = await startFixture(name, out);
  const rows = [];
  const sequence = (s) => s.nonce & ((1n << 64n) - 1n);
  const key = ownerCoordinates;
  const absent = (s) => {
    assert.equal(s.exists, false);
    assert.equal(sequence(s), 0n);
    assert.deepEqual(s.keys.legacy, [0n, 0n]);
    assert.deepEqual(s.keys.patched, [0n, 0n]);
  };
  const legacy = (s, nonce) => {
    assert.equal(s.exists, true);
    assert.equal(s.root.toLowerCase(), rootId(LEGACY).toLowerCase());
    assert.equal(sequence(s), BigInt(nonce));
    assert.equal(s.oldModule, true);
    assert.equal(s.patchedModule, false);
    assert.deepEqual(s.keys.legacy, key);
    assert.deepEqual(s.keys.patched, [0n, 0n]);
  };
  async function run(label, action) {
    await f.reset();
    const before = await f.state();
    absent(before);
    const detail = await action();
    rows.push({ label, before, ...detail, migrationReady: false });
    process.stdout.write("PASS " + name + " " + label + "\n");
  }
  const failedExecution = (sent) => {
    assert.equal(sent.status, "success");
    assert.equal(sent.event.success, false);
  };
  const failedValidation = (sent) => {
    assert.equal(sent.status, "reverted");
    assert.equal(sent.event, undefined);
  };
  try {
    for (const [label, tamper] of [
      ["wrong_chain_validation", async (op) => f.signed(op, f.cfg.id + 1)],
      [
        "wrong_account_validation",
        async (op) => ({
          ...op,
          signature: await (await f.makeAccount()).signUserOperation({
            ...op,
            sender: "0x00000000000000000000000000000000000000f1",
            chainId: f.cfg.id,
          }),
        }),
      ],
      [
        "changed_payload_validation",
        async (op) => {
          const signed = await f.signed(op);
          return {
            ...signed,
            callData: await (await f.makeAccount()).encodeCalls([
              { to: EXPECTED, value: 0n, data: "0x" },
            ]),
          };
        },
      ],
    ]) {
      await run(label, async () => {
        const op = await f.operation(f.delegated("failBeforeChange"));
        const sent = await f.submit(await tamper(op));
        failedValidation(sent);
        assert.match(String(sent.outerFailure?.args?.[1]), /AA24/);
        const after = await f.state();
        absent(after);
        return { sent, after };
      });
    }
    await run("validation_gas_exhaustion", async () => {
      const op = await f.operation(f.delegated("failBeforeChange"), {
        verificationGasLimit: 50_000n,
      });
      const sent = await f.submit(await f.signed(op));
      failedValidation(sent);
      assert.match(String(sent.outerFailure?.args?.[1]), /AA13|AA23|AA40/);
      const after = await f.state();
      absent(after);
      return { sent, after };
    });
    await run("execution_revert_before_change_and_retry", async () => {
      const payload = f.delegated("failBeforeChange");
      const op = await f.signed(await f.operation(payload));
      const first = await f.submit(op);
      failedExecution(first);
      const afterFirst = await f.state();
      legacy(afterFirst, 1);
      const replay = await f.submit(op);
      failedValidation(replay);
      const afterReplay = await f.state();
      assert.deepEqual(afterReplay, afterFirst);
      const retry = await f.submit(await f.signed(await f.operation(payload, { factory: false })));
      failedExecution(retry);
      const afterRetry = await f.state();
      legacy(afterRetry, 2);
      return {
        first,
        afterFirst,
        exactReplay: replay,
        afterReplay,
        repairedNonceRetry: retry,
        afterRetry,
        unsafeOutcome:
          "Account creation survives failed execution; accepted nonce is consumed and the legacy root remains active",
      };
    });
    await run("root_change_then_execution_revert", async () => {
      const sent = await f.submit(await f.signed(await f.operation(f.delegated("changeThenFail"))));
      failedExecution(sent);
      const after = await f.state();
      legacy(after, 1);
      return {
        sent,
        after,
        unsafeOutcome:
          "Root/key installation rolls back while initial legacy account creation survives",
      };
    });
    await run("root_change_then_execution_gas_exhaustion", async () => {
      const sent = await f.submit(
        await f.signed(
          await f.operation(f.delegated("changeThenExhaustGas"), { callGasLimit: 160_000n })
        )
      );
      failedExecution(sent);
      const after = await f.state();
      legacy(after, 1);
      return {
        sent,
        after,
        unsafeOutcome:
          "Execution gas failure consumes the nonce and leaves the newly created legacy account",
      };
    });
    await run("successful_root_only_change_retains_legacy_module", async () => {
      const sent = await f.submit(
        await f.signed(await f.operation(f.delegated("changeThenReturn")))
      );
      assert.equal(sent.status, "success");
      assert.equal(sent.event.success, true);
      const after = await f.state();
      assert.equal(after.root.toLowerCase(), rootId(PATCHED).toLowerCase());
      assert.equal(after.oldModule, true);
      assert.equal(after.patchedModule, true);
      assert.deepEqual(after.keys.legacy, key);
      assert.deepEqual(after.keys.patched, key);
      assert.equal(sequence(after), 1n);
      return {
        sent,
        after,
        unsafeOutcome: "A changed root is not legacy-validator uninstall or legacy-key removal",
      };
    });
    await run("explicit_uninstall_control_and_later_failure", async () => {
      const changed = await f.submit(
        await f.signed(await f.operation(f.delegated("changeThenReturn")))
      );
      assert.equal(changed.event.success, true);
      const account = await f.makeAccount(PATCHED);
      const remove = await account.encodeCalls([
        {
          to: EXPECTED,
          value: 0n,
          data: v.encodeFunctionData({
            abi: KERNEL_ABI,
            functionName: "uninstallModule",
            args: [1n, LEGACY, "0x"],
          }),
        },
      ]);
      const removed = await f.submit(await f.signed(await f.operation(remove, { factory: false })));
      assert.equal(removed.event.success, true);
      const afterRemoval = await f.state();
      assert.equal(afterRemoval.root.toLowerCase(), rootId(PATCHED).toLowerCase());
      assert.equal(afterRemoval.oldModule, false);
      assert.equal(afterRemoval.patchedModule, true);
      assert.deepEqual(afterRemoval.keys.legacy, [0n, 0n]);
      assert.deepEqual(afterRemoval.keys.patched, key);
      const later = await f.submit(
        await f.signed(await f.operation(f.delegated("failBeforeChange"), { factory: false }))
      );
      failedExecution(later);
      const afterLaterFailure = await f.state();
      assert.equal(afterLaterFailure.root, afterRemoval.root);
      assert.equal(afterLaterFailure.oldModule, false);
      assert.deepEqual(afterLaterFailure.keys, afterRemoval.keys);
      assert.equal(sequence(afterLaterFailure), sequence(afterRemoval) + 1n);
      return {
        changed,
        removed,
        afterRemoval,
        laterFailure: later,
        afterLaterFailure,
        proofLimit:
          "Controlled existing-Kernel self-call/uninstall proof only; unverified helper was not executed or certified",
      };
    });
    assert.deepEqual(digest(), beforeHashes, "Proof source changed during execution");
    const result = {
      schemaVersion: 1,
      head,
      validatedPaths: inputs,
      sourceHashes: beforeHashes,
      workingTreeStatus: status,
      command: process.argv,
      observedAt: new Date().toISOString(),
      network: name,
      transport:
        "Process-supplied read-only upstream; provider and complete bytecode provenance recorded in the handoff",
      chainId: f.cfg.id,
      pin: f.pin,
      configuration: prior.configuration,
      nodeInfo: f.nodeInfo,
      address: EXPECTED,
      credential:
        "Public P256 scalar 1 fixture and synthetic greengoods.test WebAuthn responses; not member possession",
      execution:
        "Runner-owned loopback Anvil fork; real Kernel0.3.1, EntryPoint0.7 and WebAuthn validator bytecode",
      dependencies: f.dependencies,
      rows,
      scope: {
        broadcast: false,
        productionConfigChanged: false,
        memberPossessionProved: false,
        sponsorshipProved: false,
        helperExecuted: false,
        helperCertified: false,
        migrationReady: false,
      },
    };
    const file = path.join(out, "failure-" + name + ".json");
    writeFileSync(
      file,
      JSON.stringify(
        result,
        (_, value) => (typeof value === "bigint" ? value.toString() : value),
        2
      ) + "\n"
    );
    process.stdout.write("RESULT " + file + " " + rows.length + " boundary cases\n");
  } finally {
    await f.stop();
  }
}
