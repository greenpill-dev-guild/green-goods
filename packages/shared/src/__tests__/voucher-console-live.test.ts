import { describe, expect, it, vi } from "vitest";
import { decodeFunctionData, type Abi, type Hex } from "viem";
import EscrowABI from "@green-goods/contracts/abis/GnosisVoucherEscrow.json";
import { readLiveVoucherWallet } from "../modules/commitment-pooling/service-access-wallet";
import { liveVoucherFixture } from "./fixtures/live-voucher";
import { unavailableServiceAccess } from "../modules/commitment-pooling/data-service-access";
import {
  voucherAuthorizationIdentity,
  voucherFinalDecisionId,
  voucherDepositReceiptHash,
} from "../modules/commitment-pooling/service-access-voucher-hashes";
import type {
  ServiceVoucherAuthorization,
  ServiceVoucherSetup,
} from "../modules/commitment-pooling/service-access-voucher-types";
import {
  prepareVoucherSafeFile,
  readLiveVoucherConsole,
} from "../modules/commitment-pooling/voucher-console-live";

const hash = (digit: string) => `0x${digit.repeat(64)}` as Hex;
const zero = hash("0");
function fixture(active = false) {
  const f = liveVoucherFixture();
  const asset = f.route.assets[0]!;
  const garden = asset.garden!;
  const a: ServiceVoucherAuthorization = {
    version: 2,
    sourceChainId: 42161,
    sourceModule: f.route.source.address,
    coreModule: f.route.core.address,
    commitmentId: 7n,
    termsRevision: 1n,
    termsHash: hash("1"),
    claimHash: hash("2"),
    requestNonce: 1n,
    buyer: f.wallet.account,
    holder: f.wallet.account,
    buyerGarden: garden,
    providerGarden: garden,
    destinationChainId: 100,
    destinationEscrow: f.route.destination.address,
    issuer: asset.issuer,
    token: asset.token,
    voucherUnits: 1_000_000n,
    serviceUnits: 1n,
    unitLabelHash: hash("3"),
    serviceTermsRef: hash("4"),
    remedyTermsRef: hash("5"),
    acceptanceDeadline: 200n,
    remedyPolicy: 1,
  };
  const identity = voucherAuthorizationIdentity(a);
  const setup: ServiceVoucherSetup = {
    ...identity,
    authorization: a,
    complete: true,
    relationship: "current",
    asset: { chainId: 100, token: asset.token, symbol: asset.symbol, decimals: 6 },
    source: {
      timestamp: 100n,
      decision: active ? "activate" : "none",
      decisionId: active ? hash("6") : null,
      acceptedEver: null,
      acceptedReceiptHash: null,
      authorizationDispatched: true,
      decisionDispatched: active,
      setupResult: null,
      finalResult: null,
    },
    destination: null,
    acknowledgments: {
      setup: {
        destinationSequence: null,
        sentSequence: null,
        sourceObservedSequence: 0n,
        pending: null,
        sent: false,
      },
      final: {
        destinationSequence: null,
        sentSequence: null,
        sourceObservedSequence: 0n,
        pending: null,
        sent: false,
      },
    },
    fees: {
      authorization: null,
      decision: null,
      holderAbortRequest: null,
      setupAcknowledgment: null,
      finalAcknowledgment: null,
    },
    availableActions: [],
  };
  const key = {
    sourceChainId: 42161,
    coreModule: f.route.core.address,
    commitmentId: 7n,
    buyer: f.wallet.account,
  };
  const snapshot = unavailableServiceAccess(key);
  Object.assign(snapshot, {
    mode: "voucher",
    evidence: "onchain",
    sourceTimestamp: 100n,
    currentVoucherSetupId: identity.setupId,
    offer: {
      route: "voucher",
      revision: 1n,
      termsHash: a.termsHash,
      serviceTermsRef: a.serviceTermsRef,
      remedyTermsRef: a.remedyTermsRef,
      serviceUnits: 1n,
      unitLabel: "visits",
      providerGarden: garden,
      gdPrice: 0n,
      voucher: { asset: setup.asset, issuer: asset.issuer, units: a.voucherUnits },
    },
    consent: {
      revision: 1n,
      requestNonce: 1n,
      termsHash: a.termsHash,
      claimHash: a.claimHash,
      buyerGarden: garden,
      voucherHolder: f.wallet.account,
      state: active ? "accepted" : "pending",
    },
    voucherSetups: [setup],
    pause: { core: false, sourceVoucher: false, destinationVoucher: false },
  });
  const raw = {
    version: 2,
    setupId: identity.setupId,
    authorizationHash: identity.authorizationHash,
    resultSequence: 1n,
    phase: active ? 3 : 1,
    decision: active ? 1 : 0,
    issuerApproved: active,
    depositReceiptHash: active ? voucherDepositReceiptHash(a) : zero,
    depositedUnits: active ? a.voucherUnits : 0n,
    setupRefundedUnits: 0n,
    appliedDecisionId: active ? hash("6") : zero,
    actionSucceeded: true,
    failureHash: zero,
  };
  const read = f.chain.read;
  f.chain.read = async (input) => {
    switch (input.functionName) {
      case "paused":
        return false;
      case "quoteSetupCommand":
      case "quoteSetupAbortRequest":
      case "quoteSetupAcknowledgment":
        return 1n;
      case "allowance":
        return 0n;
      case "getSetupExecution":
        return {
          authorization: "0x",
          result: raw,
          pendingAction: 0,
          decision: 0,
          failureReason: zero,
          issuerReturnCeiling: 0n,
          holderAbortRequested: false,
          setupAcknowledgment: { sequence: 0n, messageId: zero, failureHash: zero },
          finalAcknowledgment: { sequence: 0n, messageId: zero, failureHash: zero },
          finalSequence: 0n,
          finalAllocation: {
            decisionId: zero,
            activationDecisionId: zero,
            issuerReturnApprovalAtFreeze: 0n,
            allocation: {},
            release: {},
            refund: {},
          },
        };
      default:
        return read(input);
    }
  };
  const row = {
    id: `42161-${f.route.source.address.toLowerCase()}-${identity.setupId}`,
    chainId: 42161,
    moduleAddress: f.route.source.address,
    coreModule: f.route.core.address,
    providerGarden: garden,
    setupId: identity.setupId,
    commitmentId: "7",
    buyer: f.wallet.account,
    holder: f.wallet.account,
    authorizationSeen: true,
  };
  f.reader.query = vi.fn().mockResolvedValue({ data: { VoucherServiceSetup: [row] } });
  const input = { chainId: 42161, garden };
  const deps = {
    routes: [f.route],
    chain: f.chain,
    reader: f.reader,
    readSnapshot: async () => structuredClone(snapshot),
  };
  return { ...f, a, setup, snapshot, raw, row, input, deps };
}

