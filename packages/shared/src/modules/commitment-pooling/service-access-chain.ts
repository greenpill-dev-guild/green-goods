import {
  readVoucherServiceSetups,
  type VoucherReadDependencies,
} from "./service-access-voucher-chain";
import { readEarnedAcceptance } from "./service-access-earned-chain";
import type { Abi } from "viem";
import ServiceOffersABI from "@green-goods/contracts/abis/ICommitmentServiceOffers.json";
import PersonalPurchasesABI from "@green-goods/contracts/abis/ISettlementPersonalServicePurchases.json";
import { isChainSupported } from "../../config/chains";
import { CELO_G_DOLLAR_TOKEN } from "../../config/tokens";
import type { Address } from "../../types/domain";
import { SettlementModuleABI } from "../../utils/blockchain/contract-abis/settlement-module";
import { CommitmentPoolingModuleABI, getNetworkContracts } from "../../utils/blockchain/contracts";
import { readSettlementFunction } from "./data-settlement-chain";
import { unavailableServiceAccess, type ServiceAccessProjection } from "./data-service-access";
import {
  mapAuthoritativeConsent,
  mapAuthoritativeOffer,
  SERVICE_CORE_STATES,
} from "./service-access-chain-mappers";
import {
  serviceAddress,
  serviceChainId,
  serviceEnum,
  serviceFlag,
  serviceTuple,
  serviceUint,
  SERVICE_ZERO_ADDRESS,
} from "./service-access-chain-values";
import { mapPersonalServicePurchase } from "./service-access-personal";
import type { ServiceAccessKey, ServiceAccessSnapshot } from "./service-access-types";

export type ServiceChainRead = (input: {
  chainId: number;
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
}) => Promise<unknown>;
interface ServiceReadDependencies extends VoucherReadDependencies {
  read?: ServiceChainRead;
  contracts?: typeof getNetworkContracts;
}

