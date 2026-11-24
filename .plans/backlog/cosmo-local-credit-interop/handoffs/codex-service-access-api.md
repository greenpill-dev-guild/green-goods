# Service-access selected API and compatibility record

The later local Indexer/Shared/member continuation is selected in the
[integration record](codex-service-access-integration.md). Its event projections remain partial
where these frozen events omit terms; supported contract views own action authorization. The
preimplementation API record below retains its original scope and timestamps.

**Selected before runtime edits:** 2026-10-21T20:26:26.018241+00:00. The user dispatched the prepared contracts slice;
this record makes its exact implementation delta reviewable without reopening accepted architecture.
The lead reviewed the three proposals below and selected their interfaces, field order, namespaces,
authority boundaries and recovery rules. Earlier proposal/approval wording below records design
provenance; implementation is now authorized within this selected scope. Owning source and tests
become authoritative for actual implementation facts; code and CI must not consume this document.

The dependency order is core consent/eligibility, then personal G$ funding and voucher escrow,
then integration proof. The three typed proposal sections are a preimplementation snapshot, not a
passing receipt. No deployment, live authority, real issuer term, tracker write or release waiver
is authorized. Existing legacy interface files/tuples, linear layouts/gaps, 13 prior voucher files,
Celo executor, G$ rail, Hats and registry remain unchanged.

Core composes internal-only service helpers through existing deployed ClaimsLib/TermsLib/ViewsLib,
whose current production sizes are 6,478/3,715/7,170 bytes. No new deployed-library inventory or
frozen release-lock rewrite is selected. Post-change sizes, ABI/event comparison and storage/namespace
proof remain required. Missing Celo Safe setup blocks financial pledge/consumption/payout; core
claim admission does not reverse the settlement -> pooling dependency. Gnosis issuer approval and
holder approval remain distinct from a source garden's authorization.

Personal deposits are privileged steward attestations of real canonical Celo receipt facts,
not cryptographic cross-chain proofs. Positive shortfall/overage receipts remain recordable for
exact refund; consumption enforces all agreed gross/net bounds. New-mode consumption may recover
delayed bookkeeping at Accepted, ReadyForConfirmation or Fulfilled, with exact accepted consent and
verified funding. Core fulfillment alone never authorizes a payout. Pending/unknown commands cannot
be replaced merely because an acknowledgment is late.

Initial read-only proposal SHA-256 identities (redemption refined below): [{"lane": "core", "sha256": "4aad7c1aaeaffcdf7280b3aa7fd1e07e5c81ca528a396e98abbab2ad91e96f77"}, {"lane": "funding", "sha256": "ef2441b01ecc3ddb528caec3b6021a4139d9f1dfaba9ceaaec409548380c63c9"}, {"lane": "redemption", "sha256": "240d1f3b7171d1f7a155ea2bdd9e54a8a611e56fc197a43f2317627f19c54443"}].

**Refinement selected before escrow code:** canonical service quantities and voucher base units
are separately recorded. Authorization binds core service total/unit label; holder approval binds
cumulative delivered service units plus the exact voucher release. Staged payments cannot count
the same service units twice. Financial return is not service nondelivery or obligation waiver.
The terminal enum is Closed (escrow allocation), never automatic core fulfillment. Initial issuer
approval/presentment requires published GiftableToken.owner()==bound reserve Safe; later ownership
changes do not block discharge/remedy for deposited units. Distinct issuer/custodian principals need
later explicit relationship evidence and are unsupported in this v1 model.

Refined redemption proposal SHA-256: `6140d780b81b0637114c7dd804fe7fa358312b6dea77fbc91d468a28cb42c60f`.

**Funding isolation refinement selected before funding runtime:** legacy opaque reference
assertions and verified chain/transaction/log facts have distinct meaning. The new namespace
adds a third mapping, fundingOfVerifiedReceipt, as the sole normalized receipt index for new
personal purchases. A garden steward cannot poison another garden's typed receipt using a legacy
free-form reference. Existing opaque history is unchanged and is not retrospectively certified.
Old pre-opt-in legacy pledges may record/refund their actual deposits but can never consume into
an opted-in service commitment. New personal records reject the old opaque deposit API.

Refined funding proposal SHA-256: `1e91aabe919681fa6879816c67ae64ef649fafe3814da6dbfd04b858ce80f4a8`.

---

# Service-offer core API proposal

Prepared 2026-10-21 for the owning service-access execution handoff. This is a proposal artifact;
no contract or test edit is authorized by writing it. Parent must record this exact delta before
dispatching implementation. Existing `ICommitmentPoolingModule.sol` remains byte-identical.

## Additive interface