describe("live voucher steward integration", () => {
  it("reads pending asks and exports the exact zero-value Gnosis Safe approval without sending", async () => {
    const f = fixture();
    const view = await readLiveVoucherConsole(f.input, f.deps);
    expect(view.status).toBe("observed");
    expect(view.asks).toHaveLength(1);
    expect(view.reserve).toBeNull(); // No invented published capacity or reserve policy.
    const ask = view.asks[0]!;
    expect(ask.setup).toMatchObject({
      issuerApproved: false,
      depositedUnits: 0n,
      depositConfirmed: false,
    });
    const file = await prepareVoucherSafeFile(f.input, { kind: "approve", ask }, f.deps);
    expect(file).toMatchObject({
      version: "1.0",
      chainId: "100",
      meta: { createdFromSafeAddress: f.a.issuer },
      transactions: [{ to: f.route.destination.address, value: "0" }],
    });
    expect(
      decodeFunctionData({ abi: EscrowABI as Abi, data: file.transactions[0]!.data })
    ).toMatchObject({
      functionName: "approveSetupAuthorization",
      args: [f.setup.setupId, f.setup.authorizationHash],
    });
    expect((await readLiveVoucherConsole(f.input, f.deps)).asks[0]!.setup!.issuerApproved).toBe(
      false
    );
  });
  it("keeps a member issuer out of the collective Safe-file path", async () => {
    const f = fixture();
    const ask = (await readLiveVoucherConsole(f.input, f.deps)).asks[0]!;
    ask.issuer = {
      kind: "individual",
      account: f.wallet.account,
      name: "Member issuer",
      chainId: 100,
      decimals: 6,
    };
    await expect(prepareVoucherSafeFile(f.input, { kind: "approve", ask }, f.deps)).rejects.toThrow(
      "Member issuers do not use Safe files"
    );
  });
  it.each([
    "consent",
    "deadline",
    "issuer",
    "paused",
    "scope",
    "quantity",
  ])("rejects a changed %s before exporting", async (change) => {
    const f = fixture();
    const ask = (await readLiveVoucherConsole(f.input, f.deps)).asks[0]!;
    if (change === "consent") f.snapshot.consent!.claimHash = hash("9");
    if (change === "deadline") f.snapshot.sourceTimestamp = 201n;
    if (change === "issuer" && ask.issuer.kind === "collective") ask.issuer.safe = f.wallet.account;
    if (change === "paused") f.snapshot.pause.core = true;
    if (change === "scope") f.snapshot.key.coreModule = f.wallet.account;
    if (change === "quantity") ask.setup!.voucherUnits = 2_000_000n;
    await expect(
      prepareVoucherSafeFile(f.input, { kind: "approve", ask }, f.deps)
    ).rejects.toThrow();
  });
  it("uses canonical active service units and prepares a bounded mutual-return permission", async () => {
    const f = fixture(true);
    const view = await readLiveVoucherConsole(f.input, f.deps);
    const booking = view.bookings[0]!;
    expect(booking.service).toMatchObject({ kind: "units", units: 1n, label: "visits" });
    const file = await prepareVoucherSafeFile(
      f.input,
      { kind: "return", booking, ceiling: 500_000n },
      f.deps
    );
    expect(
      decodeFunctionData({ abi: EscrowABI as Abi, data: file.transactions[0]!.data })
    ).toMatchObject({
      functionName: "authorizeReturn",
      args: [f.setup.setupId, f.setup.authorizationHash, 500_000n],
    });
    await expect(
      prepareVoucherSafeFile(f.input, { kind: "return", booking, ceiling: 1_000_001n }, f.deps)
    ).rejects.toThrow("ceiling");
    await expect(
      prepareVoucherSafeFile(f.input, { kind: "retry", booking }, f.deps)
    ).rejects.toThrow("pending or failed frozen transfer");
  });

  it("hydrates account-wide wallet bookings from canonical custody", async () => {
    const f = fixture(true);
    const wallet = await readLiveVoucherWallet(f.wallet, f.deps);
    expect(wallet).toMatchObject({ evidence: "onchain", complete: false, reason: null });
    expect(wallet.bookings).toHaveLength(1);
    expect(wallet.bookings[0]).toMatchObject({
      held: 1_000_000n,
      stage: "held",
      booking: { setupId: f.setup.setupId },
    });
  });
  it.each([
    ["refund", "pending"],
    ["release", "pending"],
    ["both", "pending"],
    ["refund", "failed"],
    ["release", "failed"],
    ["both", "failed"],
    ["both", "mixed"],
  ] as const)("exports the required frozen %s legs in %s state and refuses delivered legs", async (failed, progress) => {
    const f = fixture(true);
    const release = failed === "refund" ? 0n : failed === "both" ? 500_000n : 1_000_000n;
    const refund = 1_000_000n - release;
    const allocation = {
      approvedDeliveredServiceUnits: release > 0n ? 1n : 0n,
      releaseVoucherUnits: release,
      refundVoucherUnits: refund,
    };
    const decisionId = voucherFinalDecisionId(f.a, hash("6"), allocation, 1_000_000n);
    const leg = (units: bigint, failed: boolean) => ({
      state: units === 0n ? 0 : failed ? 2 : 1,
      attempts: units > 0n && failed ? 1n : 0n,
      failureHash: units > 0n && failed ? hash("8") : zero,
    });
    const final = {
      protocolVersion: 2,
      setupId: f.setup.setupId,
      payloadHash: f.setup.authorizationHash,
      sequence: 1n,
      activationDecisionId: hash("6"),
      decisionId,
      issuerReturnApprovalAtFreeze: 1_000_000n,
      allocation,
      release: leg(release, progress === "failed"),
      refund: leg(refund, progress !== "pending"),
    };
    const read = f.chain.read;
    f.chain.read = async (input) => {
      if (input.functionName === "getFinalResult") return final;
      if (input.functionName === "quoteFinalAcknowledgment") return 1n;
      const value = await read(input);
      if (input.functionName === "getSetupExecution")
        return {
          ...(value as object),
          issuerReturnCeiling: 1_000_000n,
          finalSequence: 1n,
          finalAllocation: {
            decisionId,
            activationDecisionId: hash("6"),
            issuerReturnApprovalAtFreeze: 1_000_000n,
            allocation,
            release: final.release,
            refund: final.refund,
          },
        };
      return value;
    };
    const booking = (await readLiveVoucherConsole(f.input, f.deps)).bookings[0]!;
    expect(booking.stage.kind).toBe(
      progress === "pending"
        ? "transfer-pending"
        : final.release.state === 2
          ? "transfer-failed"
          : "return-failed"
    );
    expect(booking.stage).toMatchObject({ units: 1_000_000n });
    const file = await prepareVoucherSafeFile(f.input, { kind: "retry", booking }, f.deps);
    expect(
      file.transactions.map((tx) => decodeFunctionData({ abi: EscrowABI as Abi, data: tx.data }))
    ).toMatchObject(
      [
        release > 0n
          ? { functionName: "executeFinalLeg", args: [f.setup.setupId, decisionId, 0] }
          : null,
        refund > 0n
          ? { functionName: "executeFinalLeg", args: [f.setup.setupId, decisionId, 1] }
          : null,
      ].filter(Boolean)
    );
    for (const leg of [final.release, final.refund])
      if (leg.state === 1 || leg.state === 2) {
        leg.state = 3;
        leg.attempts = 1n;
        leg.failureHash = zero;
      }
    await expect(
      prepareVoucherSafeFile(f.input, { kind: "retry", booking }, f.deps)
    ).rejects.toThrow("pending or failed frozen transfer");
  });
  it.each([
    "rpc",
    "implementation",
    "owner",
  ])("replaces prior observations when route %s verification fails", async (failure) => {
    const f = fixture();
    expect((await readLiveVoucherConsole(f.input, f.deps)).asks).toHaveLength(1);
    if (failure === "rpc")
      f.chain.code = async () => {
        throw new Error("RPC unavailable");
      };
    if (failure === "implementation") f.chain.storage = async () => zero;
    if (failure === "owner") {
      const read = f.chain.read;
      f.chain.read = async (input) =>
        input.functionName === "owner" ? f.wallet.account : read(input);
    }
    expect(await readLiveVoucherConsole(f.input, f.deps)).toMatchObject({
      status: "unavailable",
      asks: [],
      bookings: [],
    });
  });
  it.each([
    "adapter",
    "registry",
    "limiter",
    "pool",
  ] as const)("rejects changed %s proxy state before returning canonical wallet data", async (name) => {
    for (const failure of ["code", "implementation", "implementation-code", "owner"] as const) {
      const f = fixture();
      const pin = f.route.walletState![name];
      const code = f.chain.code;
      const storage = f.chain.storage;
      const read = f.chain.read;
      f.chain.code = async (id, address) =>
        (failure === "code" && address.toLowerCase() === pin.address.toLowerCase()) ||
        (failure === "implementation-code" &&
          address.toLowerCase() === pin.implementation.address.toLowerCase())
          ? "0x6003"
          : code(id, address);
      f.chain.storage = async (id, address, slot) =>
        failure === "implementation" && address.toLowerCase() === pin.address.toLowerCase()
          ? zero
          : storage(id, address, slot);
      f.chain.read = async (input) =>
        failure === "owner" &&
        input.functionName === "owner" &&
        input.address.toLowerCase() === pin.address.toLowerCase()
          ? f.wallet.account
          : read(input);
      expect(await readLiveVoucherWallet(f.wallet, f.deps)).toMatchObject({
        evidence: "unavailable",
        reason: "canonical-read-unavailable",
        holdings: [],
        bookings: [],
        returns: [],
      });
    }
  });
  it.each([
    "assetAuthorizations",
    "have",
    "limitOf",
    "balanceOf",
  ])("clears prior wallet observations when %s fails", async (functionName) => {
    const f = fixture(true);
    expect((await readLiveVoucherWallet(f.wallet, f.deps)).bookings).toHaveLength(1);
    const read = f.chain.read;
    f.chain.read = async (input) => {
      if (input.functionName === functionName) throw new Error("RPC unavailable");
      return read(input);
    };
    expect(await readLiveVoucherWallet(f.wallet, f.deps)).toMatchObject({
      evidence: "unavailable",
      reason: "canonical-read-unavailable",
      holdings: [],
      bookings: [],
      returns: [],
    });
  });
  it.each([
    "core",
    "sourceVoucher",
    "destinationVoucher",
  ] as const)("marks pending approval paused when %s is paused", async (component) => {
    const f = fixture();
    if (component === "destinationVoucher") {
      const read = f.chain.read;
      f.chain.read = async (input) => (input.functionName === "paused" ? true : read(input));
    } else f.snapshot.pause[component] = true;
    expect((await readLiveVoucherConsole(f.input, f.deps)).asks[0]).toMatchObject({ paused: true });
  });
  it("preserves the live pilot's same-address buyer and holder boundary", async () => {
    const f = fixture(true);
    f.snapshot.voucherSetups[0]!.authorization.holder = f.route.core.owner;
    expect(await readLiveVoucherConsole(f.input, f.deps)).toMatchObject({
      status: "unavailable",
      bookings: [],
    });
  });
  it("does not turn missing tables into an observed empty console", async () => {
    const f = fixture();
    f.reader.query = async () => ({ error: new Error("VoucherServiceSetup missing") });
    expect(await readLiveVoucherConsole(f.input, f.deps)).toMatchObject({
      status: "unavailable",
      asks: [],
      bookings: [],
      reserve: null,
    });
  });
  it("rejects a foreign indexed scope without displaying its records", async () => {
    const f = fixture();
    f.row.providerGarden = f.wallet.account;
    expect(await readLiveVoucherConsole(f.input, f.deps)).toMatchObject({
      status: "unavailable",
      asks: [],
      bookings: [],
    });
  });
});
