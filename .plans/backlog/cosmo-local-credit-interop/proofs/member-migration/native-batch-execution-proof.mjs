// Isolated pinned-fork characterization with a public synthetic credential.
// No hosted bundler, actual-member ceremony, production helper or live migration is selected.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  startFixture,
  v,
  aa,
  EXPECTED,
  LEGACY,
  PATCHED,
  KERNEL_ABI,
  rootId,
  installData,
  ownerCoordinates,
  root,
} from "./fixture.mjs";
const out = "/private/tmp/green-goods-native-batch-20261022";
mkdirSync(out, { recursive: true });
assert.equal(process.argv.length, 2, "This proof accepts no execution or network arguments");
const inputs = [
  import.meta.path,
  root + "/.plans/backlog/cosmo-local-credit-interop/proofs/member-migration/fixture.mjs",
  root + "/.plans/backlog/cosmo-local-credit-interop/artifacts/member-readiness-2026-10-22.json",
  root +
    "/.plans/backlog/cosmo-local-credit-interop/artifacts/member-migration-characterization-2026-10-22.json",
];
const hashes = () =>
  Object.fromEntries(
    inputs.map((p) => [
      p.replace(root + "/", ""),
      createHash("sha256").update(readFileSync(p)).digest("hex"),
    ])
  );
