import { liveVoucherFixture } from "./fixtures/live-voucher";
import { decodeFunctionData, encodeFunctionResult, type Hex, parseAbi } from "viem";
import { describe, expect, it } from "vitest";
import { createServiceRehearsalAdapter } from "../modules/commitment-pooling/demo/demo-service-access";
import { createServiceRehearsalSnapshot } from "../modules/commitment-pooling/demo/demo-service-access-fixtures";
import {
  REHEARSAL_VOUCHER_ISSUERS,
  rehearsalIssuerApproval,
} from "../modules/commitment-pooling/demo/demo-service-wallet";
import type { ServiceChainRead } from "../modules/commitment-pooling/service-access-chain";
import type { ServiceAccessKey } from "../modules/commitment-pooling/service-access-types";
import {
  readIssuerSafeThreshold,
  readVoucherIssuerApproval,
  requestRewardDeliveries,
  readLiveVoucherWallet,
  serviceVoucherHolder,
} from "../modules/commitment-pooling/service-access-wallet";
import type { VoucherWalletScope } from "../modules/commitment-pooling/service-access-wallet-types";
import type { Address } from "../types/domain";

const buyer = "0x0000000000000000000000000000000000000200";
/** A Gnosis account the buyer names to hold the booking's vouchers. */
const holder = "0x0000000000000000000000000000000000000300";
const scope: VoucherWalletScope = {
  sourceChainId: 42161,
  coreModule: "0x0000000000000000000000000000000000000100",
  account: buyer,
};
const key = (commitmentId: bigint): ServiceAccessKey => ({
  sourceChainId: scope.sourceChainId,
  coreModule: scope.coreModule,
  commitmentId,
  buyer,
});
const request = key(1025n);
const hubDay = key(1023n);
const observe = (
  observation:
    | "work-fulfilled"
    | "voucher-budget-repaired"
    | "issuer-approved"
    | "provider-accepted"
) => ({ action: "observePilotRole" as const, observation });

describe("receipt-backed live voucher wallet", () => {
  it("reads actual token holdings and an empty booking projection without claiming completeness", async () => {
    const f = liveVoucherFixture();
    const result = await readLiveVoucherWallet(f.wallet, {
      routes: [f.route],
      chain: f.chain,
      reader: f.reader,
    });
    expect(result).toMatchObject({
      evidence: "onchain",
      complete: false,
      reason: null,
      bookings: [],
      returns: [],
    });
    expect(result.holdings.map((row) => row.available)).toEqual([17n, 3n]);
    expect(result.issuers.map((row) => row.asset.symbol)).toEqual(["GGV", "TSV"]);
  });
  it("reads paused and delisted standing without hiding vouchers already held", async () => {
    const f = liveVoucherFixture();
    const read = f.chain.read;
    f.chain.read = async (input) =>
      input.functionName === "assetAuthorizations"
        ? [f.route.core.owner, false]
        : input.functionName === "limitOf"
          ? 0n
          : read(input);
    const result = await readLiveVoucherWallet(f.wallet, {
      routes: [f.route],
      chain: f.chain,
      reader: f.reader,
    });
    expect(result.issuers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ standing: { bookings: "paused", exchange: "delisted" } }),
      ])
    );
    expect(result.holdings.map((row) => row.available)).toEqual([17n, 3n]);
  });
  it("refuses an unknown issuer standing instead of reporting it open", async () => {
    const f = liveVoucherFixture();
    const read = f.chain.read;
    f.chain.read = async (input) => {
      if (input.functionName === "assetAuthorizations") throw new Error("reserve RPC unavailable");
      return read(input);
    };
    expect(
      await readLiveVoucherWallet(f.wallet, { routes: [f.route], chain: f.chain, reader: f.reader })
    ).toMatchObject({
      evidence: "unavailable",
      reason: "canonical-read-unavailable",
      issuers: [],
      holdings: [],
      bookings: [],
      returns: [],
    });
  });
  it("keeps canonical holdings but marks bookings incomplete when the hosted table is missing", async () => {
    const f = liveVoucherFixture();
    f.reader.query = async () => ({ error: new Error("VoucherServiceSetup not found") });
    const result = await readLiveVoucherWallet(f.wallet, {
      routes: [f.route],
      chain: f.chain,
      reader: f.reader,
    });
    expect(result).toMatchObject({
      evidence: "onchain",
      complete: false,
      reason: "projection-unregistered",
    });
    expect(result.holdings[0]!.available).toBe(17n);
  });
  it("does not hydrate or invent a booking from a mismatched holder", async () => {
    const f = liveVoucherFixture([
      {
        id: "foreign",
        chainId: 42161,
        moduleAddress: "0x0000000000000000000000000000000000000999",
        setupId: `0x${"1".repeat(64)}`,
      },
    ]);
    const result = await readLiveVoucherWallet(f.wallet, {
      routes: [f.route],
      chain: f.chain,
      reader: f.reader,
    });
    expect(result).toMatchObject({ complete: false, bookings: [], returns: [] });
  });
  it("refuses changed deployed bytecode before reporting any holdings", async () => {
    const f = liveVoucherFixture();
    f.chain.code = async () => "0x00";
    expect(
      await readLiveVoucherWallet(f.wallet, { routes: [f.route], chain: f.chain, reader: f.reader })
    ).toMatchObject({
      evidence: "unavailable",
      reason: "canonical-read-unavailable",
      issuers: [],
      holdings: [],
      bookings: [],
      returns: [],
    });
  });
  it("leaves unsupported networks unavailable", async () => {
    const f = liveVoucherFixture();
    expect(
      await readLiveVoucherWallet({ ...f.wallet, sourceChainId: 11155111 }, { routes: [f.route] })
    ).toMatchObject({ evidence: "unavailable", reason: "routes-unconfigured", complete: false });
  });
  it("rejects a voucher whose issuer changed even when bytecode and balances did not", async () => {
    const f = liveVoucherFixture();
    const read = f.chain.read;
    f.chain.read = (input) =>
      input.functionName === "owner" && input.address === f.route.assets[0]!.token
        ? Promise.resolve(f.wallet.account)
        : read(input);
    expect(
      await readLiveVoucherWallet(f.wallet, { routes: [f.route], chain: f.chain, reader: f.reader })
    ).toMatchObject({
      evidence: "unavailable",
      reason: "canonical-read-unavailable",
      issuers: [],
      holdings: [],
      bookings: [],
      returns: [],
    });
  });
});

