import type { Address } from "../../../types/domain";
import type { ServiceAccessKey, ServiceAccessSnapshot } from "../service-access-types";
import { DEMO_GARDEN } from "./demo-builders";
import { rehearsalHash, serviceAccessIdentity } from "./demo-service-identities";
import { PILOT_ASSETS, PILOT_ISSUERS } from "./demo-service-pilot";
import { createActiveRehearsalSetup } from "./demo-voucher-setup";

/** Fictional identifiers only. None of these addresses assert a reviewed deployment. */
export const SERVICE_REHEARSAL_IDS = [1022n, 1023n, 1024n, 1025n, 1026n] as const;
const REHEARSAL_SAFE = "0x000000000000000000000000000000000000f001" as Address;
export const REHEARSAL_ISSUER = "0x000000000000000000000000000000000000f003" as Address;
const REHEARSAL_TOKEN = "0x000000000000000000000000000000000000f004" as Address;
export function createServiceRehearsalSnapshot(key: ServiceAccessKey): ServiceAccessSnapshot {
  const personal = key.commitmentId === 1022n;
  const presented = key.commitmentId === 1024n;
  const identity = serviceAccessIdentity(key);
  const termsHash = rehearsalHash(`${identity}:terms:1`);
  const claimHash = rehearsalHash(`${identity}:claim:1`);
  const gdPrice = personal ? 100n * 10n ** 18n : 0n;
  const voucherAsset = {
    chainId: 100,
    token: REHEARSAL_TOKEN,
    symbol: "TEST-VOUCHER",
    decimals: 0,
  };
  const snapshot: ServiceAccessSnapshot = {
    key,
    mode: personal ? "personal-gd" : "voucher",
    knownService: true,
    evidence: "local-rehearsal",
    complete: true,
    offer: {
      route: personal ? "personal-gd" : "voucher",
      revision: 1n,
      termsHash,
      serviceTermsRef: rehearsalHash(`${identity}:fictional-service`),
      remedyTermsRef: rehearsalHash(`${identity}:fictional-mutual-remedy`),
      serviceUnits: 10n,
      unitLabel: "lessons",
      providerGarden: DEMO_GARDEN,
      gdPrice,
      voucher: personal ? null : { asset: voucherAsset, issuer: REHEARSAL_ISSUER, units: 100n },
    },
    consent: presented
      ? {
          revision: 1n,
          requestNonce: 1n,
          termsHash,
          claimHash,
          buyerGarden: DEMO_GARDEN,
          voucherHolder: key.buyer,
          state: "accepted",
        }
      : null,
    coreState: presented ? "ACCEPTED" : "OFFERED",
    pause: { core: false, sourceVoucher: false, destinationVoucher: false },
    nextRequestNonce: presented ? 2n : 1n,
    eligibleBuyerGardens: [{ address: DEMO_GARDEN, name: "Local rehearsal garden" }],
    personalFeeQuote: personal
      ? {
          amount: gdPrice,
          fee: 0n,
          senderPays: true,
          totalDebit: gdPrice,
          recipientAmount: gdPrice,
        }
      : null,
    personalPaymentAccount: personal
      ? {
          asset: { chainId: 42220, token: REHEARSAL_TOKEN, symbol: "TEST-G$", decimals: 18 },
          custodySafe: REHEARSAL_SAFE,
        }
      : null,
    availableActions: [],
    personalPurchase: null,
    sourceBlock: null,
    sourceTimestamp: 1000n,
    currentVoucherSetupId: null,
    voucherSetups: [],
    acceptancePolicy: {
      kind: "service",
      knownOptIn: true,
      blockGenericMemberAcceptance: true,
      earned: {
        status: "unbound",
        module: null,
        revision: null,
        termsHash: null,
        acceptedRevision: null,
        acceptedTermsHash: null,
        acceptedCounterparty: null,
        terms: null,
        creator: null,
        creatorConsentRevision: null,
        participant: null,
        participantConsentRevision: null,
        claimType: null,
        viewerConsentRevision: null,
        modulePaused: null,
        accountRouteAvailable: false,
      },
    },
    capabilities: {
      mutation: "local-rehearsal",
      reasons: [],
      sourceBuyer: key.buyer,
      celoDepositor: personal ? key.buyer : null,
      gnosisHolder: personal ? null : key.buyer,
      canSignSource: true,
      canSendSource: true,
      canSignCelo: true,
      canSignHolder: true,
      canSendDestination: true,
    },
  };
  if (key.commitmentId === 1023n) {
    snapshot.offer!.serviceUnits = 1n;
    snapshot.offer!.unitLabel = "sessions";
    snapshot.offer!.voucher = { asset: PILOT_ASSETS.b, issuer: PILOT_ISSUERS.b, units: 1_000_000n };
  }
  if (key.commitmentId === 1025n || key.commitmentId === 1026n) {
    snapshot.offer = null;
    snapshot.mode = "legacy";
    snapshot.knownService = false;
    snapshot.coreState = "ACCEPTED";
    snapshot.acceptancePolicy.kind = "earned";
  }
  if (presented) {
    const setup = createActiveRehearsalSetup(snapshot);
    snapshot.voucherSetups = [setup];
    snapshot.currentVoucherSetupId = setup.setupId;
  }
  return snapshot;
}
