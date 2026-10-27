import { selectServiceAccessAction, serviceAccessAvailableActions } from "../service-access";
import { isPilotAction } from "../service-access-pilot";
import type {
  ServiceAccessAction,
  ServiceAccessAdapter,
  ServiceAccessKey,
  ServiceAccessSnapshot,
} from "../service-access-types";
import { voucherSetupAvailableActions } from "../service-access-voucher";
import type { VoucherWalletScope, VoucherWalletSnapshot } from "../service-access-wallet-types";
import {
  createServiceRehearsalSnapshot,
  SERVICE_REHEARSAL_IDS,
} from "./demo-service-access-fixtures";
import {
  REHEARSAL_SETTLEMENT,
  rehearsalHash,
  serviceAccessIdentity,
} from "./demo-service-identities";
import {
  applyPilotAction,
  attachPilot,
  createPilotLedger,
  isPilotCommitment,
  type PilotLedger,
  pilotLedgerIdentity,
} from "./demo-service-pilot";
import { applyRehearsalVoucherAction } from "./demo-voucher-setup";
import { rehearsalVoucherWallet } from "./demo-service-wallet";

function isServiceRehearsalKey(key: ServiceAccessKey): boolean {
  return key.sourceChainId === 42161 && SERVICE_REHEARSAL_IDS.some((id) => id === key.commitmentId);
}

export interface ServiceRehearsalAdapter extends ServiceAccessAdapter {
  /** The account's vouchers across the pilot's rehearsal bookings, from the same ledger. */
  wallet(scope: VoucherWalletScope): Promise<VoucherWalletSnapshot>;
}

/** In-memory fictional observations; reload starts a new rehearsal. No signing or RPC exists here. */
export function createServiceRehearsalAdapter(
  transferSucceeds: () => boolean = () => true,
  createSnapshot: (key: ServiceAccessKey) => ServiceAccessSnapshot = createServiceRehearsalSnapshot
): ServiceRehearsalAdapter {
  const records = new Map<string, ServiceAccessSnapshot>();
  const ledgers = new Map<string, PilotLedger>();
  const ledger = (key: ServiceAccessKey) => {
    const id = pilotLedgerIdentity(key);
    if (!ledgers.has(id)) ledgers.set(id, createPilotLedger());
    return ledgers.get(id)!;
  };
  let observation = 0;
  const current = (key: ServiceAccessKey) => {
    if (!isServiceRehearsalKey(key)) throw new Error("Not a service rehearsal fixture");
    const id = serviceAccessIdentity(key);
    const snapshot = records.get(id) ?? createSnapshot(key);
    if (isPilotCommitment(key.commitmentId)) attachPilot(snapshot, ledger(key));
    records.set(id, snapshot);
    return snapshot;
  };
  const copy = (snapshot: ServiceAccessSnapshot) => {
    const result = structuredClone(snapshot);
    if (
      result.personalPurchase &&
      (!result.capabilities.canSignCelo ||
        result.personalPurchase.authorizedDepositor.toLowerCase() !==
          result.capabilities.celoDepositor?.toLowerCase())
    ) {
      result.capabilities.reasons = [
        ...new Set([...result.capabilities.reasons, "signer-unavailable" as const]),
      ];
    }
    result.voucherSetups = result.voucherSetups.map((setup) => ({
      ...setup,
      availableActions: voucherSetupAvailableActions(result, setup),
    }));
    if (
      result.voucherSetups.some(
        (setup) =>
          setup.destination &&
          (!result.capabilities.canSignHolder ||
            setup.authorization.holder.toLowerCase() !==
              result.capabilities.gnosisHolder?.toLowerCase())
      )
    )
      result.capabilities.reasons = [
        ...new Set([...result.capabilities.reasons, "signer-unavailable" as const]),
      ];
    result.availableActions = serviceAccessAvailableActions(result);
    return result;
  };
  return {
    async read(key: ServiceAccessKey): Promise<ServiceAccessSnapshot> {
      return copy(current(key));
    },
    async wallet(scope: VoucherWalletScope): Promise<VoucherWalletSnapshot> {
      const key: ServiceAccessKey = {
        sourceChainId: scope.sourceChainId,
        coreModule: scope.coreModule,
        commitmentId: 0n,
        buyer: scope.account,
      };
      // Only the pilot's commitments: the generic TEST-VOUCHER rehearsal (1024) books with an
      // issuer outside the pilot's two, so its booking stays on its own promise page.
      const snapshots = SERVICE_REHEARSAL_IDS.filter(isPilotCommitment).map((commitmentId) =>
        copy(current({ ...key, commitmentId }))
      );
      return structuredClone(rehearsalVoucherWallet(scope, ledger(key), snapshots));
    },
    async execute(key: ServiceAccessKey, action: ServiceAccessAction) {
      // No await separates the fresh observation, validation and fictional state transition.
      const snapshot = current(key);
      const eligibility = selectServiceAccessAction(snapshot, action);
      if (!eligibility.allowed) throw new Error(eligibility.reason ?? "Service action unavailable");
      const l = isPilotCommitment(key.commitmentId) ? ledger(key) : null;
      if (l && isPilotAction(action)) applyPilotAction(snapshot, l, action, transferSucceeds);
      else {
        const old = snapshot.voucherSetups.find(
          (r) => "setupId" in action && r.setupId === action.setupId
        )?.destination;
        const balance = old?.holderBalance ?? l?.holdings.b ?? 0n;
        const released = old?.finalAllocation?.release.state;
        applyAction(snapshot, action, transferSucceeds);
        if (l && "setupId" in action) {
          const d = snapshot.voucherSetups.find((r) => r.setupId === action.setupId)?.destination;
          if (d) {
            // Authorization observes the existing ledger; it never creates holder inventory.
            if (!old) {
              d.holderBalance = l.holdings.b;
              d.allowance = l.escrowAllowance;
            } else l.holdings.b += (d.holderBalance ?? balance) - balance;
            l.escrowAllowance = d.allowance ?? l.escrowAllowance;
            if (d.finalAllocation?.release.state === "succeeded" && released !== "succeeded")
              l.reserve.b += d.finalAllocation.allocation.releaseVoucherUnits;
          }
        }
      }
      if (l) attachPilot(snapshot, l);
      return {
        kind: "local-rehearsal" as const,
        observationId: `local-rehearsal:${serviceAccessIdentity(key)}:${++observation}`,
        snapshot: copy(snapshot),
      };
    },
  };
}

