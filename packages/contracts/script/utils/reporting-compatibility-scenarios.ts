import { concatHex, encodeFunctionData, padHex, parseAbiParameters, decodeAbiParameters, type Hex } from "viem";
import {
  reportingCompatibilityFixture,
  REPORTING_GARDEN_FIXTURE,
  OPERATION_PREFUND,
} from "./reporting-compatibility-fixture";
import { verifyPasskeyActivation } from "./reporting-compatibility-passkey";

/** Every named check reaches real EntryPoint/Kernel/policy bytecode; synthetic counters are not proof. */
export async function verifyReportingCompatibility(contracts: string, rpc: string, onCheck?: (name: string) => void) {
  const f = await reportingCompatibilityFixture(contracts, rpc);
  const checks: string[] = [];
  const check = async (name: string, action: () => Promise<void>) => {
    await action();
    checks.push(name);
    onCheck?.(name);
  };
  const assert = (truth: unknown, message: string) => {
    if (!truth) throw new Error(message);
  };
  // First, while the fork's clock is the real one: the approved module, with an account and an
  // owner as the app makes them, against the production EAS and the deployed guard.
  const passkey = await verifyPasskeyActivation(contracts, f, (name) => {
    checks.push(name);
    onCheck?.(name);
  });
  const grant = await f.createGrant();
  let firstSignature: Hex;
  await check("first_exact_report_enables_execution_selector_and_publishes", async () => {
    const op = await grant.operation(true);
    assert(op.nonce >> 248n === 1n, "First report did not use SDK ENABLE nonce mode");
    firstSignature = op.signature;
    await f.submit(op);
    assert((await f.count()) === 1n && (await grant.view()).active, "First report did not activate usable permission");
    assert(
      (await grant.remaining()) === BigInt(grant.policy.gasCostCapWei!) - OPERATION_PREFUND,
      "Guard did not count complete sponsored prefund",
    );
  });
  await check("sdk_enable_wire_matches_kernel_abi", async () => {
    const signature = firstSignature!;
    assert(
      signature.slice(0, 42) === "0x0000000000000000000000000000000000000000",
      "SDK hook prefix differs from guard fixture",
    );
    const [validation, hook, selector, enableSig, delegatedSig] = decodeAbiParameters(
      parseAbiParameters("bytes,bytes,bytes,bytes,bytes"),
      `0x${signature.slice(42)}` as Hex,
    );
    assert(
      validation !== "0x" &&
        hook === "0x" &&
        selector.slice(0, 10) === "0xe9ae5c53" &&
        enableSig.startsWith("0xff") &&
        delegatedSig.startsWith("0xff"),
      "SDK enable payload disagrees with official Kernel ABI",
    );
  });
  await check("second_report_uses_default_permission_and_separate_delegate_signature", async () => {
    const op = await grant.operation(false);
    assert(
      op.nonce >> 248n === 0n && op.signature.startsWith("0xff"),
      "Installed delegate retained a portable owner enable payload",
    );
    await f.submit(op);
    assert(
      (await f.count()) === 2n &&
        (await grant.remaining()) === BigInt(grant.policy.gasCostCapWei!) - 2n * OPERATION_PREFUND,
      "Second report did not consume the bounded grant",
    );
  });
  const rejected = async (op: Awaited<ReturnType<typeof grant.operation>>) => {
    const beforeCount = await f.count(),
      beforeBudget = await grant.remaining();
    await f.submit(op, false);
    assert(
      (await f.count()) === beforeCount && (await grant.remaining()) === beforeBudget,
      "Rejected operation changed publication/budget state",
    );
  };
  await check("wrong_garden_rejected", async () =>
    rejected(await grant.operation(false, [f.attest("0x00000000000000000000000000000000000000d2")])),
  );
  await check("review_schema_rejected_by_reporting_grant", async () =>
    rejected(await grant.operation(false, [f.attest(REPORTING_GARDEN_FIXTURE, f.deployment.review.schemaUID)])),
  );
  await check("cross_target_rejected", async () =>
    rejected(await grant.operation(false, [{ ...f.attest(), to: f.paymaster.address }])),
  );
  await check("batch_rejected_even_when_each_call_is_in_scope", async () =>
    rejected(await grant.operation(false, [f.attest(), f.attest()])),
  );
  await check("native_value_rejected", async () =>
    rejected(await grant.operation(false, [{ ...f.attest(), value: 1n }])),
  );
  await check("delegatecall_mode_rejected", async () => {
    const op = await grant.operation(false);
    const body = op.callData.slice(10);
    const mode = padHex("0xff", { size: 32, dir: "right" });
    // Re-sign the deliberately changed outer mode using the exact existing permission signer.
    await rejected(
      await grant.operation(false, [f.attest()], { callData: concatHex(["0xe9ae5c53", mode, `0x${body.slice(64)}`]) }),
    );
  });
  await check("unapproved_and_missing_paymaster_rejected", async () => {
    await rejected(await grant.operation(false, [f.attest()], { paymaster: f.eas.address }));
    await rejected(
      await grant.operation(false, [f.attest()], {
        paymaster: undefined,
        paymasterVerificationGasLimit: undefined,
        paymasterPostOpGasLimit: undefined,
      }),
    );
  });
  await check("report_count_is_five_and_sixth_is_rejected", async () => {
    for (let i = 0; i < 3; i++) await f.submit(await grant.operation(false));
    assert((await f.count()) === 5n, "Five-report grant did not publish five reports");
    await rejected(await grant.operation(false));
  });
  await check("review_grant_has_separate_one_hour_five_review_allowance", async () => {
    const now = Number((await f.client.getBlock()).timestamp);
    const reviews = await f.createGrant({
      purpose: "review",
      schemaUID: f.deployment.review.schemaUID,
      validUntil: (now + 3600) * 1000,
    });
    assert(reviews.permissionId !== grant.permissionId, "Report and review reused the same permission");
    const before = await f.count();
    await f.submit(await reviews.operation(true));
    await f.submit(await reviews.operation(false, [f.attest()]), false);
    for (let i = 0; i < 4; i++) await f.submit(await reviews.operation(false));
    await f.submit(await reviews.operation(false), false);
    assert((await f.count()) === before + 5n, "Five-review allowance or report/review separation failed");
    assert(
      (await reviews.remaining()) === BigInt(reviews.policy.gasCostCapWei!) - 5n * OPERATION_PREFUND,
      "Review grant did not count each complete sponsored prefund",
    );
  });
  await check("cumulative_full_paymaster_cost_is_enforced_on_chain", async () => {
    // 2.5 full prefunds lets the SDK GasPolicy admit three operations (it omits paymaster
    // verification/post-op), while the guard must reject the third after two real publications.
    const cap = (OPERATION_PREFUND * 5n) / 2n;
    const limited = await f.createGrant({ gasCostCapWei: cap.toString() });
    await f.submit(await limited.operation(true));
    await f.submit(await limited.operation(false));
    assert(
      (await limited.remaining()) === cap - 2n * OPERATION_PREFUND,
      "Cumulative full-cost cap differs from the packed operation",
    );
    await f.submit(await limited.operation(false), false);
    assert(
      (await limited.remaining()) === cap - 2n * OPERATION_PREFUND,
      "Rejected over-budget operation changed guard state",
    );
  });
  await check("owner_uninstall_retires_guard_and_blocks_delegate_and_enable_replay", async () => {
    const removable = await f.createGrant({
      validUntil: Number((await f.client.getBlock()).timestamp) * 1000 + 23 * 60 * 60 * 1000,
    });
    await f.submit(await removable.operation(true));
    await removable.revoke();
    assert(!(await removable.view()).active, "Owner uninstall left an active permission");
    await f.submit(await removable.revokedOperation(), false);
    await f.submit(await removable.staleEnable(), false);
    assert((await removable.status()) === 2, "Enable replay reset a retired guard");
  });
  await check("owner_nonce_invalidation_preserves_root_and_blocks_old_enable_signature", async () => {
    const revocable = await f.createGrant({ maxSubmissions: 4 });
    await f.submit(await revocable.operation(true));
    const generation = await f.reader.generations(f.account.address);
    // Uses an exact root-owner UserOp; no Agent/API is present in the fixture.
    await f.ownerCall(
      encodeFunctionData({ abi: f.kernelAbi, functionName: "invalidateNonce", args: [generation.current + 1] }),
    );
    assert(!(await revocable.view()).active, "Owner generation revoke left an active delegate");
    await f.submit(await revocable.revokedOperation(), false);
    await f.submit(await revocable.staleEnable(), false);
    const root = await f.createGrant({ maxSubmissions: 3 });
    await f.submit(await root.operation(true));
    assert((await root.view()).active, "Root account could not authorize a new bounded grant after revoke");
  });
  await check("expired_timestamp_policy_rejects_on_chain", async () => {
    const now = Number((await f.client.getBlock()).timestamp);
    const expiring = await f.createGrant({ validUntil: (now + 60) * 1000 });
    await f.submit(await expiring.operation(true));
    await f.request("evm_increaseTime", [61]);
    await f.request("evm_mine");
    await f.submit(await expiring.operation(false), false);
  });
  await check("review_permission_expires_after_one_hour", async () => {
    const now = Number((await f.client.getBlock()).timestamp);
    const expiring = await f.createGrant({
      purpose: "review",
      schemaUID: f.deployment.review.schemaUID,
      validUntil: (now + 3600) * 1000,
    });
    await f.submit(await expiring.operation(true));
    await f.request("evm_increaseTime", [3601]);
    await f.request("evm_mine");
    const before = await f.count();
    await f.submit(await expiring.operation(false), false);
    assert((await f.count()) === before, "Expired review permission published after one hour");
  });
  return {
    schemaVersion: 2,
    state: "fork_verified_with_app_passkey_account",
    // Everything a fork can prove has passed. What only the live service can show is in `pending`.
    activationReady: true,
    checks,
    sdk: f.versions,
    kernel: "0.3.1",
    entryPoint: "0.7",
    moduleHashes: f.moduleHashes,
    guardRuntimeCodeHash: f.guardRuntimeCodeHash,
    passkey,
    ownerProof:
      "Kernel 0.3.1 account on the WebAuthn validator, built as the app builds it, approving with a software passkey; the adversarial cases use an ECDSA permission root",
    publicationProof:
      "production EAS and work resolver with a Community Garden role for the approved module; fixture EAS for the adversarial cases",
    sponsorshipProof:
      "the approved paymaster's address with stand-in code and its own deposit; the adversarial cases use a deposited fixture paymaster",
    pending: ["live approved sponsorship", "a passkey on a real device"],
  };
}
