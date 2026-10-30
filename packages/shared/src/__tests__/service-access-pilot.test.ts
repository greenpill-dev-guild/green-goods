import { describe, expect, it } from "vitest";
import { createServiceRehearsalAdapter } from "../modules/commitment-pooling/demo/demo-service-access";
import { createServiceRehearsalSnapshot } from "../modules/commitment-pooling/demo/demo-service-access-fixtures";
import {
  applyPilotAction,
  attachPilot,
  createPilotLedger,
} from "../modules/commitment-pooling/demo/demo-service-pilot";
import type { ServiceAccessKey } from "../modules/commitment-pooling/service-access-types";

const key: ServiceAccessKey = {
  sourceChainId: 42161,
  coreModule: "0x0000000000000000000000000000000000000100",
  commitmentId: 1025n,
  buyer: "0x0000000000000000000000000000000000000200",
};
const service = { ...key, commitmentId: 1023n };
const observe = (
  observation:
    | "work-fulfilled"
    | "issuer-approved"
    | "provider-accepted"
    | "voucher-budget-repaired"
) => ({ action: "observePilotRole" as const, observation });
const reward = (asset: "voucher" | "gd") => ({ action: "deliverPilotReward" as const, asset });

describe("local individual voucher pilot", () => {
  it("does not reserve inventory on acceptance or invent holder funds at setup authorization", async () => {
    const adapter = createServiceRehearsalAdapter();
    const request = await adapter.read(key);
    expect(request.pilot?.reward?.voucher.amount).toBe(1_000_000n);
    expect(request.pilot?.reward?.voucher.state).toBe("pending");
    expect(request.pilot?.holdings.b).toBe(0n);
    expect(request.pilot?.inventory.acceptedUndelivered).toBe(1_000_000n);
    expect(request.pilot?.inventory.reserve).toBe(0n);
    const s = await adapter.read(service);
    const claim = await adapter.execute(service, {
      action: "requestClaim",
      expectedRevision: s.offer!.revision,
      expectedTermsHash: s.offer!.termsHash,
      requestNonce: 1n,
      buyerGarden: s.eligibleBuyerGardens[0]!.address,
      voucherHolder: key.buyer,
    });
    const consent = claim.snapshot.consent!;
    const prepared = await adapter.execute(service, {
      action: "prepareVoucherSetup",
      expectedRevision: s.offer!.revision,
      expectedTermsHash: s.offer!.termsHash,
      expectedClaimHash: consent.claimHash,
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
    const dispatched = await adapter.execute(service, {
      action: "dispatchVoucherSetupCommand",
      ...bound,
      kind: "authorization",
      expectedDecisionId: null,
      reviewedNativeFee: 0n,
    });
    expect(dispatched.snapshot.voucherSetups[0]!.destination!.holderBalance).toBe(0n);
    expect(dispatched.snapshot.voucherSetups[0]!.destination!.result.issuerApproved).toBe(false);
  });

  it("delivers a whole redeemable voucher once after work, repair and explicit issuer observation", async () => {
    const adapter = createServiceRehearsalAdapter();
    await expect(adapter.execute(key, reward("voucher"))).rejects.toThrow();
    await adapter.execute(key, observe("work-fulfilled"));
    const failed = await adapter.execute(key, reward("voucher"));
    expect(failed.snapshot.pilot!.reward!.voucher.state).toBe("failed");
    expect(failed.snapshot.pilot!.holdings.b).toBe(0n);
    await adapter.execute(key, observe("voucher-budget-repaired"));
    const delivered = await adapter.execute(key, reward("voucher"));
    expect(delivered.snapshot.pilot!.holdings.b).toBe(1_000_000n);
    expect(delivered.snapshot.pilot!.reward!.voucher).toMatchObject({
      state: "delivered",
      acknowledgment: "pending",
    });
    await expect(adapter.execute(key, reward("voucher"))).rejects.toThrow();
    const ack = await adapter.execute(key, { action: "acknowledgePilotReward", asset: "voucher" });
    expect(ack.snapshot.pilot!.holdings.b).toBe(1_000_000n);
    expect(ack.snapshot.pilot!.reward!.voucher.acknowledgment).toBe("observed");
    expect((await adapter.read(service)).pilot!.holdings.b).toBe(1_000_000n);
  });

  it("keeps optional G$ independent when voucher distribution fails and repairs", async () => {
    const k = { ...key, commitmentId: 1026n };
    let transfers = true;
    const adapter = createServiceRehearsalAdapter(() => transfers);
    await adapter.execute(k, observe("work-fulfilled"));
    const paid = await adapter.execute(k, reward("gd"));
    expect(paid.snapshot.pilot!.reward!.gd!.state).toBe("delivered");
    const failed = await adapter.execute(k, reward("voucher"));
    expect(failed.snapshot.pilot!.reward!.voucher.state).toBe("failed");
    await adapter.execute(k, observe("voucher-budget-repaired"));
    transfers = false;
    await adapter.execute(k, reward("voucher"));
    transfers = true;
    const repaired = await adapter.execute(k, reward("voucher"));
    expect(repaired.snapshot.pilot!.reward!.gd!.attempts).toBe(1n);
    expect(repaired.snapshot.pilot!.holdings.a).toBe(2_044_986n);
    await expect(adapter.execute(k, reward("gd"))).rejects.toThrow();
  });

  it("quotes one shared-pool A to B swap and resolves an unknown receipt before another spend", async () => {
    const k = { ...key, commitmentId: 1026n };
    const adapter = createServiceRehearsalAdapter();
    await adapter.execute(k, observe("work-fulfilled"));
    await adapter.execute(k, observe("voucher-budget-repaired"));
    await adapter.execute(k, reward("voucher"));
    const quoted = await adapter.execute(k, { action: "quotePilotExchange" });
    const quote = quoted.snapshot.pilot!.exchange.quote!;
    expect(quote).toMatchObject({
      input: 2_044_986n,
      grossOutput: 1_022_493n,
      poolFee: 20_449n,
      protocolFee: 2_044n,
      netOutput: 1_000_000n,
      minimumOutput: 1_000_000n,
    });
    await adapter.execute(k, { action: "approvePilotExchange", expectedQuoteId: quote.id });
    const swapped = await adapter.execute(k, { action: "executePilotExchange", quote });
    expect(swapped.snapshot.pilot!.exchange.status).toBe("unknown");
    expect(swapped.snapshot.pilot!.holdings.b).toBe(1_000_000n);
    await expect(adapter.execute(k, { action: "executePilotExchange", quote })).rejects.toThrow();
    await expect(adapter.execute(k, { action: "quotePilotExchange" })).rejects.toThrow();
    const resolved = await adapter.execute(k, { action: "resolvePilotExchange" });
    expect(resolved.snapshot.pilot!.exchange.status).toBe("confirmed");
    expect(resolved.snapshot.pilot!.exchange.receipt?.evidence).toBe("local-rehearsal");
    expect((await adapter.read(service)).pilot!.holdings.b).toBe(1_000_000n);
  });

  it("keeps production, stale-quote and cross-holder actions unavailable", async () => {
    const adapter = createServiceRehearsalAdapter();
    await expect(
      adapter.execute({ ...key, commitmentId: 9000n }, reward("voucher"))
    ).rejects.toThrow();
    const k = { ...key, commitmentId: 1026n };
    await adapter.execute(k, observe("work-fulfilled"));
    await adapter.execute(k, observe("voucher-budget-repaired"));
    await adapter.execute(k, reward("voucher"));
    const q = (await adapter.execute(k, { action: "quotePilotExchange" })).snapshot.pilot!.exchange
      .quote!;
    await expect(
      adapter.execute(k, { action: "executePilotExchange", quote: { ...q, minimumOutput: 0n } })
    ).rejects.toThrow();
    await expect(
      adapter.execute(
        { ...k, buyer: "0x0000000000000000000000000000000000000300" },
        { action: "executePilotExchange", quote: q }
      )
    ).rejects.toThrow();
  });
});

describe("earned holdings fund the existing service boundary", () => {
  it.each([
    [1_000_000n, 0n],
    [400_000n, 600_000n],
  ])("redeems B directly with immutable release%s/refund%s", async (release, refund) => {
    let transfer = true;
    const adapter = createServiceRehearsalAdapter(() => transfer);
    await adapter.execute(key, observe("work-fulfilled"));
    await adapter.execute(key, observe("voucher-budget-repaired"));
    await adapter.execute(key, reward("voucher"));
    const s = await adapter.read(service);
    await adapter.execute(service, {
      action: "requestClaim",
      expectedRevision: s.offer!.revision,
      expectedTermsHash: s.offer!.termsHash,
      requestNonce: 1n,
      buyerGarden: s.eligibleBuyerGardens[0]!.address,
      voucherHolder: key.buyer,
    });
    const claim = await adapter.read(service);
    const prepared = await adapter.execute(service, {
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
    await adapter.execute(service, {
      action: "dispatchVoucherSetupCommand",
      ...bound,
      kind: "authorization",
      expectedDecisionId: null,
      reviewedNativeFee: 0n,
    });
    await expect(
      adapter.execute(service, { action: "presentVoucherSetup", ...bound })
    ).rejects.toThrow();
    await adapter.execute(service, observe("issuer-approved"));
    await adapter.execute(service, { action: "approveVoucherAllowance", ...bound });
    const deposited = await adapter.execute(service, { action: "presentVoucherSetup", ...bound });
    expect(deposited.snapshot.pilot!.holdings.b).toBe(0n);
    expect(deposited.snapshot.coreState).toBe("OFFERED");
    expect(deposited.snapshot.voucherSetups[0]!.source.acceptedEver).toBeNull();
    await expect(adapter.execute(service, observe("provider-accepted"))).rejects.toThrow();
    await adapter.execute(service, {
      action: "retryVoucherSetupAcknowledgment",
      ...bound,
      reviewedNativeFee: 0n,
    });
    await expect(adapter.execute(service, observe("provider-accepted"))).rejects.toThrow();
    await adapter.execute(service, {
      action: "observePilotRole",
      observation: "deposit-acknowledged",
    });
    const accepted = await adapter.execute(service, observe("provider-accepted"));
    const receipt = accepted.snapshot.voucherSetups[0]!.source.acceptedReceiptHash!;
    const activated = await adapter.execute(service, {
      action: "finalizeVoucherActivation",
      ...bound,
      expectedAcceptedReceiptHash: receipt,
    });
    const decision = activated.snapshot.voucherSetups[0]!.source.decisionId!;
    await adapter.execute(service, {
      action: "dispatchVoucherSetupCommand",
      ...bound,
      kind: "decision",
      expectedDecisionId: decision,
      reviewedNativeFee: 0n,
    });
    const final = await adapter.execute(service, {
      action: "finalizeVoucherAllocation",
      ...bound,
      expectedActivationDecisionId: decision,
      allocation: {
        approvedDeliveredServiceUnits: 1n,
        releaseVoucherUnits: release,
        refundVoucherUnits: refund,
      },
    });
    const decisionId = final.snapshot.voucherSetups[0]!.destination!.finalAllocation!.decisionId;
    if (refund > 0n) {
      const returned = await adapter.execute(service, {
        action: "executeVoucherFinalLeg",
        ...bound,
        expectedDecisionId: decisionId,
        leg: "refund",
      });
      expect(returned.snapshot.pilot!.holdings.b).toBe(refund);
      expect(returned.snapshot.pilot!.inventory.reserve).toBe(0n);
      expect(returned.snapshot.voucherSetups[0]!.destination!.finalAllocation!.release.state).toBe(
        "pending"
      );
      await expect(
        adapter.execute(service, {
          action: "executeVoucherFinalLeg",
          ...bound,
          expectedDecisionId: decisionId,
          leg: "refund",
        })
      ).rejects.toThrow();
    }
    transfer = false;
    const failed = await adapter.execute(service, {
      action: "executeVoucherFinalLeg",
      ...bound,
      expectedDecisionId: decisionId,
      leg: "release",
    });
    expect(failed.snapshot.voucherSetups[0]!.destination!.finalAllocation!.release.state).toBe(
      "failed"
    );
    transfer = true;
    const released = await adapter.execute(service, {
      action: "executeVoucherFinalLeg",
      ...bound,
      expectedDecisionId: decisionId,
      leg: "release",
    });
    expect(released.snapshot.pilot!.inventory.reserve).toBe(release);
    expect(released.snapshot.pilot!.holdings.b).toBe(refund);
    expect((await adapter.read(key)).pilot!.holdings.b).toBe(refund);
    expect(released.snapshot.pilot!.inventory.allowance).toBe(0n);
    expect(released.snapshot.pilot!.exchange.status).toBe("none");
    expect(released.snapshot.coreState).toBe("ACCEPTED");
    await expect(
      adapter.execute(service, {
        action: "executeVoucherFinalLeg",
        ...bound,
        expectedDecisionId: decisionId,
        leg: "release",
      })
    ).rejects.toThrow();
  });
});

describe("local exchange failure conservation", () => {
  it.each([
    "inventory",
    "limit",
    "listing",
    "deadline",
    "minimum",
    "allowance",
    "transfer",
  ] as const)("keeps all economic state unchanged on %s failure", (failure) => {
    const s = createServiceRehearsalSnapshot({ ...key, commitmentId: 1026n });
    const l = createPilotLedger();
    attachPilot(s, l);
    applyPilotAction(s, l, observe("work-fulfilled"), () => true);
    applyPilotAction(s, l, observe("voucher-budget-repaired"), () => true);
    applyPilotAction(s, l, reward("voucher"), () => true);
    applyPilotAction(s, l, { action: "quotePilotExchange" }, () => true);
    const quote = l.exchange.quote!;
    applyPilotAction(
      s,
      l,
      { action: "approvePilotExchange", expectedQuoteId: quote.id },
      () => true
    );
    if (failure === "inventory") l.exchange.inventory = 0n;
    if (failure === "limit") l.exchange.inputLimit = quote.input - 1n;
    if (failure === "listing") l.exchange.listed = false;
    if (failure === "deadline") l.clock = quote.deadline + 1n;
    if (failure === "minimum") l.configuration++;
    if (failure === "allowance") l.exchange.allowance = 0n;
    const before = {
      holdings: { ...l.holdings },
      inventory: l.exchange.inventory,
      allowance: l.exchange.allowance,
      inputHolding: l.exchange.inputHolding,
    };
    applyPilotAction(s, l, { action: "executePilotExchange", quote }, () => failure !== "transfer");
    expect(l.exchange.failure).toBe(failure);
    expect({
      holdings: l.holdings,
      inventory: l.exchange.inventory,
      allowance: l.exchange.allowance,
      inputHolding: l.exchange.inputHolding,
    }).toEqual(before);
    expect(l.exchange.receipt).toBeNull();
  });

  it("quotes the smaller amount a short pool asks for, at the same rate, and nothing it can't spend", async () => {
    const k = { ...key, commitmentId: 1026n };
    const adapter = createServiceRehearsalAdapter();
    await adapter.execute(k, observe("work-fulfilled"));
    await adapter.execute(k, observe("voucher-budget-repaired"));
    await adapter.execute(k, reward("voucher"));
    const smaller = await adapter.execute(k, { action: "quotePilotExchange", input: 1_000_000n });
    const quote = smaller.snapshot.pilot!.exchange.quote!;
    expect(quote).toMatchObject({ input: 1_000_000n, grossOutput: 500_000n });
    // Its minimum scales with it, so the smaller exchange can run.
    expect(quote.minimumOutput).toBe(quote.netOutput);
    await adapter.execute(k, { action: "approvePilotExchange", expectedQuoteId: quote.id });
    const swapped = await adapter.execute(k, { action: "executePilotExchange", quote });
    expect(swapped.snapshot.pilot!.exchange).toMatchObject({ status: "unknown", failure: null });
    await expect(adapter.execute(k, { action: "quotePilotExchange", input: 0n })).rejects.toThrow();
    await expect(
      adapter.execute(k, { action: "quotePilotExchange", input: 2_044_987n })
    ).rejects.toThrow();
  });
});

describe("local pilot member and renewed-claim boundaries", () => {
  it.each([
    "holder",
    "destination",
    "account",
  ] as const)("rejects exchange with unavailable %s capability", async (capability) => {
    const adapter = createServiceRehearsalAdapter(
      () => true,
      (k) => {
        const s = createServiceRehearsalSnapshot(k);
        if (capability === "holder") s.capabilities.canSignHolder = false;
        if (capability === "destination") s.capabilities.canSendDestination = false;
        if (capability === "account")
          s.capabilities.gnosisHolder = "0x0000000000000000000000000000000000000300";
        return s;
      }
    );
    const k = { ...key, commitmentId: 1026n };
    await adapter.execute(k, observe("work-fulfilled"));
    await adapter.execute(k, observe("voucher-budget-repaired"));
    await adapter.execute(k, reward("voucher"));
    await expect(adapter.execute(k, { action: "quotePilotExchange" })).rejects.toThrow();
    expect((await adapter.read(k)).pilot!.holdings.a).toBe(2_044_986n);
  });
  it("preserves the same token/holder/escrow allowance across a renewed claim", async () => {
    const adapter = createServiceRehearsalAdapter();
    await adapter.execute(key, observe("work-fulfilled"));
    await adapter.execute(key, observe("voucher-budget-repaired"));
    await adapter.execute(key, reward("voucher"));
    const authorize = async (nonce: bigint) => {
      const s = await adapter.read(service);
      const requested = await adapter.execute(service, {
        action: "requestClaim",
        expectedRevision: s.offer!.revision,
        expectedTermsHash: s.offer!.termsHash,
        requestNonce: nonce,
        buyerGarden: s.eligibleBuyerGardens[0]!.address,
        voucherHolder: key.buyer,
      });
      const prepared = await adapter.execute(service, {
        action: "prepareVoucherSetup",
        expectedRevision: s.offer!.revision,
        expectedTermsHash: s.offer!.termsHash,
        expectedClaimHash: requested.snapshot.consent!.claimHash,
        expectedRequestNonce: nonce,
        acceptanceDeadline: 2000n,
      });
      const row = prepared.snapshot.voucherSetups.at(-1)!;
      const bound = {
        sourceChainId: row.authorization.sourceChainId,
        sourceModule: row.authorization.sourceModule,
        setupId: row.setupId,
        expectedAuthorizationHash: row.authorizationHash,
      };
      await adapter.execute(service, {
        action: "dispatchVoucherSetupCommand",
        ...bound,
        kind: "authorization",
        expectedDecisionId: null,
        reviewedNativeFee: 0n,
      });
      return bound;
    };
    const first = await authorize(1n);
    await adapter.execute(service, observe("issuer-approved"));
    await adapter.execute(service, { action: "approveVoucherAllowance", ...first });
    const old = await adapter.read(service);
    await adapter.execute(service, {
      action: "withdrawClaim",
      expectedClaimHash: old.consent!.claimHash,
    });
    await authorize(2n);
    const next = await adapter.read(service);
    expect(next.voucherSetups.at(-1)!.destination!.allowance).toBe(1_000_000n);
    expect(next.pilot!.holdings.b).toBe(1_000_000n);
  });
});