/** Only explicit existing deployment entries may be resolved; unknown-chain fallbacks are forbidden. */
export async function readServiceAccess(
  key: ServiceAccessKey,
  projection?: ServiceAccessProjection,
  {
    read = readSettlementFunction,
    contracts = getNetworkContracts,
    ...voucherReads
  }: ServiceReadDependencies = {}
): Promise<ServiceAccessSnapshot> {
  const snapshot = unavailableServiceAccess(key, projection);
  if (
    !isChainSupported(key.sourceChainId) ||
    ![42161, 42220, 11155111].includes(key.sourceChainId)
  ) {
    snapshot.capabilities.reasons = ["chain-unconfigured"];
    return snapshot;
  }
  const deployed = contracts(key.sourceChainId);
  if (
    deployed.commitmentPoolingModule.toLowerCase() !== key.coreModule.toLowerCase() ||
    key.coreModule.toLowerCase() === SERVICE_ZERO_ADDRESS
  ) {
    snapshot.capabilities.reasons = ["deployment-unreviewed"];
    return snapshot;
  }
  const coreRead = (functionName: string, args: readonly unknown[] = [key.commitmentId]) =>
    read({
      chainId: key.sourceChainId,
      address: key.coreModule,
      abi: [...CommitmentPoolingModuleABI, ...ServiceOffersABI] as Abi,
      functionName,
      args,
    });
  try {
    if ((await coreRead("serviceOfferProtocolVersion", [])) !== 1) {
      snapshot.capabilities.reasons = ["unsupported-protocol"];
      return snapshot;
    }
  } catch {
    snapshot.capabilities.reasons = ["authoritative-read-failed"];
    return snapshot;
  }
  try {
    const [rawOffer, rawCore, paused] = await Promise.all([
      coreRead("getServiceOfferTerms"),
      coreRead("getCommitment"),
      coreRead("paused", []),
    ]);
    const { offer, core } = mapAuthoritativeOffer(rawOffer, rawCore);
    snapshot.evidence = "onchain";
    snapshot.mode = offer.route;
    snapshot.knownService = offer.route !== "legacy";
    snapshot.offer = offer;
    snapshot.coreState = serviceEnum(core.state, SERVICE_CORE_STATES);
    snapshot.pause.core = serviceFlag(paused);
    snapshot.capabilities.reasons = ["deployment-unreviewed", "signer-unavailable"];
    snapshot.acceptancePolicy.knownOptIn = snapshot.knownService;
    snapshot.acceptancePolicy.blockGenericMemberAcceptance = snapshot.knownService;
    snapshot.acceptancePolicy.kind = snapshot.knownService ? "service" : "unknown";
    await readEarnedAcceptance(snapshot, core, read);
    if (offer.route === "legacy") {
      await readVoucherServiceSetups(snapshot, read, voucherReads);
      snapshot.complete = snapshot.acceptancePolicy.earned.status === "unbound";
      return snapshot;
    }
    const [rawConsent, rawPending, rawAccepted] = await Promise.all([
      coreRead("getServiceClaimConsent", [key.commitmentId, key.buyer]),
      coreRead("getPendingClaim", [key.commitmentId, key.buyer]),
      coreRead("getAcceptedServiceTerms"),
    ]);
    Object.assign(
      snapshot,
      mapAuthoritativeConsent(rawConsent, rawPending, rawAccepted, key, offer, core)
    );
    await readVoucherServiceSetups(snapshot, read, voucherReads);
    if (offer.route === "voucher") {
      // No reviewed VoucherRedemptionModule/Gnosis endpoint mapping exists in the application yet.
      snapshot.capabilities.reasons = [
        ...snapshot.capabilities.reasons,
        "voucher-endpoint-unconfigured",
        "chain-unconfigured",
        "asset-unconfigured",
      ];
      return snapshot;
    }
    const settlement = deployed.settlementModule;
    if (settlement.toLowerCase() === SERVICE_ZERO_ADDRESS) return snapshot;
    const settle = (functionName: string, args: readonly unknown[] = []) =>
      read({
        chainId: key.sourceChainId,
        address: settlement,
        abi: [...SettlementModuleABI, ...PersonalPurchasesABI] as Abi,
        functionName,
        args,
      });
    const [boundCore, chain, token, funding] = await Promise.all([
      settle("commitmentPoolingModule"),
      settle("DESTINATION_EVM_CHAIN_ID"),
      settle("gDollarToken"),
      settle("fundingOfCommitmentFunder", [key.commitmentId, key.buyer]),
    ]);
    if (
      serviceAddress(boundCore) !== key.coreModule.toLowerCase() ||
      serviceChainId(chain) !== 42220 ||
      serviceAddress(token) !== CELO_G_DOLLAR_TOKEN.address.toLowerCase()
    )
      throw new Error("Personal settlement configuration mismatch");
    const asset = {
      chainId: 42220,
      token: CELO_G_DOLLAR_TOKEN.address,
      symbol: CELO_G_DOLLAR_TOKEN.symbol,
      decimals: CELO_G_DOLLAR_TOKEN.decimals,
    };
    if (snapshot.consent) {
      const account = serviceTuple(
        await settle("settlementAccountOf", [snapshot.consent.buyerGarden]),
        [
          "chainId",
          "account",
          "active",
          "recoveryOwners",
          "rolesModifier",
          "roleKey",
          "allowanceKey",
          "permissionsConfigHash",
          "recoveryConfigHash",
          "recoveryThreshold",
        ]
      );
      if (
        serviceFlag(account.active) &&
        serviceChainId(account.chainId) === 42220 &&
        serviceAddress(account.account) !== SERVICE_ZERO_ADDRESS
      ) {
        snapshot.personalPaymentAccount = { asset, custodySafe: serviceAddress(account.account) };
      }
    }
    const fundingId = serviceUint(funding);
    if (fundingId > 0n) {
      const [purchase, record] = await Promise.all([
        settle("getPersonalServicePurchase", [fundingId]),
        settle("getCommitmentFunding", [fundingId]),
      ]);
      snapshot.personalPurchase = mapPersonalServicePurchase(
        key,
        settlement,
        fundingId,
        purchase,
        record,
        asset
      );
    }
    snapshot.complete = true;
    return snapshot;
  } catch {
    // Preserve already-authoritative terms and old receipts; no failed dependency creates Legacy.
    snapshot.complete = false;
    snapshot.capabilities.reasons = [...snapshot.capabilities.reasons, "authoritative-read-failed"];
    return snapshot;
  }
}
