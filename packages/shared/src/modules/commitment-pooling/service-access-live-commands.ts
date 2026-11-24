import { encodeFunctionData, erc20Abi, type Abi } from "viem";
import OffersABI from "@green-goods/contracts/abis/ICommitmentServiceOffers.json";
import SourceABI from "@green-goods/contracts/abis/VoucherRedemptionModule.json";
import EscrowABI from "@green-goods/contracts/abis/GnosisVoucherEscrow.json";
import EntitlementABI from "@green-goods/contracts/abis/VoucherEntitlementModule.json";
import type { Address } from "../../types/domain";
import type { ContractCall } from "../transactions/types";
import type { ServiceLiveRoute } from "./service-access-live-config";
import type { ServiceAccessAction, ServiceAccessSnapshot } from "./service-access-types";

/**
 * The two sends the source lets anyone make: recording an accepted booking's activation, and
 * sending a decision the source already recorded to the escrow. The steward's start uses them for
 * an activation; nothing else is ever sent for the member.
 */
function startsBooking(a: ServiceAccessAction): boolean {
  return (
    a.action === "finalizeVoucherActivation" ||
    (a.action === "dispatchVoucherSetupCommand" && a.kind === "decision")
  );
}

/**
 * One explicit approval per call. No role simulator, issuer act or automatic second spend. Every
 * call is the member's own, except a booking's start, which `sender` (the steward who accepted it,
 * DL-193) may send for them from their own account and pay for.
 */
export function serviceLiveCall(
  s: ServiceAccessSnapshot,
  a: ServiceAccessAction,
  route: ServiceLiveRoute,
  sender: Address = s.key.buyer
): ContractCall {
  if (sender.toLowerCase() !== s.key.buyer.toLowerCase() && !startsBooking(a))
    throw new Error("Only a booking's start can be sent for its member");
  const source = (functionName: string, args: readonly unknown[], value = 0n): ContractCall => ({
    account: sender,
    chainId: s.key.sourceChainId,
    address: route.source.address,
    abi: SourceABI as Abi,
    functionName,
    args,
    value,
  });
  const destination = (
    functionName: string,
    args: readonly unknown[],
    value = 0n
  ): ContractCall => ({
    account: s.key.buyer,
    chainId: 100,
    address: route.destination.address,
    abi: EscrowABI as Abi,
    functionName,
    args,
    value,
  });
  switch (a.action) {
    case "requestClaim":
      return {
        ...source("requestServiceClaim", [
          s.key.commitmentId,
          {
            buyerGarden: a.buyerGarden,
            voucherHolder: a.voucherHolder,
            expectedRevision: a.expectedRevision,
            requestNonce: a.requestNonce,
            expectedTermsHash: a.expectedTermsHash,
          },
        ]),
        address: route.core.address,
        abi: OffersABI as Abi,
      };
    case "withdrawClaim":
      return {
        ...source("withdrawServiceClaim", [s.key.commitmentId, a.expectedClaimHash]),
        address: route.core.address,
        abi: OffersABI as Abi,
      };
    case "prepareVoucherSetup":
      return source("prepareVoucherSetup", [
        s.key.commitmentId,
        a.expectedRevision,
        a.expectedTermsHash,
        a.expectedClaimHash,
        a.expectedRequestNonce,
        a.acceptanceDeadline,
      ]);
    case "consentEarnedTerms": {
      // The live read admits only the reviewed reward module the core binds.
      const module = s.acceptancePolicy.earned.module;
      if (!module) throw new Error("Earned reward module unavailable");
      return {
        account: s.key.buyer,
        chainId: s.key.sourceChainId,
        address: module,
        abi: EntitlementABI as Abi,
        functionName: "consentTerms",
        args: [s.key.commitmentId, a.expectedRevision],
        value: 0n,
      };
    }
  }
  if (!("setupId" in a)) throw new Error("This action has no reviewed live service implementation");
  const bound = [a.setupId, a.expectedAuthorizationHash];
  switch (a.action) {
    case "abortVoucherSetup":
      return source("abortSetup", bound);
    case "finalizeVoucherActivation":
      return source("finalizeActivation", bound);
    case "dispatchVoucherSetupCommand":
      return source(
        "dispatchSetupCommand",
        [a.setupId, a.kind === "authorization" ? 0 : 1],
        a.reviewedNativeFee
      );
    case "approveVoucherAllowance":
    case "revokeVoucherAllowance": {
      const row = s.voucherSetups.find((v) => v.setupId === a.setupId)!;
      return {
        ...destination("approve", [
          route.destination.address,
          a.action === "revokeVoucherAllowance" ? 0n : row.authorization.voucherUnits,
        ]),
        address: row.authorization.token,
        abi: erc20Abi,
      };
    }
    case "presentVoucherSetup":
      return destination("presentSetup", bound);
    case "retryVoucherSetupAction":
      return destination("retrySetupAction", [a.setupId]);
    case "requestVoucherSetupAbort":
      return destination("requestSetupAbort", bound, a.reviewedNativeFee);
    case "retryVoucherSetupAcknowledgment":
      return destination("retrySetupAcknowledgment", [a.setupId], a.reviewedNativeFee);
    case "retryVoucherFinalAcknowledgment":
      return destination("retryFinalAcknowledgment", [a.setupId], a.reviewedNativeFee);
    case "finalizeVoucherAllocation":
      return destination("finalizeAllocation", [...bound, a.allocation]);
    case "executeVoucherFinalLeg":
      return destination("executeFinalLeg", [
        a.setupId,
        a.expectedDecisionId,
        a.leg === "release" ? 0 : 1,
      ]);
  }
}

export function serviceCallIdentity(call: ContractCall): string {
  return `${call.chainId}:${call.account?.toLowerCase()}:${call.address.toLowerCase()}:${call.value ?? 0n}:${encodeFunctionData({ abi: call.abi, functionName: call.functionName, args: call.args })}`;
}