function applyAction(
  snapshot: ServiceAccessSnapshot,
  action: ServiceAccessAction,
  transferSucceeds: () => boolean
) {
  if ("setupId" in action || action.action === "prepareVoucherSetup") {
    applyRehearsalVoucherAction(snapshot, action, transferSucceeds);
    return;
  }
  const offer = snapshot.offer!;
  const identity = serviceAccessIdentity(snapshot.key);
  switch (action.action) {
    case "requestClaim":
      snapshot.currentVoucherSetupId = null;
      snapshot.voucherSetups = snapshot.voucherSetups.map((setup) => ({
        ...setup,
        relationship: "prior",
      }));
      snapshot.consent = {
        revision: offer.revision,
        termsHash: offer.termsHash,
        requestNonce: action.requestNonce,
        buyerGarden: action.buyerGarden,
        voucherHolder: action.voucherHolder,
        state: "pending",
        claimHash: rehearsalHash(
          `${identity}:claim:${action.requestNonce}:${offer.termsHash}:${action.buyerGarden}:${action.voucherHolder}`
        ),
      };
      snapshot.nextRequestNonce = action.requestNonce + 1n;
      return;
    case "withdrawClaim":
      snapshot.consent!.state = "withdrawn";
      snapshot.currentVoucherSetupId = null;
      snapshot.voucherSetups = snapshot.voucherSetups.map((setup) => ({
        ...setup,
        relationship: "prior",
      }));
      return;
    case "pledgePersonal": {
      const consent = snapshot.consent!;
      const payment = snapshot.personalPaymentAccount!;
      snapshot.personalPurchase = {
        sourceModule: REHEARSAL_SETTLEMENT,
        fundingId: consent.requestNonce,
        purchaseId: rehearsalHash(
          `${identity}:purchase:${consent.claimHash}:${action.authorizedDepositor}:${action.refundAccount}:${action.reviewedFee.totalDebit}:${action.reviewedFee.recipientAmount}`
        ),
        termsRevision: offer.revision,
        termsHash: offer.termsHash,
        claimHash: consent.claimHash,
        requestNonce: consent.requestNonce,
        buyer: snapshot.key.buyer,
        recipient: snapshot.key.buyer,
        buyerGarden: consent.buyerGarden,
        providerGarden: offer.providerGarden,
        authorizedDepositor: action.authorizedDepositor,
        refundAccount: action.refundAccount,
        asset: payment.asset,
        custodySafe: payment.custodySafe,
        price: offer.gdPrice,
        disclosedGrossAmount: action.reviewedFee.totalDebit,
        disclosedNetAmount: action.reviewedFee.recipientAmount,
        deposit: null,
        paymentObservation: "none",
        state: "pledged",
        outcome: "none",
        payoutPlanId: 0n,
        refundDisbursementId: 0n,
      };
      return;
    }
    case "payPersonal":
      // A fictional wallet observation is deliberately NOT a verified deposit or funding consumption.
      snapshot.personalPurchase!.paymentObservation = "observed-awaiting-steward";
      return;
  }
}

export const serviceRehearsalAdapter = createServiceRehearsalAdapter();