/** Earn one Tech and Sun voucher, then book the hub day and deposit it into escrow. */
async function depositedHubDay(transfer: () => boolean = () => true) {
  const adapter = createServiceRehearsalAdapter(transfer);
  await adapter.execute(request, observe("work-fulfilled"));
  await adapter.execute(request, observe("voucher-budget-repaired"));
  await adapter.execute(request, { action: "deliverPilotReward", asset: "voucher" });
  const offer = await adapter.read(hubDay);
  await adapter.execute(hubDay, {
    action: "requestClaim",
    expectedRevision: offer.offer!.revision,
    expectedTermsHash: offer.offer!.termsHash,
    requestNonce: 1n,
    buyerGarden: offer.eligibleBuyerGardens[0]!.address,
    voucherHolder: buyer,
  });
  const claim = await adapter.read(hubDay);
  const prepared = await adapter.execute(hubDay, {
    action: "prepareVoucherSetup",
    expectedRevision: claim.offer!.revision,
    expectedTermsHash: claim.offer!.termsHash,
    expectedClaimHash: claim.consent!.claimHash,
    expectedRequestNonce: 1n,
    acceptanceDeadline: 2000n,
  });
  const row = prepared.snapshot.voucherSetups[0]!;
  const bound = {
    sourceChainId: row.authorization.sourceChainId,
    sourceModule: row.authorization.sourceModule,
    setupId: row.setupId,
    expectedAuthorizationHash: row.authorizationHash,
  };
  await adapter.execute(hubDay, {
    action: "dispatchVoucherSetupCommand",
    ...bound,
    kind: "authorization",
    expectedDecisionId: null,
    reviewedNativeFee: 0n,
  });
  const beforeApproval = await adapter.wallet(scope);
  await adapter.execute(hubDay, observe("issuer-approved"));
  const beforeDeposit = await adapter.wallet(scope);
  await adapter.execute(hubDay, { action: "approveVoucherAllowance", ...bound });
  await adapter.execute(hubDay, { action: "presentVoucherSetup", ...bound });
  return { adapter, bound, beforeApproval, beforeDeposit };
}

const SAFE_ABI = parseAbi([
  "function getThreshold() view returns (uint256)",
  "function getOwners() view returns (address[])",
]);
type SafeRule = { threshold: bigint; owners: readonly string[] };
const ownerAddress = (owner: string) => owner.padEnd(42, "0") as Address;

/**
 * An issuer Safe on Gnosis whose rule moves to the next one after every call, as a threshold
 * change can land between two requests. It answers its own reads and a batch of them alike.
 */