New file: `packages/contracts/src/interfaces/ICommitmentServiceOffers.sol`.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface ICommitmentServiceOffers {
    enum ServicePaymentRoute {
        Legacy,
        PersonalGd,
        Voucher
    }

    struct ServiceOfferTermsInput {
        ServicePaymentRoute route;
        bytes32 serviceTermsRef;
        bytes32 remedyTermsRef;
        uint256 voucherChainId;
        address voucherIssuer;
        address voucherToken;
        uint256 voucherUnits;
    }

    struct ServiceOfferTerms {
        uint64 revision;
        bytes32 termsHash;
        ServiceOfferTermsInput terms;
    }

    struct ServiceClaimRequest {
        address buyerGarden;
        address voucherHolder;
        uint64 expectedRevision;
        uint64 requestNonce;
        bytes32 expectedTermsHash;
    }

    struct ServiceClaimConsent {
        uint64 termsRevision;
        uint64 requestNonce;
        address buyerGarden;
        address voucherHolder;
        bytes32 termsHash;
        bytes32 claimHash;
    }

    struct AcceptedServiceTerms {
        ServiceOfferTerms offer;
        ServiceClaimConsent consent;
        address buyer;
        address serviceRecipient;
        address providerGarden;
        uint256 serviceUnits;
        bytes32 unitLabelHash;
        uint256 gdPrice;
    }

    error ServiceOfferRequired(uint256 commitmentId);
    error ServiceOfferNotEligible(uint256 commitmentId);
    error ServiceOfferTermsLocked(uint256 commitmentId);
    error ServiceOfferRevisionMismatch(uint64 expected, uint64 actual);
    error ServiceOfferTermsHashMismatch(bytes32 expected, bytes32 actual);
    error InvalidServiceOfferTerms();
    error ServiceClaimPathRequired(uint256 commitmentId);
    error ServiceClaimConsentMismatch(uint256 commitmentId, address buyer);
    error ServiceClaimNonceMismatch(uint64 expected, uint64 actual);
    error ActiveServiceClaimExists(uint256 commitmentId, address buyer);
    error ServiceExchangeUnsupported(uint256 commitmentId);

    event ServiceOfferTermsSet(
        uint256 indexed commitmentId,
        uint64 indexed revision,
        bytes32 indexed termsHash,
        ServicePaymentRoute route,
        uint256 gdPrice
    );
    event ServiceClaimConsentRequested(
        uint256 indexed commitmentId,
        address indexed buyer,
        bytes32 indexed claimHash,
        uint64 revision,
        uint64 requestNonce,
        address buyerGarden,
        address voucherHolder
    );
    event ServiceClaimConsentAccepted(
        uint256 indexed commitmentId,
        address indexed buyer,
        bytes32 indexed claimHash,
        uint64 revision,
        uint64 requestNonce
    );
    event ServiceClaimConsentWithdrawn(
        uint256 indexed commitmentId,
        address indexed buyer,
        bytes32 indexed claimHash
    );

    function serviceOfferProtocolVersion() external pure returns (uint16);
    function setServiceOfferTerms(
        uint256 commitmentId,
        uint64 expectedRevision,
        ServiceOfferTermsInput calldata terms,
        uint256 gdPrice
    ) external;
    function requestServiceClaim(uint256 commitmentId, ServiceClaimRequest calldata request)
        external returns (bytes32 claimHash);
    function acceptServiceClaim(uint256 commitmentId, address buyer, bytes32 expectedClaimHash)
        external;
    function withdrawServiceClaim(uint256 commitmentId, bytes32 expectedClaimHash) external;
    function getServiceOfferTerms(uint256 commitmentId)
        external view returns (ServiceOfferTerms memory);
    function getServiceClaimConsent(uint256 commitmentId, address buyer)
        external view returns (ServiceClaimConsent memory);
    function getAcceptedServiceTerms(uint256 commitmentId)
        external view returns (AcceptedServiceTerms memory);
}
```

Existing core errors remain authoritative for unknown commitments, preacceptance state, pool
state, pool steward, membership, self-counterparty and pending-claim checks. The new errors above
cover only the new service boundary. The module does not inherit this interface merely to force
legacy core mocks to implement it; new callers use an explicit cast to the separate interface.

Version getter returns exactly 1. A compatible core returns revision zero / route Legacy for an
existing unopted commitment. Unknown commitment IDs revert using the existing core error. The
accepted view returns a zero tuple until a service consent has actually been accepted. Funding
and redemption first inspect the current opt-in view, then require the accepted tuple where
appropriate. An unsupported source core must revert explicitly: no try/catch legacy downgrade.

## Exact storage delta

New file: `packages/contracts/src/lib/CommitmentPooling/ServiceOfferStorageLib.sol`.

```solidity
library CommitmentPoolingServiceOfferStorageLib {
    /// @custom:storage-location erc7201:green.goods.commitment.service-offers.v1
    struct State {
        mapping(uint256 commitmentId => ICommitmentServiceOffers.ServiceOfferTerms terms) terms;
        mapping(uint256 commitmentId => mapping(address buyer => ICommitmentServiceOffers.ServiceClaimConsent consent))
            claimConsent;
        mapping(uint256 commitmentId => ICommitmentServiceOffers.ServiceClaimConsent consent) acceptedConsent;
    }

    // keccak256(abi.encode(uint256(keccak256("green.goods.commitment.service-offers.v1")) - 1))
    //     & ~bytes32(uint256(0xff))
    bytes32 internal constant STORAGE_SLOT =
        0x24ca80d21f1705094d1274ffc56402fbe8dcf0f5d16f72308874eba3e38f6e00;

    function state() internal pure returns (State storage result) {
        bytes32 slot = STORAGE_SLOT;
        assembly ("memory-safe") { result.slot := slot }
    }
}
```

Independently derived with the installed `viem` package, without dependencies or environment
files, using:

```javascript
import { keccak256, toHex, encodeAbiParameters } from 'viem';
const namespace = 'green.goods.commitment.service-offers.v1';
const namespaceHash = BigInt(keccak256(toHex(namespace)));
const slot = BigInt(keccak256(encodeAbiParameters(
  [{ type: 'uint256' }], [namespaceHash - 1n]
))) & ~255n;
console.log('0x' + slot.toString(16).padStart(64, '0'));
```

The frozen 38 named core entries, inherited upgradeable storage, Commitment/PendingClaim mapping
values and `__gap[12]` do not move or change. No new state is declared by a shell contract. Add
the namespace to the existing ERC-7201 manifest/checker with its exact nested struct definitions;
do not replace the old linear-layout baseline. Latest consent remains stored after withdrawal
or decline, with `PendingClaim.active` authoritative for whether it is still pending. Accepted
consent is copied once and remains durable after cancellation, fulfillment, expiry or dispute.

## Terms and hash contract

`setServiceOfferTerms` is pool-steward/owner authorized using the existing guard. It requires an
Open provider pool and an Offered, Individual, ApprovalGated commitment with no bilateral
`counterCommitmentId`. Expected revision must equal the current revision; write the next revision
and never provide a disable operation. Terms stop changing at acceptance.

- PersonalGd: positive `gdPrice`; all voucher fields zero. Existing core consideration becomes
  `(CeloSettlement, address(0), address(0), gdPrice)` atomically with the revision.
- Voucher: `gdPrice == 0`; `voucherChainId == 100`; nonzero issuer/token/units. Existing core
  consideration becomes `(None, address(0), address(0), 0)` atomically with the revision.
- Both references must be nonzero. `voucherIssuer` is the Gnosis reserve Safe, consistent with
  the earned slice. No separate inferred reserve address is introduced.
- Fixed voucher remedy code 1 means mutual consent. Include code 1 for Voucher, zero for
  PersonalGd, in the hash; do not add an unused configurable policy enum to runtime state.

G$ price remains authoritative in existing core consideration; it is not separately stored in
the namespaced terms. The new setter emits the existing `ConsiderationDeclared` event for that
mutation and the new terms event. Declared valuation/confirmer settings are configured before
opting in. Legacy consideration, valuation and confirmer-rule setters reject an opted-in ID,
so none can mutate the agreed meaning under an unchanged revision.

Exact `coreTermsHash` preimage, ABI encoding in this order:

1. `commitment.creationPayloadHash`.
2. `commitment.targetUnits` and `keccak256(bytes(commitment.unitLabel))`.
3. The existing consideration rail, source, token and amount.
4. Existing declared unit value and `keccak256(bytes(declaredValueBasis))`.
5. `keccak256(abi.encode(commitmentConfirmers[id]))`, threshold and fallback selection.

Exact terms hash preimage, ABI encoding in this order:

1. `keccak256("GREEN_GOODS_SERVICE_OFFER_TERMS_V1")`.
2. `block.chainid`, `address(this)`, commitment ID, newly assigned uint64 revision.
3. Every ServiceOfferTermsInput field in declaration order.
4. The uint8 fixed remedy code described above and `coreTermsHash`.

Creation identity already binds immutable offer direction/type, metadata and other creation
terms. The stored preacceptance terms hash is never recomputed from postacceptance confirmer
normalization or contributor mutations. Accepted consent retains that exact stored hash.

## Claims and acceptance

`requestServiceClaim` is direct buyer consent: caller is the buyer and source service recipient.
It requires the selected buyerGarden to be registered and the caller currently to be its member.
Neither Garden nor Protocol provider pools require this buyer to join the provider garden.
Provider creator/contributor membership remains unchanged. PersonalGd requires zero holder;
Voucher requires an explicit nonzero Gnosis holder account. That account can differ from the
source buyer and establishes no claim that the source buyer's passkey works on Gnosis.

Require exact current revision/hash. Claim hash ABI preimage, in this order:

`keccak256("GREEN_GOODS_SERVICE_CLAIM_V1"), block.chainid, address(this), commitmentId,
termsRevision, termsHash, buyer, buyerGarden, voucherHolder, requestNonce`.

An identical active request is an idempotent success returning its existing hash. A different
active request rejects until direct withdrawal. For an inactive request, require exactly
`lastRequestNonce + 1`; preserve the new nonce/hash when later withdrawn or declined. Thus an
old transport retry cannot recreate a withdrawn claim, while a genuinely renewed request is
distinct from a refunded purchase. Personal-purchase identity includes this canonical consent
hash/nonce alongside the specified immutable economic facts; transport retry IDs do not enter it.

Write the existing PendingClaim as Individual, claimant/requestedBy buyer, and gardenContext
buyerGarden. Emit existing ClaimRequested plus ServiceClaimConsentRequested. Idempotent retries
need not re-emit creation events.

`acceptServiceClaim` requires provider pool-steward authority, active matching PendingClaim,
exact expected claim hash/current revision, current buyer membership in the selected garden and
all existing self-counterparty checks. Copy the canonical accepted consent, clear the pending
claim, and reuse AcceptanceLib.acceptCommitment(..., enforceClaimAuthority=true). It already
rechecks provider creator membership, reserves the existing roster semantics, and sets:

- `counterparty == buyer == serviceRecipient`;
- `payerGarden == acceptedConsent.buyerGarden`;
- `providerGarden == actual offer pool garden`;
- `leadProvider == offer creator`.

Any failed existing acceptance check atomically restores consent and pending claim. The accepted
view derives buyer/recipient/providerGarden/serviceUnits/unitLabelHash/gdPrice from the canonical
core commitment and checks the copied consent against them; it does not create another promise
registry or store provider/recipient duplicates. The accepted terms stay readable after terminal
states; subsequent consumers enforce their own permitted core states.

`withdrawServiceClaim` requires caller buyer, the exact pending hash and preacceptance state;
clear PendingClaim only, preserving nonce/hash. It remains available while module/pool execution
is paused for wind-down. Provider `declineClaim` retains its existing authority and event; its
normal PendingClaim deletion likewise makes the consent inactive without deleting history.

Core cannot read a buyer Celo Safe without reversing the approved dependency. Settlement owns
missing/wrong setup checks at pledge/deposit/consume and every payout. Request/acceptance may
exist before setup, but cannot authorize an unfunded personal G$ payout.

## Required bypass guards and legacy behavior

1. Legacy claimCommitment and acceptClaim reject every opted-in ID; dedicated service selectors
   own explicit revision/claim consent.
2. Legacy setDeclaredConsideration, setDeclaredValue and setConfirmerRule reject opted-in IDs.
3. acceptExchange rejects either opted-in side, including zero-G$ Voucher terms. Offer creation
   referring to an already opted-in bilateral counterpart rejects early; acceptance also rejects
   a pair created before opt-in. Non-bilateral Request references keep existing semantics.
4. All Request/Garden claims, unopted Individual Offers, legacy protocol eligibility, existing
   provider/contributor membership, registry/Hats, recognition and terminal lifecycle stay unchanged.
5. Generic Fulfilled/fallback/dispute transitions remain unchanged and confer no holder-approved
   voucher discharge. Core has no Settlement callback and no new payout authority.

## Concrete file map

Runtime source additions:

- `packages/contracts/src/interfaces/ICommitmentServiceOffers.sol`: interface above.
- `packages/contracts/src/lib/CommitmentPooling/ServiceOfferStorageLib.sol`: namespace and small
  shared internal opt-in/legacy guards; no deployed link dependency.
- `packages/contracts/src/lib/CommitmentPooling/ServiceOffersLib.sol`: cohesive internal-only
  service rules for set/request/accept/withdraw with explicit existing storage references/env.
  TermsLib owns the public setter delegatecall, ClaimsLib owns the public request/accept/withdraw
  delegatecalls, and ViewsLib owns reads. No new deployed library or link reference is introduced.
- `packages/contracts/src/modules/CommitmentPooling/ServiceOffers.sol`: thin shell inheriting
  Operations; new selectors/version getter. Extensions re-points to this new current tail.

Focused existing runtime changes:

- `src/modules/CommitmentPooling/Extensions.sol`: inherit ServiceOffers shell; retain last-before-
  concrete-module position. Existing views/selectors unchanged.
- `src/modules/CommitmentPooling.sol`: update inheritance-chain documentation only.
- `src/lib/CommitmentPooling/ViewsLib.sol`: three new raw-forwarded view implementations; existing
  Base poolingViewDelegate remains restricted to this fixed library.
- `src/lib/CommitmentPooling/ClaimsLib.sol`: reject service IDs at both legacy request/accept;
  add public service request/accept/withdraw entries invoking the internal service capability.
- `src/lib/CommitmentPooling/TermsLib.sol`: reject service IDs at all three legacy term mutators;
  add the public service setter entry invoking the internal service capability.
- `src/lib/CommitmentPooling/ExchangeLib.sol`: reject either opted-in side before acceptance.
- `src/lib/CommitmentPooling/CreationChecksLib.sol`: reject new bilateral Offer references to an
  opted-in counterpart. No frozen creation payload/preimage edit.

Relative src paths above are under packages/contracts. Keep AcceptanceLib, Storage.sol,
ICommitmentPoolingModule.sol, registry and Hats sources unchanged.

Tests/artifacts:

- `packages/contracts/test/unit/CommitmentPoolingServiceOffers.t.sol`: eligibility, consent,
  mutation and bypass matrix; reuse CommitmentPoolingFixture.
- `packages/contracts/test/integration/ServiceAccess.t.sol`: real owning core/funding/redemption
  seams, coordinated with the other implementation lanes rather than duplicate fixtures.
- `packages/contracts/storage-layouts/ERC7201Namespaces.json`: append the exact new namespace
  and struct definitions to the existing namespace manifest.
- `packages/contracts/script/build-abis.ts`: declare separate new interface artifact export;
  no change to generated legacy interface ABI bytes. Necessary generated ABI file only.

Deployment/linker surfaces inspected; no new deployed-library inventory is planned:

- `packages/contracts/script/DeployCommitmentRelease.s.sol`: explicitly imports/deploys every
  core library in _deployPooling. Existing ClaimsLib, TermsLib and ViewsLib remain the deployed
  owners, so no new import, deployment label or library-map entry is necessary.
- `packages/contracts/script/DeployPooling.s.sol`: inherits that release script; no independent
  library list, so ordinarily no source edit beyond its inherited impact.
- `packages/contracts/script/utils/release-manifest.ts`: recursively discovers linkReferences
  and topologically links libraries, and freezes 21 library / 5 implementation / 5 proxy
  identities and 31 unique addresses. Internal service composition preserves this inventory;
  do not change its frozen counts or weaken code-hash checks for this slice.
- `packages/contracts/script/deploy/release.ts`: operates on the frozen lock and reports those
  historical counts. No wrapper edits are required solely for internal composition. A future
  service upgrade still requires its own reviewed candidate identities/code hashes.
- `packages/contracts/script/utils/release-manifest.test.ts` and
  `packages/contracts/script/deploy/release.test.ts`: relevant lock/identity regression proof.
- `packages/contracts/script/upgrade.ts`: existing commitment-pooling upgrade checks frozen
  identities; any future service upgrade must carry its own explicitly reviewed linked candidate
  identities. Do not bypass this check or silently reinterpret the historical deployment.
- `packages/contracts/script/Upgrade.s.sol`: inspect/select an explicit candidate upgrade path
  only if required by the bounded implementation; no broadcast is authorized.
- `packages/contracts/config/commitment-pooling-release.lock.json`: historical live-release
  evidence; preserve byte-for-byte. No candidate addresses may be written into it.

Parent measured existing production artifact sizes before implementation: ClaimsLib 6,478 bytes,
TermsLib 3,715 bytes, ViewsLib 7,170 bytes. These support the selected internal-only composition;
they do not certify post-change sizes. Compile and measure every affected deployable. A new
deployed ServiceOffersLib is not selected and must not be added unless actual post-change size or
locality evidence requires a further explicit decision. Internal composition changes deployed
library and linked implementation bytecode hashes while preserving the link inventory. Future
candidate manifests/locks, linker flags, runtime hashes and upgrade simulation proof must identify
the new local source and keep the old live-release lock separate. Existing hash-drift rejection
is expected against historical artifacts; do not regenerate the old lock to conceal it. No new
versioned release-manifest framework is part of this bounded core implementation.

## Focused behavioral matrix

- Garden A -> Garden B and A -> protocol offers; same-garden; missing/unregistered buyer garden;
  nonmembership at request and membership lost before acceptance.
- Provider versus buyer-garden authority; direct buyer consent; unchanged provider creator and
  contributor membership; institutional Garden and Request regressions.
- Stale revision/hash; expected-revision race; changed route/price; legacy term setters rejected;
  accepted terms immutable; old creation replay remains idempotent.
- Active exact request retry; changed active fields rejected; withdraw/decline + next nonce;
  withdrawn old retry rejected; competing buyers first acceptance wins atomically.
- Explicit holder binding, wrong mixed fields, voucher-zero G$ and canonical G$ declaration.
- Legacy claim/accept bypasses, bilateral both-side guards and existing counterpart-before-opt-in.
- Paused wind-down withdrawal; canceled/expired/fulfilled accepted evidence remains durable;
  failed acceptance leaves pending state unchanged.
- Actual downstream funding requires exact consumed consent/Safe/token/price and cannot charge
  vouchers; redemption snapshots exact canonical accepted holder/issuer/token/units/terms.
- Exact legacy ABI/event bytes, frozen linear storage, registered namespace, UUPS upgrade and
  deployable-library size proofs. All commands remain Bun-wrapped; no runtime proof claimed here.


---

# Personal G$ service funding: exact additive proposal

Read-only design lane, 21 October 2026. No repository or contract edits performed.
The parent must record/approve this delta before implementation.

## Interface and field order

Add `src/interfaces/ISettlementPersonalServicePurchases.sol`. Do not edit the existing
`ISettlementModule` tuples, enum ordinals, selectors or events. The new interface is implemented
by the existing SettlementModule composition; it creates no new custody or token-transfer role.

```solidity
interface ISettlementPersonalServicePurchases {
    enum PersonalPurchaseOutcome {
        None,       // no commercial outcome selected
        Payout,     // irreversible full-settlement branch selected
        Refund,     // immutable full recorded-net refund branch selected
        Settled,    // all existing payout-plan children confirmed
        Refunded    // the one existing refund child confirmed
    }