const sourceSha256 = hashes();
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
const f = await startFixture("gnosis", out);
const rows = [];
const abi = v.parseAbi(["function onUninstall(bytes)"]);
const call = (functionName, args) => ({
  to: EXPECTED,
  value: 0n,
  data: v.encodeFunctionData({ abi: KERNEL_ABI, functionName, args }),
});
const migration = [
  call("changeRootValidator", [rootId(PATCHED), v.zeroAddress, installData, "0x"]),
  call("uninstallModule", [1n, LEGACY, "0x"]),
];
const cleanup = {
  to: LEGACY,
  value: 0n,
  data: v.encodeFunctionData({ abi, functionName: "onUninstall", args: ["0x"] }),
};
const record = (label, data) => {
  rows.push({ label, ...data, migrationReady: false });
  console.log("PASS " + label);
};
const run = async (calls, account, factory = false) => {
  const data = await account.encodeCalls(calls);
  const decoded = v.decodeFunctionData({ abi: KERNEL_ABI, data });
  if (calls.length > 1) assert.equal(decoded.args[0], "0x0100" + "00".repeat(30));
  const op = await f.operation(data, { account, factory, callGasLimit: 1000000n });
  return f.submit({ ...op, signature: await account.signUserOperation({ ...op, chainId: 100 }) });
};
const successful = (r) => {
  assert.equal(r.status, "success");
  assert.equal(r.event.success, true);
};
const clean = async () => {
  const s = await f.state();
  assert.equal(s.root.toLowerCase(), rootId(PATCHED).toLowerCase());
  assert.equal(s.oldModule, false);
  assert.deepEqual(s.keys.legacy, [0n, 0n]);
  assert.deepEqual(s.keys.patched, ownerCoordinates);
  return s;
};
try {
  const old = await f.makeAccount(),
    patched = await f.makeAccount(PATCHED);
  const before = await f.state();
  assert.equal(before.exists, false);
  const r = await run([migration[0], cleanup, migration[1]], old, true);
  successful(r);
  const trace = await f.request("debug_traceTransaction", [
    r.transaction,
    { tracer: "callTracer" },
  ]);
  const migrationCalls = [];
  const visit = (c) => {
    if (
      c.from?.toLowerCase() === EXPECTED.toLowerCase() &&
      [EXPECTED, LEGACY].some((a) => a.toLowerCase() === c.to?.toLowerCase())
    )
      migrationCalls.push({
        from: c.from,
        to: c.to,
        type: c.type,
        selector: c.input?.slice(0, 10),
        error: c.error,
      });
    for (const child of c.calls ?? []) visit(child);
  };
  visit(trace);
  const migrationSelectors = [
    v.toFunctionSelector("changeRootValidator(bytes21,address,bytes,bytes)"),
    v.toFunctionSelector("onUninstall(bytes)"),
    v.toFunctionSelector("uninstallModule(uint256,address,bytes)"),
  ];
  const direct = migrationCalls.filter(
    (c) => c.type === "CALL" && migrationSelectors.includes(c.selector)
  );
  assert.deepEqual(
    direct.map((c) => c.selector),
    [
      v.toFunctionSelector("changeRootValidator(bytes21,address,bytes,bytes)"),
      v.toFunctionSelector("onUninstall(bytes)"),
      v.toFunctionSelector("uninstallModule(uint256,address,bytes)"),
      v.toFunctionSelector("onUninstall(bytes)"),
    ]
  );
  assert.equal(direct[1].error, undefined);
  assert.ok(direct[3].error, "The duplicate callback is expected to revert after direct cleanup");
  record("fresh_canonical_creation_three_call_native_batch_cleans_both_authority_and_keys", {
    before,
    receipt: r,
    migrationCalls,
    after: await clean(),
  });
  const r2 = await run([call("rootValidator", [])], patched);
  successful(r2);
  record("patched_root_signs_after_native_cleanup_same_address", {
    receipt: r2,
    after: await clean(),
  });
  await f.reset();
  // Establish an account before injecting a local callback-only fault. Every other selector
  // delegates to the original validator runtime at an isolated, local-only code copy.
  successful(await run([call("rootValidator", [])], old, true));
  const runtime = await f.client.getCode({ address: LEGACY });
  const backend = "0x1000000000000000000000000000000000000001";
  await f.request("anvil_setCode", [backend, runtime]);
  const selector = v.toFunctionSelector("onUninstall(bytes)");
  // if selector matches: jump to revert; otherwise delegate all calldata and bubble returndata.
  const prefix = "60003560e01c63" + selector.slice(2) + "14600057";
  const delegate =
    "3660006000376000600036600073" + backend.slice(2) + "5af43d600060003e6000573d6000fd5b3d6000f3";
  const revert = "5b60006000fd";
  const bytes = (prefix + delegate).length / 2;
  const delegateSuccessOffset = prefix.length / 2 + delegate.indexOf("5b3d") / 2;
  const fault =
    "0x" +
    prefix.replace("600057", "60" + bytes.toString(16).padStart(2, "0") + "57") +
    delegate.replace("600057", "60" + delegateSuccessOffset.toString(16).padStart(2, "0") + "57") +
    revert;
  await f.request("anvil_setCode", [LEGACY, fault]);
  const faultBefore = await f.state();
  assert.deepEqual(faultBefore.keys.legacy, ownerCoordinates);
  const bad = await run(migration, old);
  successful(bad);
  const residue = await f.state();
  assert.equal(residue.root.toLowerCase(), rootId(PATCHED).toLowerCase());
  assert.equal(residue.oldModule, false);
  assert.deepEqual(residue.keys.legacy, ownerCoordinates);
  record("two_call_batch_reports_success_despite_forced_cleanup_failure", {
    faultRuntime: fault,
    before: faultBefore,
    receipt: bad,
    after: residue,
  });
  await f.reset();
  successful(await run([call("rootValidator", [])], old, true));
  await f.request("anvil_setCode", [backend, runtime]);
  await f.request("anvil_setCode", [LEGACY, fault]);
  const atomicBefore = await f.state();
  const failed = await run([migration[0], cleanup, migration[1]], old);
  assert.equal(failed.status, "success");
  assert.equal(failed.event.success, false);
  const atomicAfter = await f.state();
  assert.equal(atomicAfter.root, atomicBefore.root);
  assert.equal(atomicAfter.oldModule, true);
  assert.deepEqual(atomicAfter.keys, atomicBefore.keys);
  assert.equal(atomicAfter.nonce, atomicBefore.nonce + 1n);
  record("explicit_cleanup_failure_reverts_native_batch_but_consumes_entrypoint_nonce", {
    before: atomicBefore,
    receipt: failed,
    after: atomicAfter,
  });
  await f.request("anvil_setCode", [LEGACY, runtime]);
  const retry = await run([migration[0], cleanup, migration[1]], old);
  successful(retry);
  record("restored_callback_retry_uses_next_nonce_and_completes_cleanup", {
    receipt: retry,
    after: await clean(),
  });
  const recover = await run([call("rootValidator", [])], patched);
  successful(recover);
  record("patched_root_remains_usable_after_failed_attempt_and_retry", {
    receipt: recover,
    after: await clean(),
  });
  await f.reset();
  const wrongOrder = await run([...migration, cleanup], old, true);
  assert.equal(wrongOrder.status, "success");
  assert.equal(wrongOrder.event.success, false);
  const wrongAfter = await f.state();
  assert.equal(wrongAfter.root.toLowerCase(), rootId(LEGACY).toLowerCase());
  assert.deepEqual(wrongAfter.keys.legacy, ownerCoordinates);
  assert.deepEqual(wrongAfter.keys.patched, [0n, 0n]);
  record("cleanup_after_module_removal_is_rejected_duplicate_callback_and_rolls_back", {
    receipt: wrongOrder,
    after: wrongAfter,
  });
  await f.reset();
  await f.request("anvil_setCode", [backend, runtime]);
  await f.request("anvil_setCode", [LEGACY, fault]);
  const freshFailed = await run([migration[0], cleanup, migration[1]], old, true);
  assert.equal(freshFailed.status, "success");
  assert.equal(freshFailed.event.success, false);
  const freshAfter = await f.state();
  assert.equal(freshAfter.exists, true);
  assert.equal(freshAfter.root.toLowerCase(), rootId(LEGACY).toLowerCase());
  assert.deepEqual(freshAfter.keys.legacy, ownerCoordinates);
  assert.deepEqual(freshAfter.keys.patched, [0n, 0n]);
  record("fresh_account_execution_failure_preserves_creation_and_original_control", {
    receipt: freshFailed,
    after: freshAfter,
  });
  await f.request("anvil_setCode", [LEGACY, runtime]);
  const freshRetry = await run([migration[0], cleanup, migration[1]], old, false);
  successful(freshRetry);
  record("fresh_account_failed_creation_operation_recovers_with_next_nonce_without_factory", {
    receipt: freshRetry,
    after: await clean(),
  });
  assert.deepEqual(hashes(), sourceSha256, "Proof inputs changed during execution");
  writeFileSync(
    out + "/result.json",
    JSON.stringify(
      {
        sourceCommit,
        sourceSha256,
        evidenceClass:
          "isolated pinned Gnosis fork; public synthetic credential; callback fault injection is local only",
        pin: f.pin,
        dependencies: f.dependencies,
        rows,
        migrationReady: false,
      },
      (_, x) => (typeof x === "bigint" ? x.toString() : x),
      2
    ) + "\n"
  );
} finally {
  await f.stop();
}
