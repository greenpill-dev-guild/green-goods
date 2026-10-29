/**
 * Whether a take-up can go before its claimant agrees to the request's voucher reward
 *
 * A request whose reward is bound accepts a claimant only after that claimant agreed to the
 * exact reward revision (the core's `VoucherAcceptanceLib`), so the claim would only revert. The
 * promise's page asks for the agreement first (PRD-1322). Admission reads are best effort so an
 * offline claim can queue; broadcast requires a fresh, successful read before anything is sent.
 *
 * @module modules/commitment-pooling/earned-agreement
 */

import AcceptanceABI from "@green-goods/contracts/abis/ICommitmentVoucherAcceptance.json";
import EntitlementABI from "@green-goods/contracts/abis/VoucherEntitlementModule.json";
import type { Abi } from "viem";
import type { Address } from "../../types/domain";
import { logger } from "../app/logger";
import { readSettlementFunction } from "./data-settlement-chain";
import type { ServiceChainRead } from "./service-access-chain";
import {
  SERVICE_ZERO_ADDRESS,
  serviceAddress,
  serviceFlag,
  serviceTuple,
  serviceUint,
} from "./service-access-chain-values";
import { TakeUpAgreementRequired } from "./take-up";

export async function assertEarnedRewardAgreed(
  input: { chainId: number; core: Address; commitmentId: bigint; claimant: Address },
  read: ServiceChainRead = readSettlementFunction as ServiceChainRead,
  phase: "admission" | "broadcast" = "admission"
): Promise<void> {
  const { chainId, core, commitmentId, claimant } = input;
  if (phase === "admission" && typeof navigator !== "undefined" && navigator.onLine === false)
    return;
  let module: Address;
  let revision: bigint;
  let agreed: bigint;
  let paused: boolean;
  try {
    const binding = serviceTuple(
      await read({
        chainId,
        address: core,
        abi: AcceptanceABI as Abi,
        functionName: "getEarnedVoucherBinding",
        args: [commitmentId],
      }),
      [
        "module",
        "revision",
        "termsHash",
        "acceptedRevision",
        "acceptedTermsHash",
        "acceptedCounterparty",
      ]
    );
    module = serviceAddress(binding.module);
    if (module === SERVICE_ZERO_ADDRESS) return;
    revision = serviceUint(binding.revision, 64);
    const [consent, pause] = await Promise.all([
      read({
        chainId,
        address: module,
        abi: EntitlementABI as Abi,
        functionName: "consentRevision",
        args: [commitmentId, claimant],
      }),
      read({ chainId, address: module, abi: EntitlementABI as Abi, functionName: "paused" }),
    ]);
    agreed = serviceUint(consent, 64);
    paused = serviceFlag(pause);
  } catch (error) {
    logger.warn("Earned reward agreement unread before a take-up", {
      error,
      commitmentId: commitmentId.toString(),
    });
    if (phase === "broadcast") throw error;
    return;
  }
  if (paused) throw new Error("VoucherPaused");
  if (agreed !== revision) throw new TakeUpAgreementRequired();
}