    // Exact transaction input order. buyer and recipient are both msg.sender.
    struct PersonalPurchaseConsent {
        uint256 commitmentId;
        uint64 expectedTermsRevision;
        bytes32 expectedTermsHash;
        bytes32 expectedClaimHash;
        uint64 expectedRequestNonce;
        address buyerGarden;
        uint64 expectedDestinationChainId;
        address expectedToken;
        address expectedCustodySafe;
        address authorizedDepositor;
        address refundAccount;
        uint256 expectedPrice;
        uint256 disclosedGrossAmount;
        uint256 disclosedNetAmount;
    }

    // Exact immutable storage/view/event field order. All values derive from the supported
    // core's exact consent, immutable module configuration and the signed input above.
    struct PersonalPurchaseTerms {
        uint8 version;
        bytes32 purchaseId;
        uint256 sourceChainId;
        address sourceModule;
        uint256 commitmentId;
        uint64 termsRevision;
        bytes32 termsHash;
        bytes32 claimHash;
        uint64 requestNonce;
        address buyer;
        address recipient;
        address buyerGarden;
        address providerGarden;
        uint64 destinationChainId;
        address token;
        uint256 price;
        address custodySafe;
        address authorizedDepositor;
        address refundAccount;
        uint256 disclosedGrossAmount;
        uint256 disclosedNetAmount;
    }

    // Exact input/storage/view/event order. logIndex is the RPC receipt log.logIndex,
    // not the caller's choice of a deposit-reference hash or an array-local ordinal.
    struct VerifiedCeloDeposit {
        uint64 chainId;
        address token;
        bytes32 transactionHash;
        uint32 logIndex;
        uint64 blockNumber;
        bytes32 blockHash;
        address depositingAccount;
        address custodySafe;
        uint256 grossDebit;
        uint256 receivedAmount;
    }

    struct PersonalServicePurchase {
        PersonalPurchaseTerms terms;
        VerifiedCeloDeposit deposit;
        PersonalPurchaseOutcome outcome;
        uint256 payoutPlanId;
    }

    function pledgePersonalServicePurchase(PersonalPurchaseConsent calldata consent)
        external returns (uint256 fundingId, bytes32 purchaseId);
    function recordPersonalServiceDeposit(uint256 fundingId, VerifiedCeloDeposit calldata deposit)
        external;
    function getPersonalServicePurchase(uint256 fundingId)
        external view returns (PersonalServicePurchase memory purchase);
    function fundingOfPersonalServicePurchase(bytes32 purchaseId)
        external view returns (uint256 fundingId);
    function personalServiceDepositFunding(uint64 chainId, bytes32 transactionHash, uint32 logIndex)
        external view returns (uint256 fundingId);

    // Struct event arguments are intentional additive ABI tuples. Existing events are unchanged.
    event PersonalServicePurchasePledged(
        bytes32 indexed purchaseId,
        uint256 indexed fundingId,
        uint256 indexed commitmentId,
        PersonalPurchaseTerms terms
    );
    event PersonalServiceDepositVerified(
        bytes32 indexed receiptKey,
        uint256 indexed fundingId,
        bytes32 indexed purchaseId,
        VerifiedCeloDeposit deposit,
        address verifiedBy
    );
    event PersonalServicePurchaseOutcomeSelected(
        bytes32 indexed purchaseId,
        uint256 indexed fundingId,
        PersonalPurchaseOutcome outcome,
        uint256 payoutPlanId,
        uint256 refundDisbursementId
    );
    event PersonalServicePurchaseOutcomeCompleted(
        bytes32 indexed purchaseId,
        uint256 indexed fundingId,
        PersonalPurchaseOutcome outcome
    );

