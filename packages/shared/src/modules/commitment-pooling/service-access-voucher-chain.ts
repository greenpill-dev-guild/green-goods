import {
  voucherAuthorizationIdentity,
  voucherDepositReceiptHash,
} from "./service-access-voucher-hashes";
import { getBlock } from "@wagmi/core";
import { encodeAbiParameters, keccak256, type Abi, type Hex } from "viem";
import SourceABI from "@green-goods/contracts/abis/VoucherRedemptionModule.json";
import AcceptanceABI from "@green-goods/contracts/abis/ICommitmentVoucherAcceptance.json";
import { getWagmiConfig } from "../../config/appkit";
import type { Address } from "../../types/domain";
import type { ServiceAccessKey, ServiceAccessSnapshot } from "./service-access-types";
import type { ServiceVoucherSetup } from "./service-access-voucher-types";
import type { ServiceChainRead } from "./service-access-chain";
import {
  serviceAddress as address,
  serviceChainId as chain,
  serviceEnum as ordinal,
  serviceFlag as flag,
  serviceHash as hash,
  serviceTuple as tuple,
  serviceUint as uint,
  SERVICE_ZERO_ADDRESS,
  SERVICE_ZERO_HASH as ZERO,
} from "./service-access-chain-values";
import {
  mapVoucherAcceptedReceipt,
  mapVoucherAuthorization,
  mapVoucherFinalResult,
  mapVoucherSetupResult,
} from "./service-access-voucher-chain-mappers";

export interface VoucherReadDependencies {
  discoverSetups?: (key: ServiceAccessKey, module: Address) => Promise<readonly Hex[]>;
  observeDestination?: (setup: ServiceVoucherSetup) => Promise<void>;
  readBlock?: (chainId: number) => Promise<{ timestamp: bigint; number: bigint; hash: Hex }>;
}
const receiptParameter = AcceptanceABI.find(
  (v) => v.type === "function" && v.name === "getVoucherServiceAcceptance"
);