function safeChain(safe: Address, ...rules: SafeRule[]): ServiceChainRead {
  let calls = 0;
  const answer = (rule: SafeRule, data: Hex) => {
    const { functionName } = decodeFunctionData({ abi: SAFE_ABI, data });
    return functionName === "getThreshold"
      ? encodeFunctionResult({ abi: SAFE_ABI, functionName, result: rule.threshold })
      : encodeFunctionResult({
          abi: SAFE_ABI,
          functionName,
          result: rule.owners.map(ownerAddress),
        });
  };
  return async ({ chainId, address, functionName, args }) => {
    expect(chainId).toBe(100);
    const rule = rules[Math.min(calls++, rules.length - 1)]!;
    if (functionName === "aggregate3") {
      const [batch] = (args ?? []) as readonly [readonly { target: Address; callData: Hex }[]];
      return batch.map(({ target, callData }) => {
        expect(target).toBe(safe);
        return { success: true, returnData: answer(rule, callData) };
      });
    }
    expect(address).toBe(safe);
    return functionName === "getThreshold" ? rule.threshold : rule.owners.map(ownerAddress);
  };
}

describe("voucher wallet reads", () => {
  it("follows one booking's escrow from approval to a settled split, returns pending until they arrive", async () => {
    let transfer = true;
    const { adapter, bound, beforeApproval, beforeDeposit } = await depositedHubDay(() => transfer);
    const tas = REHEARSAL_VOUCHER_ISSUERS.techAndSun;
    expect(beforeApproval.bookings).toMatchObject([{ held: 0n, stage: "awaiting-approval" }]);
    expect(beforeDeposit.bookings).toMatchObject([{ held: 0n, stage: "awaiting-deposit" }]);
    expect(beforeDeposit.holdings.find((h) => h.issuer.account === tas.account)?.available).toBe(
      1_000_000n
    );

    const held = await adapter.wallet(scope);
    expect(held.holdings.find((h) => h.issuer.account === tas.account)?.available).toBe(0n);
    expect(held.bookings).toMatchObject([
      {
        booking: { commitmentId: 1023n, setupId: bound.setupId },
        agreed: 1_000_000n,
        held: 1_000_000n,
        stage: "held",
      },
    ]);
    expect(held.returns).toEqual([]);

    await adapter.execute(hubDay, {
      action: "retryVoucherSetupAcknowledgment",
      ...bound,
      reviewedNativeFee: 0n,
    });
    await adapter.execute(hubDay, {
      action: "observePilotRole",
      observation: "deposit-acknowledged",
    });
    const accepted = await adapter.execute(hubDay, observe("provider-accepted"));
    const activated = await adapter.execute(hubDay, {
      action: "finalizeVoucherActivation",
      ...bound,
      expectedAcceptedReceiptHash: accepted.snapshot.voucherSetups[0]!.source.acceptedReceiptHash!,
    });
    const decision = activated.snapshot.voucherSetups[0]!.source.decisionId!;
    await adapter.execute(hubDay, {
      action: "dispatchVoucherSetupCommand",
      ...bound,
      kind: "decision",
      expectedDecisionId: decision,
      reviewedNativeFee: 0n,
    });
    const split = await adapter.execute(hubDay, {
      action: "finalizeVoucherAllocation",
      ...bound,
      expectedActivationDecisionId: decision,
      allocation: {
        approvedDeliveredServiceUnits: 1n,
        releaseVoucherUnits: 400_000n,
        refundVoucherUnits: 600_000n,
      },
    });
    const leg = (name: "release" | "refund") =>
      adapter.execute(hubDay, {
        action: "executeVoucherFinalLeg",
        ...bound,
        expectedDecisionId:
          split.snapshot.voucherSetups[0]!.destination!.finalAllocation!.decisionId,
        leg: name,
      });
    const settling = await adapter.wallet(scope);
    expect(settling.bookings).toMatchObject([{ held: 1_000_000n, stage: "settling" }]);
    expect(settling.returns).toMatchObject([
      { amount: 600_000n, cause: "split", state: "pending", attempts: 0n },
    ]);

    transfer = false;
    await leg("refund");
    const failed = await adapter.wallet(scope);
    expect(failed.returns).toMatchObject([{ amount: 600_000n, state: "failed", attempts: 1n }]);
    expect(failed.holdings.find((h) => h.issuer.account === tas.account)?.available).toBe(0n);

    transfer = true;
    await leg("refund");
    const back = await adapter.wallet(scope);
    expect(back.returns).toEqual([]);
    expect(back.bookings).toMatchObject([{ held: 400_000n, stage: "settling" }]);
    expect(back.holdings.find((h) => h.issuer.account === tas.account)?.available).toBe(600_000n);

    await leg("release");
    expect((await adapter.wallet(scope)).bookings).toEqual([]);
  });

  it("shows a cancellation's vouchers as coming back until the refund reaches the account", async () => {
    let transfer = true;
    const { adapter, bound } = await depositedHubDay(() => transfer);
    const aborted = await adapter.execute(hubDay, { action: "abortVoucherSetup", ...bound });
    const canceling = await adapter.wallet(scope);
    expect(canceling.bookings).toMatchObject([{ held: 1_000_000n, stage: "returning" }]);
    // The escrow counts attempts only on a split's transfers; a cancellation's refund keeps its
    // last outcome alone, so the read says it has no count rather than claiming none were made.
    expect(canceling.returns).toMatchObject([
      { amount: 1_000_000n, cause: "cancellation", state: "pending", attempts: null },
    ]);

    transfer = false;
    const dispatch = {
      action: "dispatchVoucherSetupCommand" as const,
      ...bound,
      kind: "decision" as const,
      expectedDecisionId: aborted.snapshot.voucherSetups[0]!.source.decisionId,
      reviewedNativeFee: 0n,
    };
    await adapter.execute(hubDay, dispatch);
    expect((await adapter.wallet(scope)).returns).toMatchObject([
      { amount: 1_000_000n, cause: "cancellation", state: "failed", attempts: null },
    ]);

    transfer = true;
    await adapter.execute(hubDay, { action: "retryVoucherSetupAction", ...bound });
    const refunded = await adapter.wallet(scope);
    expect(refunded.returns).toEqual([]);
    expect(refunded.bookings).toEqual([]);
    expect(
      refunded.holdings.find(
        (h) => h.issuer.account === REHEARSAL_VOUCHER_ISSUERS.techAndSun.account
      )?.available
    ).toBe(1_000_000n);
  });

  it("keeps the generic TEST-VOUCHER rehearsal's booking out of the pilot wallet", async () => {
    const adapter = createServiceRehearsalAdapter();
    // Commitment 1024 rehearses the generic voucher route with a booking already under way.
    expect((await adapter.read(key(1024n))).voucherSetups).toHaveLength(1);
    const wallet = await adapter.wallet(scope);
    expect([wallet.bookings, wallet.returns]).toEqual([[], []]);
    expect(wallet.holdings.map((holding) => holding.available)).toEqual([0n, 0n]);
  });

  it("names the issuer of every booking and return it carries, with a holding of its token", async () => {
    const { adapter, bound } = await depositedHubDay();
    await adapter.read(key(1024n));
    await adapter.execute(hubDay, { action: "abortVoucherSetup", ...bound });
    const wallet = await adapter.wallet(scope);
    const rows = [...wallet.bookings, ...wallet.returns];
    for (const row of rows) {
      const named = (token: Address) => token.toLowerCase() === row.asset.token.toLowerCase();
      expect(
        wallet.issuers.some((issuer) => issuer.account === row.issuer && named(issuer.asset.token)),
        `${row.asset.symbol} from ${row.issuer}`
      ).toBe(true);
      expect(wallet.holdings.some((holding) => named(holding.issuer.asset.token))).toBe(true);
    }
    expect(rows.map((row) => row.booking.commitmentId)).toEqual([1023n, 1023n]);
  });

  it("reads the wallet a booking's holder froze, else the reader's Gnosis holder, else the buyer", () => {
    const gnosis = "0x0000000000000000000000000000000000000400" as Address;
    const booked = createServiceRehearsalSnapshot(key(1024n));
    booked.capabilities.gnosisHolder = gnosis;
    booked.voucherSetups = booked.voucherSetups.map((setup) => ({
      ...setup,
      authorization: { ...setup.authorization, holder },
    }));
    expect(serviceVoucherHolder(booked)).toBe(holder);
    const open = createServiceRehearsalSnapshot(hubDay);
    open.capabilities.gnosisHolder = gnosis;
    expect(serviceVoucherHolder(open)).toBe(gnosis);
    open.capabilities.gnosisHolder = null;
    expect(serviceVoucherHolder(open)).toBe(buyer);
  });

  it("reads a Safe's threshold and owners at one block, so a change between reads never mixes two rules", async () => {
    // Tech and Sun's Safe moves from its one bootstrap signer to two of three (handoff task 13).
    const techAndSun = REHEARSAL_VOUCHER_ISSUERS.techAndSun.account;
    const read = safeChain(
      techAndSun,
      { threshold: 1n, owners: ["0x01"] },
      { threshold: 2n, owners: ["0x01", "0x02", "0x03"] }
    );
    expect(await readIssuerSafeThreshold(read, 100, techAndSun)).toEqual({
      safe: techAndSun,
      status: "observed",
      threshold: 1,
      owners: 1,
      signers: [ownerAddress("0x01")],
    });
  });

  const safe = REHEARSAL_VOUCHER_ISSUERS.greenGoods.account;
  const unread = { safe, status: "unavailable", threshold: null, owners: null, signers: null };
  it.each([
    [
      "a Safe's own threshold",
      2n,
      ["0x01", "0x02", "0x03", "0x04", "0x05"],
      { kind: "safe", threshold: 2, owners: 5 },
      // The console names who can sign the Safe's acts, from the same read as the count.
      {
        safe,
        status: "observed",
        threshold: 2,
        owners: 5,
        signers: ["0x01", "0x02", "0x03", "0x04", "0x05"].map(ownerAddress),
      },
    ],
    [
      "a threshold above its owners",
      3n,
      ["0x01", "0x02"],
      { kind: "unavailable", reason: "read-failed" },
      unread,
    ],
    [
      "a repeated owner",
      1n,
      ["0x01", "0x01"],
      { kind: "unavailable", reason: "read-failed" },
      unread,
    ],
    ["a zero threshold", 0n, ["0x01"], { kind: "unavailable", reason: "read-failed" }, unread],
  ] as const)("reads the signature count from the issuer: %s", async (_case, threshold, owners, expected, rule) => {
    const read = safeChain(safe, { threshold, owners });
    expect(
      await readVoucherIssuerApproval(read, REHEARSAL_VOUCHER_ISSUERS.greenGoods)
    ).toMatchObject(expected);
    // The console's contract for the same Safe: a number only when the read is observed.
    expect(await readIssuerSafeThreshold(read, 100, safe)).toEqual(rule);
  });

  it("answers without a Safe read for a member's own account, and reports a failed read", async () => {
    const reverting: ServiceChainRead = async () => {
      throw new Error("execution reverted");
    };
    const member = { ...REHEARSAL_VOUCHER_ISSUERS.techAndSun, kind: "individual" as const };
    expect(await readVoucherIssuerApproval(reverting, member)).toEqual({
      kind: "account",
      evidence: "onchain",
    });
    // The DEV rehearsal keeps the same rule: an individual approves from its own account.
    expect(rehearsalIssuerApproval(member)).toEqual({
      kind: "account",
      evidence: "local-rehearsal",
    });
    expect(
      await readVoucherIssuerApproval(reverting, REHEARSAL_VOUCHER_ISSUERS.techAndSun)
    ).toEqual({ kind: "unavailable", reason: "read-failed" });
    const techAndSun = REHEARSAL_VOUCHER_ISSUERS.techAndSun.account;
    expect(await readIssuerSafeThreshold(reverting, 100, techAndSun)).toEqual({
      safe: techAndSun,
      status: "unavailable",
      threshold: null,
      owners: null,
      signers: null,
    });
  });

  it("keeps each reward's delivery apart: waiting on a short reserve while G$ arrives", async () => {
    let transfer = true;
    const adapter = createServiceRehearsalAdapter(() => transfer);
    const both = key(1026n);
    const status = async () =>
      requestRewardDeliveries(await adapter.read(both))!.map(({ kind, status, shortOf }) => ({
        kind,
        status,
        shortOf,
      }));
    expect(await status()).toEqual([
      { kind: "voucher", status: "after-work", shortOf: null },
      { kind: "gd", status: "after-work", shortOf: null },
    ]);
    await adapter.execute(both, observe("work-fulfilled"));
    await adapter.execute(both, { action: "deliverPilotReward", asset: "voucher" });
    await adapter.execute(both, { action: "deliverPilotReward", asset: "gd" });
    expect(await status()).toEqual([
      { kind: "voucher", status: "waiting", shortOf: "reserve" },
      { kind: "gd", status: "received", shortOf: null },
    ]);
    await adapter.execute(both, observe("voucher-budget-repaired"));
    transfer = false;
    await adapter.execute(both, { action: "deliverPilotReward", asset: "voucher" });
    expect((await status())[0]).toEqual({ kind: "voucher", status: "delayed", shortOf: null });
    transfer = true;
    await adapter.execute(both, { action: "deliverPilotReward", asset: "voucher" });
    expect((await status())[0]).toEqual({ kind: "voucher", status: "received", shortOf: null });
    expect(requestRewardDeliveries(await adapter.read(hubDay))).toBeNull();
  });
});