    error UnknownPersonalServicePurchase(uint256 fundingId);
    error PersonalServiceModeRequired(uint256 commitmentId);
    error PersonalServiceConsentMismatch(uint256 commitmentId);
    error PersonalServiceTermsChanged(uint256 fundingId);
    error PersonalServiceReceiptMismatch(uint256 fundingId);
    error PersonalServiceFundingRequired(uint256 commitmentId);
    error PersonalServiceOutcomeConflict(bytes32 purchaseId, PersonalPurchaseOutcome outcome);
    error PersonalServiceUnsafeRecovery(uint256 disbursementId);
    error PersonalServiceExcessNotConsented(uint256 fundingId);
    error PersonalServiceDepositProofRequired(uint256 fundingId);
}
```

Reuse existing `FundingDepositReferenceUsed`, `FundingDepositBelowPrice`, authority, unknown-account,
funding-state and zero-address errors for their existing meanings. The specific new-error names may
be consolidated only where the facts and failure meaning genuinely coincide.

`getPersonalServicePurchase` rejects absent metadata (including legacy funding records); it does
not reclassify a legacy row. `fundingOfPersonalServicePurchase` returns zero for unknown IDs.
`personalServiceDepositFunding` derives the receipt key and returns the globally reserved funding
ID from the new typed-receipt namespace, or zero. It never treats an arbitrary legacy opaque
reference as a verified Celo receipt or allows one to poison another garden's actual deposit.

## Concrete storage delta

Keep `SettlementModuleStorage`, its gap, `SettlementPlanLib.State`, the existing
`SettlementFundingLib.State`, and all existing stored structs byte-for-byte unchanged.

Within the owning `SettlementFundingLib`, add a second ERC-7201 state namespace:

```solidity
/// @custom:storage-location erc7201:green.goods.settlement.personal-service-purchases.v1
struct PersonalPurchaseState {
    mapping(uint256 fundingId =>
        ISettlementPersonalServicePurchases.PersonalServicePurchase purchase) purchases;
    mapping(bytes32 purchaseId => uint256 fundingId) fundingOfPurchase;
    mapping(bytes32 receiptKey => uint256 fundingId) fundingOfVerifiedReceipt;
}

bytes32 private constant _PERSONAL_PURCHASE_STATE_SLOT =
    0x64a93a3248f51fd3aeb9fbdc8092d4a605842f1fe011ff3dab37abb5618add00;