/** A core pin establishes read scope, not reviewed signing configuration or deployment authority. */
export async function readVoucherServiceSetups(
  s: ServiceAccessSnapshot,
  read: ServiceChainRead,
  deps: VoucherReadDependencies
): Promise<void> {
  const { key } = s;
  const core = (functionName: string, args: readonly unknown[] = []) =>
    read({
      chainId: key.sourceChainId,
      address: key.coreModule,
      abi: AcceptanceABI as Abi,
      functionName,
      args,
    });
  try {
    if ((await core("voucherAcceptanceProtocolVersion")) !== 1) return;
    const module = address(await core("voucherServiceSetupModule"));
    if (module === SERVICE_ZERO_ADDRESS) return;
    const call = (functionName: string, args: readonly unknown[] = []) =>
      read({
        chainId: key.sourceChainId,
        address: module,
        abi: SourceABI as Abi,
        functionName,
        args,
      });
    const [version, boundCore, local, destination, escrow, paused, rawAccepted] = await Promise.all(
      [
        call("voucherAcceptanceProtocolVersion"),
        call("commitmentPooling"),
        call("LOCAL_CHAIN_ID"),
        call("remoteChainId"),
        call("remotePeer"),
        call("paused"),
        core("getVoucherServiceAcceptance", [key.commitmentId]),
      ]
    );
    if (
      version !== 1 ||
      address(boundCore) !== key.coreModule.toLowerCase() ||
      chain(local) !== key.sourceChainId ||
      chain(destination) !== 100 ||
      address(escrow) === SERVICE_ZERO_ADDRESS
    )
      throw new Error("Voucher source pin mismatch");
    s.pause.sourceVoucher = flag(paused);
    const accepted = mapVoucherAcceptedReceipt(rawAccepted);
    let ids: readonly Hex[] = [];
    if (deps.discoverSetups) {
      try {
        ids = await deps.discoverSetups(key, module);
      } catch {
        s.capabilities.reasons = [...s.capabilities.reasons, "projection-incomplete"];
      }
    }
    if (accepted) ids = [...ids, accepted.setupId];
    if (s.consent) {
      const current = hash(await call("setupOfClaim", [key.commitmentId, s.consent.claimHash]));
      if (current !== ZERO) {
        if (["pending", "accepted"].includes(s.consent.state)) s.currentVoucherSetupId = current;
        ids = [...ids, current];
      }
    }
    try {
      const block = await (
        deps.readBlock ??
        (async (chainId: number) => {
          const b = await getBlock(getWagmiConfig(), { chainId, blockTag: "latest" });
          if (b.number === null || b.hash === null)
            throw new Error("Missing source block identity");
          return { timestamp: b.timestamp, number: b.number, hash: b.hash };
        })
      )(key.sourceChainId);
      s.sourceTimestamp = uint(block.timestamp, 64);
      s.sourceBlock = { number: uint(block.number), hash: hash(block.hash), finality: "latest" };
    } catch {
      s.capabilities.reasons = [...s.capabilities.reasons, "source-clock-unavailable"];
    }
    const rows: ServiceVoucherSetup[] = [];
    s.voucherSetups = rows;
    for (const id of new Set(ids)) {
      try {
        const [rawAuth, rawSetup, rawResult, rawFinal] = await Promise.all([
          call("getSetupAuthorization", [id]),
          call("getSetup", [id]),
          call("getSetupResult", [id]),
          call("getFinalResult", [id]),
        ]);
        // A different claim's durable acceptance does not hide this buyer's old refunds.
        if (
          !Array.isArray(rawAuth) &&
          rawAuth &&
          typeof rawAuth === "object" &&
          "buyer" in rawAuth &&
          address(rawAuth.buyer) !== key.buyer.toLowerCase() &&
          accepted?.setupId === id
        )
          continue;
        const a = mapVoucherAuthorization(rawAuth, key, module);
        const identity = voucherAuthorizationIdentity(a);
        const record = tuple(rawSetup, [
          "authorizationHash",
          "depositReceiptHash",
          "decisionId",
          "lastPrepareMessageId",
          "lastDecisionMessageId",
          "latestResultHash",
          "latestResultSequence",
          "decisionAt",
          "decision",
          "latestDestinationPhase",
          "depositedUnits",
          "setupRefundedUnits",
        ]);
        if (
          identity.setupId !== id ||
          identity.authorizationHash !== hash(record.authorizationHash) ||
          a.destinationChainId !== chain(destination) ||
          a.destinationEscrow !== address(escrow)
        )
          throw new Error("Setup authorization digest mismatch");
        const exactAccepted = accepted?.setupId === id ? accepted : null;
        if (
          exactAccepted &&
          (exactAccepted.setupModule !== module ||
            exactAccepted.claimHash !== a.claimHash ||
            exactAccepted.requestNonce !== a.requestNonce ||
            exactAccepted.termsRevision !== a.termsRevision ||
            exactAccepted.authorizationHash !== identity.authorizationHash ||
            exactAccepted.depositReceiptHash !== voucherDepositReceiptHash(a))
        )
          throw new Error("Core accepted escrow mismatch");
        const setupResult = mapVoucherSetupResult(rawResult, id, identity.authorizationHash, a);
        const finalResult = mapVoucherFinalResult(rawFinal, id, identity.authorizationHash, a);
        const selected = ordinal(record.decision, [
          "none",
          "activate",
          "abort",
        ]) as ServiceVoucherSetup["source"]["decision"];
        const decisionId = hash(record.decisionId);
        if (
          (selected === "none") !== (decisionId === ZERO) ||
          (selected === "abort" && exactAccepted) ||
          (finalResult &&
            (selected !== "activate" ||
              !exactAccepted ||
              finalResult.activationDecisionId !== decisionId))
        )
          throw new Error("Source decision conflicts with permanent acceptance");
        const setupSequence = setupResult?.sequence ?? 0n;
        const finalSequence = finalResult?.sequence ?? 0n;
        const row: ServiceVoucherSetup = {
          setupId: id,
          authorizationHash: identity.authorizationHash,
          authorization: a,
          complete: true,
          relationship: s.currentVoucherSetupId === id ? "current" : "prior",
          asset: { chainId: a.destinationChainId, token: a.token, symbol: null, decimals: null },
          source: {
            timestamp: s.sourceTimestamp,
            decision: selected,
            decisionId: decisionId === ZERO ? null : decisionId,
            acceptedEver: exactAccepted,
            acceptedReceiptHash:
              exactAccepted &&
              receiptParameter &&
              "outputs" in receiptParameter &&
              receiptParameter.outputs
                ? keccak256(encodeAbiParameters(receiptParameter.outputs, [exactAccepted]))
                : null,
            authorizationDispatched: hash(record.lastPrepareMessageId) !== ZERO,
            decisionDispatched: hash(record.lastDecisionMessageId) !== ZERO,
            setupResult,
            finalResult,
          },
          destination: null,
          acknowledgments: {
            setup: {
              destinationSequence: null,
              sentSequence: null,
              sourceObservedSequence: setupSequence,
              pending: null,
              sent: false,
            },
            final: {
              destinationSequence: null,
              sentSequence: null,
              sourceObservedSequence: finalSequence,
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
        if (deps.observeDestination) {
          try {
            await deps.observeDestination(row);
          } catch {
            s.capabilities.reasons = [...s.capabilities.reasons, "projection-incomplete"];
          }
        }
        rows.push(row);
      } catch {
        s.capabilities.reasons = [...s.capabilities.reasons, "projection-incomplete"];
      }
    }
    s.voucherSetups = rows;
  } catch {
    s.capabilities.reasons = [...s.capabilities.reasons, "authoritative-read-failed"];
  }
}
