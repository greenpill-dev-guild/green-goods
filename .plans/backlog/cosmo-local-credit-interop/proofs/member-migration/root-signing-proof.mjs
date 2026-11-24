// Local characterization only: public software credential, no production migration or provider.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  aa,
  assertLocalRpc,
  EXPECTED,
  KERNEL_ABI,
  LEGACY,
  ownerCoordinates,
  PATCHED,
  root,
  rootId,
  startFixture,
  v,
} from "./fixture.mjs";

const out = "/private/tmp/green-goods-root-signing-20261022";
mkdirSync(out, { recursive: true });
const key = (validator, type = "00") => BigInt("0x00" + type + validator.slice(2) + "0000");
const mode = (nonce) => v.toHex(nonce, { size: 32 }).slice(2, 6);
const validateSelector = v.toFunctionSelector(
  "validateUserOp((address,uint256,bytes,bytes,bytes32,uint256,bytes32,bytes,bytes),bytes32)"
);
assert.equal(mode(key(LEGACY) << 64n), "0000");
assert.equal(mode(key(LEGACY, "01") << 64n), "0001");
assert.notEqual(key(LEGACY), key(PATCHED));
assert.throws(() => assertLocalRpc("https://example.com/"));
if (process.argv[2] === "--guards") {
  assert.equal(process.argv.length, 3);
  process.stdout.write("PASS root/module nonce discrimination and local-only signing guard\n");
} else {
  assert.equal(process.argv.length, 2);
  const inputs = [
    ".plans/backlog/cosmo-local-credit-interop/proofs/member-migration/root-signing-proof.mjs",
    ".plans/backlog/cosmo-local-credit-interop/proofs/member-migration/fixture.mjs",
    ".plans/backlog/cosmo-local-credit-interop/artifacts/member-readiness-2026-10-22.json",
    ".plans/backlog/cosmo-local-credit-interop/artifacts/member-migration-characterization-2026-10-22.json",
    "packages/contracts/test/helpers/MemberMigrationFailureFixture.sol",
    "packages/contracts/.generated/foundry/out/default/MemberMigrationFailureFixture.sol/MemberMigrationFailureFixture.json",
    "packages/contracts/foundry.toml",
    "packages/contracts/foundry.lock",
    "packages/contracts/package.json",
    "packages/shared/package.json",
    "bun.lock",
    "node_modules/.bun/permissionless@0.2.57+fc74d5abac655535/node_modules/permissionless/accounts/kernel/toKernelSmartAccount.ts",
    "node_modules/.bun/permissionless@0.2.57+fc74d5abac655535/node_modules/permissionless/accounts/kernel/utils/getNonceKey.ts",
  ];
  const hashes = () =>
    Object.fromEntries(
      inputs.map((file) => [
        file,
        createHash("sha256")
          .update(readFileSync(path.join(root, file)))
          .digest("hex"),
      ])
    );
  const beforeHashes = hashes();
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const workingTreeStatus = execFileSync("git", ["status", "--porcelain=v1", "--", ...inputs], {
    cwd: root,
    encoding: "utf8",
  });
  const f = await startFixture("gnosis", out);
  const rows = [];
  const nonce = (validator, type = "00") =>
    f.client.readContract({
      address: aa.entryPoint07Address,
      abi: aa.entryPoint07Abi,
      functionName: "getNonce",
      args: [EXPECTED, key(validator, type)],
    });
  const state = async () => ({
    account: await f.state(),
    rootLegacyKey: await nonce(LEGACY),
    rootPatchedKey: await nonce(PATCHED),
    explicitLegacyKey: await nonce(LEGACY, "01"),
  });
  const signed = async (operation, account, chainId = f.cfg.id) => ({
    ...operation,
    signature: await account.signUserOperation({ ...operation, chainId }),
  });
  const traceValidators = async (receipt) => {
    const trace = await f.request("debug_traceTransaction", [
      receipt.transaction,
      { tracer: "callTracer" },
    ]);
    const matches = [];
    const visit = (call) => {
      if (
        [LEGACY, PATCHED].some((a) => a.toLowerCase() === call.to?.toLowerCase()) &&
        call.input?.startsWith(validateSelector)
      )
        matches.push({
          from: call.from,
          to: call.to,
          type: call.type,
          selector: call.input.slice(0, 10),
          output: call.output,
          error: call.error,
        });
      for (const child of call.calls ?? []) visit(child);
    };
    visit(trace);
    return matches;
  };
  const success = async (operation, expectedValidator) => {
    const receipt = await f.submit(operation);
    assert.equal(receipt.status, "success");
    assert.equal(receipt.event?.success, true);
    const validators = await traceValidators(receipt);
    assert.equal(validators.length, 1);
    assert.equal(validators[0].from.toLowerCase(), EXPECTED);
    assert.equal(validators[0].to.toLowerCase(), expectedValidator.toLowerCase());
    assert.equal(validators[0].output, v.toHex(0n, { size: 32 }));
    assert.equal(validators[0].error, undefined);
    return { receipt, validators };
  };
  const rejected = async (operation, reason) => {
    const before = await state();
    const receipt = await f.submit(operation);
    assert.equal(receipt.status, "reverted");
    assert.equal(receipt.event, undefined);
    assert.ok(receipt.outerFailure?.errorName?.startsWith("FailedOp"));
    assert.ok(receipt.outerFailure.args.some((a) => typeof a === "string" && a.includes(reason)));
    assert.deepEqual(await state(), before, "Rejected operation changed account state or nonce");
    return { receipt, validators: await traceValidators(receipt), after: await state() };
  };
  const record = (label, details) => {
    rows.push({ label, ...details, migrationReady: false });
    process.stdout.write("PASS gnosis " + label + "\n");
  };
  try {
    const oldClient = await f.makeAccount();
    const patchedClient = await f.makeAccount(PATCHED);
    const original = await state();
    assert.equal(original.account.exists, false);
    const changed = await success(
      await signed(await f.operation(f.delegated("changeThenReturn")), oldClient),
      LEGACY
    );
    const afterChange = await state();
    assert.equal(afterChange.account.root.toLowerCase(), rootId(PATCHED).toLowerCase());
    assert.equal(afterChange.account.oldModule, true);
    assert.deepEqual(afterChange.account.keys.legacy, ownerCoordinates);
    record("canonical_creation_and_controlled_root_change", { original, changed, afterChange });

    const call = await patchedClient.encodeCalls([
      {
        to: EXPECTED,
        value: 0n,
        data: v.encodeFunctionData({ abi: KERNEL_ABI, functionName: "rootValidator" }),
      },
    ]);
    const oldNamedOp = await f.operation(call, { factory: false, account: oldClient });
    assert.equal(mode(oldNamedOp.nonce), "0000");
    const oldNamed = await success(await signed(oldNamedOp, oldClient), PATCHED);
    record("old_client_root_nonce_dispatches_active_patched_validator", oldNamed);

    const remove = await patchedClient.encodeCalls([
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
    const removed = await success(
      await signed(
        await f.operation(remove, { factory: false, account: patchedClient }),
        patchedClient
      ),
      PATCHED
    );
    const afterRemoval = await state();
    assert.equal(afterRemoval.account.oldModule, false);
    assert.deepEqual(afterRemoval.account.keys.legacy, [0n, 0n]);
    assert.deepEqual(afterRemoval.account.keys.patched, ownerCoordinates);
    record("patched_root_authorizes_explicit_legacy_uninstall", { ...removed, afterRemoval });

    const operation = () => f.operation(call, { factory: false, account: patchedClient });
    const good = await signed(await operation(), patchedClient);
    const delivered = await success(good, PATCHED);
    record("patched_client_signs_after_uninstall_at_same_address", {
      ...delivered,
      after: await state(),
    });
    record("identical_patched_operation_replay_rejected", await rejected(good, "AA25"));

    const explicit = { ...(await operation()), nonce: await nonce(LEGACY, "01") };
    assert.equal(mode(explicit.nonce), "0001");
    const explicitFailure = await rejected(await signed(explicit, oldClient), "AA23");
    assert.equal(explicitFailure.validators.length, 1);
    assert.equal(explicitFailure.validators[0].to.toLowerCase(), LEGACY.toLowerCase());
    assert.equal(explicitFailure.validators[0].output, v.toHex(1n, { size: 32 }));
    assert.equal(
      explicitFailure.receipt.outerFailure.args[2],
      v.toFunctionSelector("InvalidValidator()")
    );
    record("explicit_uninstalled_legacy_validator_rejected", explicitFailure);

    for (const [label, tamper] of [
      ["patched_wrong_chain_rejected", async (op) => signed(op, patchedClient, f.cfg.id + 1)],
      [
        "patched_wrong_account_rejected",
        async (op) => ({
          ...op,
          signature: (
            await signed(
              { ...op, sender: "0x1111111111111111111111111111111111111111" },
              patchedClient
            )
          ).signature,
        }),
      ],
      [
        "patched_changed_payload_rejected",
        async (op) => ({
          ...(await signed(op, patchedClient)),
          callData: f.delegated("failBeforeChange"),
        }),
      ],
    ]) {
      const result = await rejected(await tamper(await operation()), "AA24");
      assert.equal(result.validators.length, 1);
      assert.equal(result.validators[0].to.toLowerCase(), PATCHED.toLowerCase());
      record(label, result);
    }

    const retryNonce = await nonce(PATCHED);
    const repaired = await success(await signed(await operation(), patchedClient), PATCHED);
    assert.equal(repaired.receipt.operation.nonce, retryNonce);
    assert.equal(await nonce(PATCHED), retryNonce + 1n);
    record("corrected_patched_signature_reuses_unconsumed_nonce", repaired);

    const legacyKeyOp = await f.operation(call, { factory: false, account: oldClient });
    const rootStillPatched = await success(await signed(legacyKeyOp, oldClient), PATCHED);
    const finalState = await state();
    assert.equal(finalState.account.oldModule, false);
    assert.deepEqual(finalState.account.keys.legacy, [0n, 0n]);
    record("legacy_address_root_nonce_is_not_legacy_authority", {
      ...rootStillPatched,
      finalState,
    });
    assert.deepEqual(hashes(), beforeHashes, "Proof inputs changed during execution");
    writeFileSync(
      path.join(out, "root-signing-gnosis.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          observedAt: new Date().toISOString(),
          head,
          workingTreeStatus,
          sourceHashes: beforeHashes,
          command: process.argv,
          chainId: f.cfg.id,
          pin: f.pin,
          address: EXPECTED,
          dependencies: f.dependencies,
          nodeInfo: f.nodeInfo,
          rows,
          scope: {
            memberPossessionProved: false,
            hostedBundlerProved: false,
            sponsorshipProved: false,
            helperExecuted: false,
            helperCertified: false,
            migrationReady: false,
            productionConfigChanged: false,
            liveBroadcast: false,
          },
          credential: "Public P256 scalar 1 and synthetic greengoods.test WebAuthn responses",
          transport:
            "Read-only Alchemy bridge; genuine historical fork cache, exact provenance in handoff",
        },
        (_, value) => (typeof value === "bigint" ? value.toString() : value),
        2
      ) + "\n"
    );
    process.stdout.write("RESULT " + rows.length + " Gnosis root-signing boundary cases\n");
  } finally {
    await f.stop();
  }
}
