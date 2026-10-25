import type { Abi } from "viem";
import AcceptanceABI from "@green-goods/contracts/abis/ICommitmentVoucherAcceptance.json";
import EntitlementABI from "@green-goods/contracts/abis/VoucherEntitlementModule.json";
import type { ServiceAccessSnapshot } from "./service-access-types";
import type { ServiceChainRead } from "./service-access-chain";
import {
  serviceAddress,
  serviceChainId,
  serviceFlag,
  serviceHash,
  serviceTuple,
  serviceUint,
  SERVICE_ZERO_ADDRESS,
  SERVICE_ZERO_HASH,
  type ServiceTuple,
} from "./service-access-chain-values";

/** Earned rewards are independent of the core service payment route and its consent. */
export async function readEarnedAcceptance(
  snapshot: ServiceAccessSnapshot,
  core: ServiceTuple,
  read: ServiceChainRead
): Promise<void> {
  const { key } = snapshot;
  const call = (functionName: string, args: readonly unknown[] = [key.commitmentId]) =>
    read({
      chainId: key.sourceChainId,
      address: key.coreModule,
      abi: AcceptanceABI as Abi,
      functionName,
      args,
    });
  const policy = snapshot.acceptancePolicy;
  try {
    if ((await call("voucherAcceptanceProtocolVersion", [])) !== 1) return;
    const b = serviceTuple(await call("getEarnedVoucherBinding"), [
      "module",
      "revision",
      "termsHash",
      "acceptedRevision",
      "acceptedTermsHash",
      "acceptedCounterparty",
    ]);
    const module = serviceAddress(b.module);
    const revision = serviceUint(b.revision, 64);
    const termsHash = serviceHash(b.termsHash);
    if (module === SERVICE_ZERO_ADDRESS) {
      if (
        revision !== 0n ||
        termsHash !== SERVICE_ZERO_HASH ||
        serviceUint(b.acceptedRevision, 64) !== 0n ||
        serviceHash(b.acceptedTermsHash) !== SERVICE_ZERO_HASH ||
        serviceAddress(b.acceptedCounterparty) !== SERVICE_ZERO_ADDRESS
      )
        throw new Error("Malformed empty earned binding");
      policy.earned.status = "unbound";
      policy.kind = snapshot.knownService ? "service" : "ordinary";
      return;
    }
    if (revision === 0n || termsHash === SERVICE_ZERO_HASH)
      throw new Error("Invalid earned binding");
    Object.assign(policy.earned, {
      status: "bound",
      module,
      revision,
      termsHash,
      acceptedRevision: serviceUint(b.acceptedRevision, 64),
      acceptedTermsHash: serviceHash(b.acceptedTermsHash),
      acceptedCounterparty: serviceAddress(b.acceptedCounterparty),
    });
    policy.knownOptIn = true;
    policy.blockGenericMemberAcceptance = true;
    policy.kind = snapshot.knownService ? "service" : "earned";
    snapshot.capabilities.reasons = [
      ...snapshot.capabilities.reasons,
      "earned-consent-unavailable",
    ];
    const earnedRead = (functionName: string, args: readonly unknown[] = []) =>
      read({
        chainId: key.sourceChainId,
        address: module,
        abi: EntitlementABI as Abi,
        functionName,
        args,
      });
    const [boundCore, version, chain, destinationChain, raw] = await Promise.all([
      earnedRead("commitmentPooling"),
      earnedRead("voucherAcceptanceProtocolVersion"),
      earnedRead("LOCAL_CHAIN_ID"),
      earnedRead("remoteChainId"),
      earnedRead("getTerms", [key.commitmentId]),
    ]);
    if (
      serviceAddress(boundCore) !== key.coreModule.toLowerCase() ||
      version !== 1 ||
      serviceChainId(chain) !== key.sourceChainId
    )
      throw new Error("Earned peer mismatch");
    const t = serviceTuple(raw, ["revision", "agreed", "termsHash", "issuerApproved", "frozen"]);
    if (serviceUint(t.revision, 64) !== revision || serviceHash(t.termsHash) !== termsHash)
      throw new Error("Earned revision mismatch");
    const a = serviceTuple(t.agreed, [
      "issuer",
      "issuerAuthority",
      "token",
      "totalUnits",
      "allocationPolicy",
      "serviceTermsRef",
      "season",
    ]);
    const creator = serviceAddress(core.creator);
    const counterparty = serviceAddress(core.counterparty);
    const participant = counterparty === SERVICE_ZERO_ADDRESS ? null : counterparty;
    const [creatorConsent, participantConsent] = await Promise.all([
      earnedRead("consentRevision", [key.commitmentId, creator]),
      participant
        ? earnedRead("consentRevision", [key.commitmentId, participant])
        : Promise.resolve(null),
    ]);
    policy.earned.terms = {
      issuer: serviceAddress(a.issuer),
      issuerAuthority: serviceAddress(a.issuerAuthority),
      asset: {
        chainId: serviceChainId(destinationChain),
        token: serviceAddress(a.token),
        symbol: null,
        decimals: null,
      },
      totalUnits: serviceUint(a.totalUnits),
      allocationPolicy: serviceHash(a.allocationPolicy),
      serviceTermsRef: serviceHash(a.serviceTermsRef),
      season: serviceUint(a.season),
      issuerApproved: serviceFlag(t.issuerApproved),
      frozen: serviceFlag(t.frozen),
    };
    Object.assign(policy.earned, {
      creator,
      creatorConsentRevision: serviceUint(creatorConsent, 64),
      participant,
      participantConsentRevision:
        participantConsent === null ? null : serviceUint(participantConsent, 64),
    });
  } catch {
    // Positive facts survive hydration failure. Unsupported old cores stay unknown without a global legacy-flow block.
    snapshot.capabilities.reasons = [...snapshot.capabilities.reasons, "authoritative-read-failed"];
  }
}