```

Namespace ID: `green.goods.settlement.personal-service-purchases.v1`.
Slot formula: `keccak256(abi.encode(uint256(keccak256(bytes(namespace))) - 1)) & ~bytes32(uint256(0xff))`.
Slot independently calculated using installed `viem` only; no runtime test or compiler process run.

The third mapping is the sole authoritative uniqueness boundary for normalized new-mode verified
Celo receipts. Keep the existing `fundingByDepositReference` map unchanged and legacy-only: its
opaque assertions are different domain facts, and another garden's steward must not be able to
front-run a victim's typed receipt by placing its derived key in that legacy map. Typed deposits
reserve only `fundingOfVerifiedReceipt`. The old opaque-reference API rejects every metadata1
personal purchase funding ID. Test that an unrelated garden's prior opaque assertion of an equal
hash neither blocks the legitimate typed receipt nor acquires its reserve or purchase authority.

The existing `nextFundingId`, `fundings`, refund-child relationship and
`consumedFundingOfCommitment` remain authoritative. New funding records reuse the existing tuple:
`funder=buyer`, `garden=buyerGarden`, `refundAccount=bound refundAccount`, `expectedAmount=price`,
`depositedAmount=actual recorded receivedAmount`, `depositReference=derived receipt key`.

For the existing `fundingOfCommitmentFunder` index, a new service booking may replace its latest
pointer only when the prior booking is `Withdrawn` or `Refunded`, its core request is inactive,
and the core authorizes a strictly newer request nonce/hash. Old funding records, purchase-ID
indices and receipt reservations remain immutable. An accepted core commitment has one canonical
accepted nonce and one consumed funding; this replacement path is preacceptance only. Exact
retries of a live pledge return the existing funding ID only if all bound facts match.

A metadata0 legacy record may already exist when its provider opts the commitment into service
terms. Preserve that record's legacy deposit attestation and exact-refund wind-down, including an
actual pre-opt-in transfer whose steward records it after opt-in. Do not pretend it has typed
receipt verification. New `recordFunding` is legacy-mode-only, and metadata0 `consumeFunding`
rejects any current PersonalGd/Voucher commitment before writing the permanent consumed pointer.
Thus neither old legacy funds nor an opaque deposit can masquerade as canonical service funding.
After its explicit withdrawal/refund completes, a genuinely new canonical service request/nonce
may create fresh metadata1 funding; the historical tuple remains unchanged.

## Identities and consent checks

`purchaseId` is never caller-supplied. Derive it as:

```solidity
keccak256(abi.encode(
    keccak256("GREEN_GOODS_PERSONAL_SERVICE_PURCHASE_V1"),
    block.chainid,
    address(this),
    commitmentId,
    termsRevision,
    termsHash,
    claimHash,
    requestNonce,
    buyer,
    buyer, // recipient
    buyerGarden,
    providerGarden,
    DESTINATION_EVM_CHAIN_ID,
    gDollarToken,
    price,
    custodySafe,
    authorizedDepositor,
    refundAccount,
    disclosedGrossAmount,
    disclosedNetAmount
))
```

The core claim hash already binds the authoritative core chain/proxy and canonical request nonce.
The outer domain binds the settlement source module. Neither identity depends on transport IDs.

`receiptKey = keccak256(abi.encode(chainId, transactionHash, logIndex))`.
Do not include token/from/to in the uniqueness domain: changing those purported facts must not
allow the same chain/transaction/log to be attributed twice.

Before pledge, require upgraded core `serviceOfferProtocolVersion()==1`; no try/catch downgrade.
Require its current exact active `PersonalGd` consent, `msg.sender==claimant==recipient`, matching
revision/terms hash/claim hash/nonce/garden, current membership and applicable claim shape. Derive
the actual provider garden from the pool; protocol pool resolves its configured protocol garden.
Require buyer garden's active registered Celo account and exact expected Safe/token/chain/price.
Require nonzero depositing/refund accounts, refund account distinct from custody Safe,
`disclosedGrossAmount >= disclosedNetAmount >= price > 0`.

The buyer transaction explicitly consents to gross debit up to `disclosedGrossAmount`, receipt up
to `disclosedNetAmount`, and successful excess up to `disclosedNetAmount-price` as garden top-up.
The later app must display these exact quantities before the user signs the ordinary Celo transfer.
Contracts do not perform that transfer, quote a universal exchange rate or automatically pull funds.

## Receipt attestation and shortfall recovery

`recordPersonalServiceDeposit` requires current buyer-garden steward/owner authority, exact frozen
Safe/token/chain/authorized depositor, nonzero transaction/block hash and block number, a globally
unused derived receipt key, and actual `0 < receivedAmount <= grossDebit`. The record may be
created only from Pledged and is
immutable afterward. Validate receipt facts against the frozen pledge, even if its core request
has since been withdrawn, superseded, or accepted by another buyer: money may already have reached
the old Safe before the steward records its receipt. Such a receipt must remain recordable for
an exact refund. Consumption separately rejects changed/inactive/noncanonical consent. Never
retarget a recorded receipt to a replacement revision, buyer, Safe or token.

The privileged caller attests that they verified the successful canonical-token transfer receipt
and its finalized block, the authorized depositing account, the actual Safe credit, and applicable
canonical token fees establishing gross debit and actual net amount. The chain/tx/log reference
anchors that verified deposit event; ancillary fee events must be included in their offchain check.
These fields are privileged factual attestations. The source contract cannot cryptographically
verify a Celo receipt from Arbitrum; no balance-only detection or hash-only evidence is accepted as
this operation's stated verification process. Tests use explicitly fictional attestations.

Record a positive below-price net amount as `DepositRecorded` so its exact refund right exists;
do not silently discard the recorded receipt or pretend the Safe received the quoted amount.
`consumeFunding` independently requires recorded net >= price, otherwise raises the existing
below-price error. Consumption also requires actual gross <= disclosed gross and actual net <=
disclosed net; over-budget/over-top-up receipts are recorded for full exact refund, never silently
converted into a larger purchase or top-up. Initial slice supports one verified deposit per funding record; an underfunded
booking winds down by request withdrawal/full recorded-net refund and a genuinely new core request
nonce if the buyer wishes to try again. It does not add a multi-receipt funding accumulator.

Old legacy opaque references cannot be retrospectively proven to represent particular Celo logs.
The new normalized keys are globally reserved across new typed personal-purchase records. The
legacy opaque-reference index remains separate. This does not claim retroactive cryptographic
deduplication of arbitrary historical assertions.

## Guard integration and commercial outcome

Use the new core service interface. Legacy route remains unchanged on the supported upgraded core;
Voucher mode always rejects G$ pledge and payout. Old `recordFunding` is legacy-only. Existing
`consumeFunding` and `queueFundingRefund` branch on new metadata, preserving their old selectors.

At consumption, compare every accepted core fact and frozen financial/account fact, require
accepted canonical buyer/recipient/nonce/revision/hash/both gardens, active exact buyer Safe, and
recorded net >= price and the gross/net consent bounds above. Permanently select this funding in
`consumedFundingOfCommitment`.

New-mode consumption accepts exactly core `Accepted`, `ReadyForConfirmation`, or `Fulfilled`.
This repairs delayed bookkeeping without a core -> settlement dependency: provider progression
alone never pays, and every payout entry still requires explicit buyer-garden consumption of the
exact verified funding. Reject `Disputed`, `Cancelled`, `Expired` and every preacceptance/unknown
state. Legacy consumption remains Accepted-only. There is no separate onchain InProgress enum.

Guard every public legacy payout-plan entry in `modules/Settlement/Plans.sol` BEFORE its library
call or idempotent early return: create, edit, finalize, prepare contributor, prepare beneficiary.
Require matching consumed new funding for PersonalGd and reject Voucher. Successful plan creation
(already requires core Fulfilled) selects irreversible outcome Payout and binds the resulting plan
ID atomically. Later entries require this exact plan/price/token/Safe/gardens and funding Consumed.
Payout selection is a full commercial settlement obligation; individual technical child outcomes
may be temporarily partial under the existing rail, but never authorize a partial commercial
discharge or a refund of remaining units.

Put composition guards in `Plans.sol` to avoid a linked-library dependency cycle: FundingLib
already imports public PlanLib. Do not make PlanLib import FundingLib in return. LifecycleLib
already imports FundingLib and can reuse its new checks within `_recheckDisbursement`.

Refund eligibility is terminal non-delivery, not a business-error cancellation of an irreversible
payout. A Consumed booking requires Cancelled/Expired. A DepositRecorded booking whose exact buyer
has already been accepted ALSO requires Cancelled/Expired; unconsumed does not imply refundable
after delivery. Before acceptance, the buyer must withdraw the service request, the provider must
decline it, terms must be superseded, another claimant must win, or the promise must be terminal
non-delivery. An active exact pending request first needs withdrawal, preventing acceptance after
an already-authorized refund. Core withdrawal preserves the immutable prior consent evidence.

`queueFundingRefund` selects outcome Refund and the existing one refund child atomically; rejects
any Payout/Settled branch; returns the entire actual recorded net amount to the bound refund
account. It cannot reprice, change recipient or replace the frozen Safe. Successful excess
`recordedNet-price` stays in the buyer garden Safe only after full payout completion.

`LifecycleLib._recheckDisbursement` checks new-mode payout/refund facts, covering createBatch,
dispatchDisbursement and dispatchBatch. Single and batch retry wrappers also perform new-mode
checks before resending the SAME execution key/payload. Requeue requires authenticated destination
failure and rejects SourceStranded; its new attempt cannot change economic facts. Scope guards
to new-mode children; legacy behavior remains unchanged.

Reject `failStrandedSubject` for a new-mode single or any batch containing a new-mode child. An
expired peer or timeout proves no absence of payment. Reject new-mode payout cancellation at
single and batch entrypoints after Payout branch selection: otherwise immutable child IDs become
permanently canceled while a full settlement remains owed. Pause remains the immediate emergency
control. No new source rescue, manual-success or Safe fallback entrypoint is added.

Authenticated acknowledgments remain receivable while paused and do not depend on the current
Safe configuration after actual execution. Existing current-key/duplicate/stale-result checks
run first. A failure retains the selected commercial branch. Only a fully complete payout plan
sets Settled (and existing FundingState.Closed); only authenticated refund success sets Refunded.
No late result may change a terminal branch or repeat value. Manual Safe owners retain actual
custody powers; their independent transfers are not automatically module settlement evidence.

## File map and tests

- New `interfaces/ISettlementPersonalServicePurchases.sol` as above.
- `modules/Settlement/Storage.sol`: add stateless interface inheritance only; no fields/gap changes.
- `lib/Settlement/FundingLib.sol`: namespace, identity, pledge/receipt handlers, new-mode branching,
  outcome guards and closure events. Existing State layout unchanged.
- `modules/Settlement/Lifecycle.sol`: new APIs; scope old funding/deposit entries; guard retries,
  cancellation/requeue/stranded paths including all members of batches.
- `modules/Settlement/Plans.sol`: composition guards and atomic Payout selection.
- `modules/Settlement/Views.sol`: additive new views.
- `lib/Settlement/LifecycleLib.sol`: explicit new-mode dispatch rechecks; memory config may add
  pooling/token addresses without storage or public-module ABI changes.
- `lib/Settlement/AcknowledgmentLib.sol`: existing duplicate/stale authentication retained; at most
  invoke owning funding closure hooks already used here, with no new result codec.
- New meaningful unit/integration tests. Existing Celo executor, codec, G$ token, custody setup and
  all 13 earned/purchase voucher source/test files remain unchanged.

Test real core Garden A -> Garden B and protocol paths; payer/provider authority isolation;
accepted revision/nonce/price/Safe/depositor/refund races; legacy and voucher-only rejection;
actual typed receipt mismatch/reuse; positive net shortfall consumption rejection and exact refund;
acceptance-before-consumption; unfunded legacy-plan bypass at every public entrypoint; competing
claims and full contributor allocation with crossgarden retention zero; single/batch pending and
lost/reordered result flows; same-key retry and authenticated-failure repair; SourceStranded and
cancel bypass rejection; full refund vs payout branch exclusion; successful excess; unchanged
legacy storage/records/inflight command behavior. Label mocked transport and receipt attestations.
Include withdrawal -> exact refund acknowledgment -> new core request nonce -> fresh pledge ->
provider acceptance -> fresh consumption; old delayed/duplicate acknowledgments remain bound to
the original funding ID/refund child/execution key and cannot close or fund the renewed booking.


---

# Voucher service redemption API proposal

Read-only design artifact for parent approval. No repository source has changed in this lane.
The existing 13 earned/purchase implementation files remain unchanged. This proposal does not
authorize a deployment or establish issuer capacity, prices, remedies or live signing readiness.

## Meaning and core seam

`VoucherRedemptionModule` is a snapshot/transport/reporting integration for an existing accepted
CommitmentPooling service promise. It does not create or resolve a second service promise.
`GnosisVoucherEscrow` owns only the presented voucher units and their allocation to approved
release or mutually approved return. Neither contract prices services or issues vouchers.

The separate additive `ICommitmentServiceOffers` interface is owned by the core lane. This lane
needs its canonical accepted view to return version 1, route Voucher, accepted revision and
terms hash, accepted claim hash, source buyer/service recipient, explicit Gnosis `voucherHolder`,
buyer garden and provider garden, plus exact voucher issuer/token/chain/units and service/remedy
references. Version 0 is legacy and cannot authorize redemption. G$ route cannot authorize it.
The buyer chooses the Gnosis holder address in the exact preacceptance service claim; the holder
must separately execute presentment and delivery/return approvals on Gnosis. Same-address EOA
fixtures and explicit Safe custody are distinct from proving member passkeys work on Gnosis.

`voucherIssuer` is the Gnosis reserve Safe itself, matching the existing earned-slice meaning of
issuer. There is no inferred reserve or substitute account. Before presentment, this reserve
must explicitly approve the exact authenticated authorization hash on Gnosis. Garden authority
alone cannot approve another issuer's asset or reserve.

Initial remedy is fixed `MUTUAL_CONSENT = 1`, included in the core terms hash and command. The
issuer approves a cumulative ceiling for returns; the holder separately approves actual returned
quantities. The ceiling is permission, not reserved units or proof of non-delivery. Only a holder
delivery approval proves that holder-approved quantity; core Fulfilled, fallback, purchase receipt
and timeout never create it. Holder-approved voucher units cannot subsequently become returned units.

Service quantities and voucher base units remain separate. Every authorization snapshots the
canonical service total and unit-label hash. A holder explicitly binds a cumulative delivered
service quantity to each additional voucher release. Repeating the same approved service total
does not count its units again. No conversion formula is inferred from the two quantities.
Voucher returns never decrement approved service units or prove non-delivery, waiver or release of
an outstanding service obligation. The existing core owns that lifecycle and remedy outcome.

In this version the responsible GiftableToken owner and issuer reserve must be the same Safe
principal. Exact authorization approval and initial presentment both require the published
`ICLCGiftableToken(token).owner() == issuer`. This is not checked after presentment: a later token
ownership rotation cannot strand released/returned quantities or acknowledgment repair. A distinct
owner/reserve custody relationship is unsupported without later issuer-approved evidence.

Core terms hash must bind the exact service terms/remedy references, unit definition/target and
all relevant mutable core terms. Prepared source records snapshot that accepted view; they do not
become a second mutable terms authority.

## Codec: exact field order

New file: `src/libraries/VoucherRedemptionCodec.sol`. No change to VoucherMessageCodec.

```solidity
library VoucherRedemptionCodec {
    uint8 internal constant VERSION = 1;
    uint8 internal constant MUTUAL_CONSENT = 1;
    bytes32 internal constant AUTHORIZATION_KIND =
        keccak256("GREEN_GOODS_VOUCHER_SERVICE_AUTHORIZATION_V1");
    bytes32 internal constant RESULT_KIND =
        keccak256("GREEN_GOODS_VOUCHER_SERVICE_RESULT_V1");
    bytes32 internal constant REDEMPTION_DOMAIN =
        keccak256("GREEN_GOODS_VOUCHER_SERVICE_REDEMPTION_V1");
    bytes32 internal constant ACTION_DOMAIN =
        keccak256("GREEN_GOODS_VOUCHER_SERVICE_ACTION_V1");

    enum ActionKind { None, Present, Release, Return }

    struct Authorization {
        uint8 version;
        uint256 sourceChainId;
        address sourceModule;
        uint256 commitmentId;
        uint64 revision;
        bytes32 acceptedClaimHash;
        bytes32 termsHash;
        address buyer;
        address holder;
        address buyerGarden;
        address providerGarden;
        uint256 destinationChainId;
        address destinationEscrow;
        address issuer;
        address token;
        uint256 totalVoucherUnits;
        uint256 totalServiceUnits;
        bytes32 serviceUnitLabelHash;
        bytes32 serviceTermsRef;
        bytes32 remedyTermsRef;
        uint8 remedyPolicy;
    }

    struct Result {
        uint8 version;
        bytes32 redemptionId;
        bytes32 payloadHash;
        uint64 resultSequence;
        bool issuerApproved;
        uint256 issuerReturnCeiling;
        uint256 escrowedUnits;
        uint256 holderApprovedServiceUnits;
        uint256 holderApprovedVoucherUnits;
        uint256 mutualReturnUnits;
        uint256 releasedUnits;
        uint256 returnedUnits;
        uint64 actionNonce;
        bytes32 actionHash;
        ActionKind actionKind;
        uint256 actionVoucherUnits;
        uint256 actionServiceUnits;
        bool actionSucceeded;
        bytes32 failureHash;
    }
}
```

Wire encoding is exactly `abi.encode(AUTHORIZATION_KIND, Authorization)` or
`abi.encode(RESULT_KIND, Result)`. Both decoders fail closed on wrong kind/version, including
earned command/ack kinds. `payloadHash = keccak256(abi.encode(authorization))`.
The authorization is 21 static words plus its kind: exactly 704 bytes. The result is 19 static
words plus its kind: exactly 640 bytes. No dynamic arrays, strings or unbounded message payloads
are introduced. Actual local execution gas still requires implementation proof; these byte sizes
do not establish live CCIP gas sufficiency.

`redemptionId = keccak256(abi.encode(REDEMPTION_DOMAIN, sourceChainId, sourceModule,
commitmentId, revision, acceptedClaimHash))`; it is derived from canonical source facts and is
independent of transport message IDs and retries.

For each holder-authorized value action, `actionHash = keccak256(abi.encode(ACTION_DOMAIN,
redemptionId, payloadHash, nonce, kind, voucherUnits, serviceUnits,
cumulativeHolderApprovedServiceUnits, cumulativeHolderApprovedVoucherUnits,
cumulativeMutualReturnUnits))`. Nonce starts at 1. `serviceUnits` is the newly approved service
delta, zero for Present/Return and possibly zero when an additional voucher release binds an
already approved cumulative service quantity. An issuer return ceiling alone is not a value action
and does not reserve units. Counterfactual passkey address compatibility is not assumed.

## Source API, records and storage

New file `src/modules/VoucherRedemptionModule.sol`, inheriting the unchanged VoucherEndpoint.
All external mutations hold the reentrancy guard. Preparation and dispatch require unpaused
execution. Authenticated results reconcile while paused.

```solidity
enum RedemptionState { None, Prepared, Pending, Active, Closed }

struct Redemption {
    uint256 commitmentId;
    bytes32 payloadHash;
    bytes32 lastMessageId;
    bytes32 resultHash;
    RedemptionState state;
    VoucherRedemptionCodec.Result latestResult;
}

function initialize(
    address owner_, address guardian_, uint64 destinationSelector_,
    uint256 destinationChainId_, address destinationEscrow_, address commitmentPooling_
) external;
function prepareRedemption(uint256 commitmentId) external returns (bytes32 redemptionId);
function quoteDispatch(bytes32 redemptionId) external view returns (uint256);
function dispatch(bytes32 redemptionId) external payable returns (bytes32 messageId);
function getRedemption(bytes32 redemptionId) external view returns (Redemption memory);
function getCommand(bytes32 redemptionId) external view returns (bytes memory);
// Mapping-generated ABI:
function redemptionOfCommitment(uint256 commitmentId) external view returns (bytes32);
function acknowledgmentMessages(bytes32 messageId) external view returns (bytes32);
```

Preparation requires caller equal canonical source buyer, accepted version-1 Voucher route,
nonzero exact accepted revision/hash/claim hash and explicit holder, Gnosis chain equal pinned
destination, core consideration None/zero, and core state Accepted, ReadyForConfirmation or
Fulfilled. It copies positive canonical `serviceUnits` and nonzero `unitLabelHash` into the
authorization's totalServiceUnits/serviceUnitLabelHash. Missing, legacy, G$ or terminal/disputed
promises cannot produce a new authorization.
Prepare once per commitment; no caller-supplied issuer, asset, holder, quantities or ID.

Dispatch requires source buyer, exact quoted `msg.value`, unpaused state and a prepared record.
Transport retries send identical stored bytes. A prepared authorization remains a durable snapshot;
dispatch never silently rewrites it to current terms or treats a later lifecycle timeout as proof.
Receiving results updates reporting counters, never core lifecycle or G$ consideration. Closed
means all escrowed vouchers were allocated to release/return; it never means service fulfilled.

The source validates every result's exact authorization hash, version, nonzero sequence,
failure-hash/success consistency and quantity invariants. Newer sequences may skip intervening
acks but cannot regress cumulative quantities or issuer approval. Exact duplicate sequences are
idempotent; same-sequence conflicting results revert. Older valid sequences are ignored. Closed
voucher allocation cannot be replaced by a later failure. Approved service quantity is monotonic,
bounded by the canonical service total, and distinct from the financial counters. Pending/unknown
is retained for absent acks. Generic core fulfillment is never relabeled as holder approval, and
full financial allocation never creates core fulfillment.

```solidity
// New contract's own storage: 5 slots, then 45-slot gap; no existing storage is touched.
ICommitmentServiceOffers public commitmentPooling;
mapping(uint256 commitmentId => bytes32 redemptionId) public redemptionOfCommitment;
mapping(bytes32 redemptionId => Redemption record) private _redemptions;
mapping(bytes32 redemptionId => bytes authorization) private _commands;
mapping(bytes32 messageId => bytes32 dataHash) public acknowledgmentMessages;
uint256[45] private __gap;
```

No ERC-7201 namespace is added by these fresh contracts. Existing base storage and gap remain
byte-for-byte unchanged; inheritance order is only VoucherEndpoint followed by new own fields.

```solidity
event RedemptionPrepared(
    bytes32 indexed redemptionId, uint256 indexed commitmentId, bytes32 indexed payloadHash
);
event RedemptionDispatched(bytes32 indexed redemptionId, bytes32 indexed messageId);
event RedemptionResultRecorded(
    bytes32 indexed redemptionId, uint64 indexed sequence, RedemptionState state,
    uint256 escrowedUnits, uint256 holderApprovedServiceUnits,
    uint256 holderApprovedVoucherUnits, uint256 mutualReturnUnits,
    uint256 releasedUnits, uint256 returnedUnits, bool actionSucceeded, bytes32 failureHash
);
```

## Gnosis API, records and storage

New file `src/modules/GnosisVoucherEscrow.sol`, inheriting unchanged VoucherEndpoint. The reserve
distribution adapter gains no additional methods or authority.

```solidity
struct PendingAction {
    uint64 nonce;
    VoucherRedemptionCodec.ActionKind kind;
    uint256 voucherUnits;
    uint256 serviceUnits;
    bytes32 actionHash;
}
struct Execution {
    VoucherRedemptionCodec.Result current;
    uint64 acknowledgmentSequence;
    bytes32 acknowledgmentMessageId;
    bytes32 acknowledgmentFailureHash;
}

function initialize(
    address owner_, address guardian_, uint64 sourceSelector_,
    uint256 sourceChainId_, address sourceModule_
) external;
function approveAuthorization(bytes32 redemptionId, bytes32 expectedPayloadHash) external;
function present(
    bytes32 redemptionId, bytes32 expectedPayloadHash, uint64 expectedActionNonce
) external;
function approveDelivered(
    bytes32 redemptionId, bytes32 expectedPayloadHash, uint64 expectedActionNonce,
    uint256 cumulativeDeliveredServiceUnits, uint256 voucherUnits
) external;
function authorizeReturn(
    bytes32 redemptionId, bytes32 expectedPayloadHash, uint256 cumulativeReturnCeiling
) external;
function returnUndelivered(
    bytes32 redemptionId, bytes32 expectedPayloadHash, uint64 expectedActionNonce, uint256 units
) external;
function retry(bytes32 redemptionId) external;
function getExecutionResult(bytes32 redemptionId) external view returns (Execution memory);
function getPendingAction(bytes32 redemptionId) external view returns (PendingAction memory);
function getCommand(bytes32 redemptionId) external view returns (bytes memory);
function quoteAcknowledgment(bytes32 redemptionId) external view returns (uint256);
function retryAcknowledgment(bytes32 redemptionId) external payable;
// Self-only isolation entrypoints, never an alternate approval path:
function executeAction(bytes32 redemptionId) external;
function sendAcknowledgment(bytes32 redemptionId) external returns (bytes32 messageId);
// Mapping-generated ABI:
function transportPayloads(bytes32 messageId) external view returns (bytes32);
function failureReason(bytes32 redemptionId) external view returns (bytes memory);
```

Incoming authorization must match pinned protocol version, source chain/module, local chain/
escrow, valid nonzero accepted identity/terms, token with code, holder and issuer not equal escrow,
positive finite voucher units, positive canonical service units, nonzero service-unit-label hash
and remedy policy 1. The peer/transport is authenticated first and attached
tokens are rejected by the existing base. Message ID reuse with different payload or redemption ID
reuse with different authorization reverts. Exact duplicate transport creates no action/ack fee.

First intake records authorization and result sequence 1, with zero quantity counters and issuer
approval false. This records authenticated intake, never service delivery or issuer approval.
Only the exact bound reserve can approve its exact payload; no source garden or endpoint owner
can impersonate it. Approval is irreversible for this immutable authorization and gates presentment.
Approval and first presentment require actual published GiftableToken owner equal bound issuer;
release, return and acknowledgment never recheck ownership after tokens are deposited.
Holder must personally call present to pull exactly totalVoucherUnits from that holder; no automatic
pull occurs on receipt. Every transfer checks exact debit and credit. No partial presentment in v1.

`expectedActionNonce` is the next nonce (previous + 1). There is at most one pending action. Each
new present/release/return action records its fixed nonce/kind/voucher-units/service-delta/hash,
then performs an isolated self-call. Explicit holder service approval and voucher/return allocations
are recorded before the self-call; the actual service approval and economic allocations persist
if movement fails. The self-call atomically transfers and
updates escrowed/released/returned amounts. A failed transfer or paused execution stores an error
and retryable pending action with unchanged terms, amounts, recipient and approval. No later action
may bypass an unresolved pending action. Permissionless retry, including a Safe's call, only repeats
that exact pending action and adds no authority. All mutable outer entrypoints are nonReentrant;
self-only execution cannot be called by owners, issuers or users directly.

For a release, the holder explicitly approves `cumulativeDeliveredServiceUnits`, which must be
positive, at least the previously approved service quantity and no greater than totalServiceUnits.
The simultaneous additional `voucherUnits` must be positive and fit the unallocated financial
balance. Newly approved service units are the difference from the previous cumulative quantity.
The same cumulative service quantity may bind multiple voucher releases without counting service
again. Their association is explicit holder approval under the exact accepted service terms;
there is no proportional or universal conversion formula.

For a return, the issuer's cumulative voucher permission and holder's exact voucher quantity
confirmation are both required. Issuer ceilings are monotonic, no greater than total authorized
voucher units, and never reserve or force returns. Holder delivery and return actions each require
enough unallocated deposited voucher units; financial allocation is final. Return actions have
zero service delta and never decrement approved service units or record waived service units.

Quantity invariants after every transition and in every authenticated result:

```text
escrowedUnits is either 0 or totalVoucherUnits
0 <= holderApprovedServiceUnits <= totalServiceUnits
releasedUnits <= holderApprovedVoucherUnits
returnedUnits <= mutualReturnUnits <= issuerReturnCeiling <= totalVoucherUnits
holderApprovedVoucherUnits + mutualReturnUnits <= escrowedUnits
releasedUnits + returnedUnits <= escrowedUnits
remaining voucher units = escrowedUnits - releasedUnits - returnedUnits
Closed iff releasedUnits + returnedUnits == totalVoucherUnits
Closed does not imply holderApprovedServiceUnits == totalServiceUnits or core Fulfilled
```

State-specific result invariants also apply. None has zero action fields and all quantity counters
zero. Present has actionVoucherUnits equal totalVoucherUnits, actionServiceUnits zero, approved
service/voucher and returned quantities zero, and escrowed units equal total on success or zero
on failure. Release has positive approved service and voucher quantities, escrowed equal total,
mutualReturnUnits equal returnedUnits, and holderApprovedVoucherUnits minus releasedUnits equal
zero on success or actionVoucherUnits on failure. Its actionServiceUnits is a nonnegative delta
no greater than cumulative approved service; zero is valid for an explicitly rebound already
approved service total. Return has actionServiceUnits zero, escrowed equal total,
holderApprovedVoucherUnits equal releasedUnits, and mutualReturnUnits minus returnedUnits equal
zero on success or actionVoucherUnits on failure. Non-None actions require positive voucher units,
issuer approval, nonzero nonce and the exact derived action hash. Equal action nonce binds equal
action hash; a successfully executed action cannot later become failed. Newer results cannot
decrease any cumulative approval/allocation/execution quantity. Older valid result sequences remain
ignorable even when their action failed before a newer success.

Transfer failure cannot erase holder-approved service quantity or turn approved voucher allocations
into returned vouchers. Neither voucher release nor financial closure proves any additional service
quantity. Unapproved service quantity is not automatically undelivered or an outstanding obligation.
A real transfer succeeds atomically with its result counters. Accidental unrelated token transfers
do not create presented units or capacity. No burn, mint, reserve pull, pool withdrawal, limiter,
token rescue or service-price/capacity management method is added.

Source snapshot and both destination approvals are intentionally separate. Later core lifecycle
events remain separately reportable, and neither a core cancellation nor timeout silently moves
escrow tokens. The accepted mutual-consent remedy requires the two explicit Gnosis approvals.
Approving a return is not a general assertion that the service was never delivered.

Every new result/state mutation increments resultSequence. Local actions/retries do not
automatically spend the native acknowledgment reserve. The first authenticated intake sponsors
at most one bounded acknowledgment attempt. An exact-fee caller-funded acknowledgment retry
sends the latest cumulative result only; ack failures never roll back tokens, approvals or results.
Quoting/sending failure is isolated. Incoming results and ack retries work while paused; economic
execution remains paused. Owner/guardian/48h delayed paused upgrade behavior is inherited unchanged.

```solidity
// New contract's own storage: 5 mapping slots, then 45-slot gap.
mapping(bytes32 redemptionId => Execution result) private _results;
mapping(bytes32 redemptionId => bytes authorization) private _commands;
mapping(bytes32 messageId => bytes32 payloadHash) public transportPayloads;
mapping(bytes32 redemptionId => bytes reason) public failureReason;
mapping(bytes32 redemptionId => PendingAction action) private _pendingActions;
uint256[45] private __gap;
```

```solidity
event RedemptionAuthorizationRecorded(
    bytes32 indexed redemptionId, bytes32 indexed payloadHash, bytes32 indexed messageId
);
event RedemptionIssuerApproved(
    bytes32 indexed redemptionId, address indexed issuer, bytes32 indexed payloadHash
);
event VoucherPresented(
    bytes32 indexed redemptionId, address indexed holder, address indexed token, uint256 units
);
event HolderDeliveryApproved(
    bytes32 indexed redemptionId, address indexed holder, bytes32 indexed actionHash,
    uint256 newlyApprovedServiceUnits, uint256 cumulativeApprovedServiceUnits,
    uint256 voucherUnits, uint256 cumulativeApprovedVoucherUnits
);
event RedemptionReturnAuthorized(
    bytes32 indexed redemptionId, address indexed issuer, uint256 cumulativeReturnCeiling
);
event HolderReturnApproved(
    bytes32 indexed redemptionId, address indexed holder, bytes32 indexed actionHash,
    uint256 units, uint256 cumulativeReturnUnits
);
event RedemptionActionResult(
    bytes32 indexed redemptionId, bytes32 indexed actionHash, uint64 indexed sequence,
    VoucherRedemptionCodec.ActionKind kind, uint256 voucherUnits, uint256 serviceUnits,
    bool success, bytes32 failureHash, bytes reason
);
event RedemptionAcknowledgmentSent(
    bytes32 indexed redemptionId, uint64 indexed sequence, bytes32 indexed messageId
);
event RedemptionAcknowledgmentFailed(
    bytes32 indexed redemptionId, uint64 indexed sequence, bytes reason
);
```

Error classes: invalid authorization, wrong payment route, unknown redemption, unauthorized
buyer/holder/issuer, wrong payload hash/nonce, conflicting payload/transport/result, issuer approval
missing, already presented/closed, pending action exists/no retryable action, invalid quantities,
unsupported remedy, self-only, paused execution, inexact transfer, incorrect transport fee.
Reuse inherited endpoint errors where they describe the same boundary; do not add string reverts.

## Required proof matrix

- Real core accepted Voucher claim across gardens; explicit different source buyer/Gnosis holder;
  legacy, PersonalGd, stale revisions, missing holder and preacceptance all fail closed. Core Voucher
  promise never enters G$ payout/funding/disbursement paths. Source buyer cannot impersonate holder.
- Unrelated garden/endpoint owner cannot approve issuer reserve/token authorization. Issuer A
  cannot approve issuer B's GiftableToken. Token owner rotation before presentment rejects intake;
  ownership rotation after presentment cannot block approved release/return or ack repair. Wrong
  issuer, asset, peer, selector, source/destination/module, kind/version and attached tokens rejected.
- Atomic full presentment: finite holder allowance, insufficient holder balance, fee/inexact transfer,
  paused execution and repair. Stored failed exact present action cannot be retargeted or duplicated.
- Full and partial holder-approved service with service and voucher quantities deliberately unequal:
  authorize 10 lessons/100 voucher atomic units, approve cumulative 3 lessons +20 vouchers, approve
  the same cumulative 3 lessons +20 more vouchers, then mutually return 60 vouchers. Service approval
  remains 3, voucher approval is 40, escrow is Closed and core can remain Accepted. No assumed rate,
  duplicate service counting or financial-closure-to-fulfillment inference is possible. Fulfilled
  through ordinary, pool fallback and dispute resolution does not itself approve any service unit.
- Issuer ceiling alone moves/reserves nothing; holder alone cannot return; timeouts authorize neither
  return nor delivery. Exact remedy hash/payload and both approvals are bound. Release/return race,
  overapproval, wrong nonce, repeated return and return-after-release conserve quantities.
- Failed release preserves both explicit service approval and financial allocation, with no partial
  successful movement; return cannot reuse allocated voucher units. Repair/retry repeats exactly
  the fixed service delta and voucher amount once. Return failure similarly preserves allocation.
  Decreasing or over-total cumulative service approvals fail; a return never reduces service approval.
- Command duplicate/new message IDs, same message ID conflict, entitlement/authorization reuse and
  action replay do not duplicate execution or drain sponsored ack reserve.
- Delivery succeeds with lost ack; durable destination counters and direct events remain true;
  fee-paid retry sends current state without repeating transfers. Stale failure before/after newer
  success, skipped intermediate sequences and same-sequence conflicts reconcile correctly.
- Pauses block movements, not result reconciliation; guardian cannot resume or bypass 48h upgrade;
  Safe calls use the same authenticated approval/retry paths. Pinning and immutable checks inherited.
- Existing earned/purchase 13-file digests, core/settlement legacy tests, storage layout and ABI/event
  compatibility remain valid. Synthetic transport/local accounts and real token fork proof are labeled
  separately; no external membership activation is claimed.

No genuine product conflict remains in this proposal. Exact issuer-approved fictional service and
remedy fixtures are required for tests; COM-46/live account and capacity prerequisites remain open.


### Internal composition refinement, 20:56 UTC

The selected typed ABI, namespace slots/member order and economic rules remain unchanged.
To keep responsibilities cohesive and preserve the existing deployed-library inventory, the
Settlement implementation may compose internal-only PersonalPurchaseStorageLib (the selected
three-map namespace), PersonalPurchaseConsentLib (canonical consent and frozen financial identity),
PersonalFundingLib (purchase funding/outcome lifecycle) and common FundingGuardLib authority
checks through the existing deployed FundingLib facade. No new public deployed library is added.
The redemption codec owns stateless wire validation/action hashing; an internal-only
VoucherRedemptionTransfers helper owns Giftable ownership and exact ERC-20 transfer checks.
The endpoints retain state, approvals, custody and authenticated transport. No source-length debt
allowance or new generic token framework is introduced. Final names and proof belong in execution
evidence; these internal helpers are not additional external authorizations.


### Wire and holder allowance refinement, 21:04 UTC

Before the corresponding runtime edit, select exact704-byte authorization and640-byte result
decoding; truncated or trailing bytes fail the typed protocol boundary. Initial presentment
requires a finite holder ERC-20 allowance; uint256.max is rejected inside the isolated transfer
execution as a stored recoverable failure. Repairing that allowance retries the same pending
action and payload. This constrains delegated token spending only, establishes no service
capacity or supply cap, and adds no reserve-pull approval to release/return. No ABI, namespace
or authenticated economic field changes.


### Redemption transport composition refinement, 21:13 UTC

The formatted complete escrow source exceeded the350-line source boundary. Before moving code,
select a cohesive `VoucherRedemptionReceiver` abstract base for pinned authorization intake/replay,
views and independent acknowledgment transport. Move the exact five mappings, record types and
45-slot gap in their existing order after unchanged VoucherEndpoint storage. The concrete escrow
retains issuer/holder approvals, financial/service quantity arithmetic and isolated atomic token
actions. No new slot, second gap, namespace or deployed library is added. Verify actual compiled
layout and external selectors/events/tuple shapes across the move; any Solidity `internalType`
metadata name change is disclosed rather than called byte-identical. No authorized economic
payload or action rule changes. `Active` in source reporting means a destination escrow record
was observed; it does not mean tokens were presented or an external membership was activated.


### Late incoming Celo deposit recovery, selected 21:14 UTC before implementation

Observed asynchronous gap: a metadata1 Pledged booking can become Withdrawn after its core
request was withdrawn/superseded, while a previously signed Celo transfer is still in flight or
its receipt attestation is delayed. Pledged-only receipt recording would strand its financial
recovery. Select a narrow new-mode extension: record exactly one globally unique verified typed
receipt in Pledged or Withdrawn, always against the old immutable Safe/asset/authorized depositor
and financial consent. Withdrawn intake reopens financial bookkeeping as DepositRecorded,
clears closedAt and immediately selects irreversible outcome Refund with no child yet. It never
changes core consent, nonce, the latest funding pointer, purchase identity or a newer booking.
The existing withdrawal event remains historical evidence; no legacy record is reclassified.

The existing queueRefund then creates its usual one exact-recorded-net refund child and links
that already-selected Refund branch atomically. It must still enforce the frozen route; a failed
queue leaves the old refund obligation recoverable. Consumption of the late receipt is forbidden
by its Refund outcome even if other checks change. No second receipt, duplicate child or return
to Payout is allowed. Existing typed-receipt and OutcomeSelected events describe the new facts;
no new storage, ABI, custody, transport or Safe authority is introduced. A new request nonce can
proceed independently after the earlier unfunded withdrawal, and late old acknowledgments keep
their original funding ID/child/execution key. Regression: withdrawal→new pledge→late old receipt→
old exact refund, with unchanged new funding, no old consumption and no receipt replay.


### Measured EIP-170 correction, selected 21:25 UTC before implementation

The first actual production-profile size gate fails: SettlementModule28,391bytes(limit24,576;
excess3,815), FundingLib25,024(excess448). Core 22,781, source redemption 17,875 and destination
escrow 17,888 fit. No size allowance, new deployed library or inventory change is selected.

Move the new payout guards and Payout selection into their existing public PlanLib entries,
composing internal-only consent/outcome helpers through a shared internal FundingLib state
accessor. Move the new retry/requeue/batch/cancel/stranded guards into their existing LifecycleLib
entries. Preserve before-idempotent-return validation and inspection of every batch child.
This restores each behavior's existing owner and removes repeated module facade calls. Inspect
actual linkReferences to prove no PlanLib→deployedFundingLib backlink/cycle appears.

Use the existing pooling module's protected raw-return read pattern for Settlement getPayoutPlan,
getDisbursement, getBatch and the new getPersonalServicePurchase. Their external selectors,
argument/return field order, unknown-ID errors and storage remain unchanged. Their encoders live
in existing PlanLib, LifecycleLib and FundingLib; mapping/plan slots come from compiler `.slot`,
not hard-coded layouts. Keep the old static getCommitmentFunding implementation unchanged.

Exact additive module helper: `settlementViewDelegate(bytes calldata data) external`, restricted
to `msg.sender==address(this)` using existing UnauthorizedCaller. A fixed allowlist of the four
read-library selectors routes only to their corresponding link-time PlanLib/LifecycleLib/FundingLib
addresses. Reject short/unsupported data with new `UnsupportedSettlementView()`. No target address
is caller-supplied. Public view shells STATICCALL self and forward raw return/revert data; the
static EVM context prevents state writes through the library DELEGATECALL. The helper is not added
to the frozen ISettlementModule or a product flow, grants no funds/role authority and creates no
new state. Its compiler selector/ABI artifact will be recorded with final proof.

Prove full ABI tuples including dynamic reason strings/child lists against the canonical library
encoding, unknown-ID reverts, helper external-call rejection and unsupported-selector rejection.
Run production size again, complete legacy/service tests, actual storage comparison, link inventory
and original G$ production gas gates. Apply only this measured correction, not a general-purpose
delegate framework or unrelated Settlement redesign.

### Compatibility and size outcome, observed 21:50 UTC

The fresh production-size gate passes: SettlementModule 23,728 bytes, FundingLib 22,217,
LifecycleLib 22,284 and PlanLib 20,467. The module retains 848 bytes of EIP-170 headroom;
the limit and compiler profile are unchanged. The actual implementation link graph matches
the historical lock's seven Settlement and fourteen pooling library names. PlanLib has no
deployed FundingLib backlink. The historical lock is preserved as historical release evidence;
it does not attest to this new, uncommitted bytecode.

Matching the library-name inventory does not reuse old deployed library code or addresses. A later
authorized release must derive fresh candidate artifacts and addresses for every changed library
and link each proxy implementation to those candidate libraries. Do not deploy this extension
against the historical lock or treat its preserved hashes as current release receipts.

The additive `settlementViewDelegate(bytes)` selector is `0x2e74d824`. Its four allowed reads
pass full ABI differential tests against independent storage getters, including dynamic strings
and arrays, exact unknown-ID reverts, and rejection of external, short, unknown and mutation
calls. The old exported pooling/settlement interface ABI bytes remain unchanged.

All sixteen protected linear layouts and five registered namespaces pass. The earned allocation
extraction preserves its exact external ABI and all 28 storage entries. The escrow receiver
extraction preserves all 24 absolute storage entries and recursive field shapes, 41 selectors
and canonical ABI/event/tuple names. Only nominal inherited `internalType` labels change, so the
full escrow ABI bytes differ and its additive export was regenerated. These are local compiler
and test observations, not deployed-version upgrade or release approval.

### Final static-proof correction and measurements, 22:49 UTC

Four private helper extractions resolve Solhint's complexity limit without changing checks,
order, errors, ABI, storage or library inventory. Final production sizes remain Settlement 23,728,
Lifecycle 22,284, Plan 20,467, source redemption 17,875 and escrow 17,888 bytes; Funding decreases to
22,196. Final size/storage, compiler ABI/layout comparisons, full package/verifier and pinned
Gnosis 39/Celo 12 proofs pass. The execution continuation records exact component coverage, the
retained failed runs and the test-only naming/CLI corrections. No release lock, permission,
dependency, historical address or live authority was changed.
