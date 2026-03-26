# Proposal: Modernizing Ethereum DID Standards for AA, Interop, Privacy, and Security

Date: 2026-03-20  
Author: Green Goods research draft  
Status: Shareable proposal draft for EF, `did:ethr` maintainers, and DID ecosystem contributors

## Executive summary

This proposal recommends a focused standards path:

1. Modernize `did:ethr` first (rather than creating a new DID method immediately).
2. Add explicit account-abstraction and smart-account verification semantics (`ERC-1271`, `ERC-6492`, `ERC-4337`, `EIP-7702` compatibility).
3. Publish an interoperability profile spanning `did:ethr`, `did:pkh`, SIWE/SIWx, CAIP account identifiers, and intent/cross-chain workflows.
4. Deliver conformance tests, resolver reference updates, and migration guidance as public goods.

The goal is to align Ethereum DID usage with current production wallet/account patterns, while preserving privacy and minimizing fragmentation.

## Claim validation

### Validated

- `DID Core v1.0` remains the W3C Recommendation from July 19, 2022.  
  Source: [W3C DID Core](https://www.w3.org/TR/did-core/)
- `DID v1.1` is active work and currently published as a Candidate Recommendation Snapshot (Feb 21, 2026).  
  Source: [W3C DID v1.1](https://www.w3.org/TR/did-1.1/)
- `DID Resolution v0.3` is a W3C Working Draft (Mar 9, 2026).  
  Source: [W3C DID Resolution](https://www.w3.org/TR/did-resolution/)
- `DID Methods` registry is actively maintained as a W3C Note (updated Mar 16, 2026).  
  Source: [W3C DID Methods](https://www.w3.org/TR/did-extensions-methods/all/)
- EF has an explicit RFP to modernize `did:ethr` and states the current spec/tooling are outdated versus current W3C and DIF expectations.  
  Source: [Ethereum Foundation RFP](https://esp.ethereum.foundation/applicants/rfp/did_ethr_method_spec)
- EF public framing includes CROPS values (censorship resistance, open source, privacy, security).  
  Sources:  
  [Ethereum Foundation Silviculture Society](https://ethereum.foundation/silviculture-society)  
  [EF Vision](https://blog.ethereum.org/2025/04/28/ef-vision)  
  [Protocol Update 003](https://blog.ethereum.org/2025/08/29/protocol-update-003)
- Relevant Ethereum standards landscape:
  - `EIP-7702` is `Final`.  
    Source: [EIP-7702](https://raw.githubusercontent.com/ethereum/EIPs/master/EIPS/eip-7702.md)
  - `ERC-1271` is `Final`.  
    Source: [ERC-1271](https://raw.githubusercontent.com/ethereum/ercs/master/ERCS/erc-1271.md)
  - `ERC-6492` is `Final`.  
    Source: [ERC-6492](https://raw.githubusercontent.com/ethereum/ercs/master/ERCS/erc-6492.md)
  - `ERC-4337` is `Review`.  
    Source: [ERC-4337](https://raw.githubusercontent.com/ethereum/ercs/master/ERCS/erc-4337.md)
  - `ERC-7579` is `Draft`.  
    Source: [ERC-7579](https://raw.githubusercontent.com/ethereum/ercs/master/ERCS/erc-7579.md)
  - `ERC-7683` is `Draft`.  
    Source: [ERC-7683](https://raw.githubusercontent.com/ethereum/ercs/master/ERCS/erc-7683.md)

### Partially validated

- Claim: "There is a recently shared EF mandate transaction on Ethereum."  
  Result: EF mandate language is validated in official EF publications, but a canonical on-chain transaction hash was not confirmed from official EF pages during this research pass.  
  Suggested next step: request/provide the specific transaction hash and chain for verification before citing as canonical evidence.

## Problem statement

`did:ethr` adoption happened early and organically, but the method lags modern Ethereum account and interoperability realities:

- Smart account signatures are now standard, but DID verification assumptions still lean EOA-first.
- Counterfactual account flows are common, but DID verification guidance is inconsistent.
- Multi-chain/account context is normal, but method-level interop guidance remains weak.
- Privacy expectations are stricter, while many DID implementations still over-disclose.

This creates real integration friction for wallets, verifiers, and VC ecosystems, and increases security ambiguity for relying parties.

## Objectives

- Make `did:ethr` technically current for 2026 wallet/account behavior.
- Preserve composability with W3C DID and VC ecosystems.
- Improve security and replay-resistance semantics for verifiers.
- Add a clear cross-chain/interoperability profile.
- Keep privacy-by-default and avoid unnecessary on-chain identity leakage.

## Non-goals

- No attempt to rewrite DID Core itself.
- No attempt to make a single method solve all identity/compliance use cases.
- No forced migration for existing `did:ethr` identifiers.

## Proposal

## 1) `did:ethr` vNext specification update

### 1.1 Account control and signature verification model

Define normative verifier behavior for controller proofs:

- EOA path: ECDSA verification.
- Deployed smart account path: `ERC-1271` verification.
- Counterfactual path: `ERC-6492` wrapper handling, then `ERC-1271`.
- Delegated EOA/account-code path: explicit `EIP-7702` compatibility requirements.

Minimum outcome: relying parties get deterministic, testable verification behavior across account types.

### 1.2 AA-aware DID document semantics

Define how resolvers represent:

- current controller material,
- time/version metadata (`versionId`, `versionTime` behavior),
- contract-controller transitions and rotation events,
- capability boundaries for validator/module-based accounts.

### 1.3 Network and chain semantics

Standardize explicit chain addressing and avoid implicit/mainnet-default assumptions in new guidance.

- Align with CAIP account and chain conventions where possible.
- Include deterministic parser and canonicalization guidance for mixed-case addresses.

## 2) Ethereum DID interoperability profile

Publish a separate profile that maps common auth and capability flows:

- `did:ethr` and `did:pkh` usage boundaries.
- SIWE (`ERC-4361`) and SIWx (`CAIP-122`) mapping rules.
- CACAO (`CAIP-74`) representation guidance for portable authz receipts.
- Cross-chain intent context alignment (`ERC-7683` draft ecosystem direction).

This profile should be explicit that `did:pkh` remains intentionally minimal and non-updatable, while `did:ethr` handles richer lifecycle and delegation semantics.

## 3) Privacy and security baseline

Adopt strict baseline requirements aligned to EF's CROPS values:

- No PII in DID documents by default.
- Pairwise DID patterns for user-facing workflows.
- Explicit correlation-risk warnings for multi-service reuse.
- Verifier requirements for replay bounds, timestamp checks, and session invalidation on state changes.
- Security guidance for contract upgrade/migration and stale signature handling.

## 4) Conformance and reference artifacts

Ship public goods beyond prose:

- Resolver conformance test suite.
- Cross-account test vectors: EOA, 1271 wallet, 6492 counterfactual, 7702 delegated, 4337-style account patterns.
- Interop fixtures for SIWE/SIWx/CACAO payloads.
- Migration guide and compatibility matrix for major libraries/wallet stacks.

## Governance and execution plan (12-16 weeks)

## Phase 1: Spec and gap analysis (Weeks 1-4)

- Gap matrix: current `did:ethr` spec vs DID Core 1.0 and active DID 1.1 expectations.
- Security threat model for verification and delegation flows.
- Draft normative sections for control proofs and resolver behavior.

## Phase 2: Implementation and tests (Weeks 5-10)

- Update resolver/reference libraries.
- Publish conformance tests and fixtures.
- Validate against at least 3 independent wallet/account implementations.

## Phase 3: Standardization and adoption (Weeks 11-16)

- DIF process submission track.
- Public review rounds with Ethereum identity, wallet, and VC implementers.
- Release vNext specification package and handoff/maintenance plan.

## Recommended working group composition

- DID spec editors/resolver maintainers.
- Ethereum AA and wallet implementers.
- Interop and intent-stack contributors.
- Privacy/security reviewers.
- VC/OpenID/OID4VP implementers.

## Green Goods integration blueprint

Green Goods should adopt DID upgrades in a conservative, privacy-preserving way:

- Keep EAS attestations as the public impact proof substrate.
- Use DID mostly for issuer/operator/verifier identity and capability delegation.
- Avoid putting gardener real-world identifiers on-chain.
- Support wallet-linked DIDs for portable reputation while preserving pseudonymity.

Suggested phased integration:

1. Add optional DID references for operator/verifier identities in off-chain metadata and reporting exports.
2. Add verifier mode that accepts `did:ethr`/`did:pkh` + SIWE/SIWx proofs.
3. Add OpenCred-compatible verification workflow for VC/OID4VP inputs, while anchoring only minimal proofs on-chain.

## OpenCred alignment

OpenCred appears compatible as an off-chain credential exchange and verification layer:

- Supports W3C VCs and DIDs.
- Supports OIDC and OID4VP workflows.
- Supports CHAPI wallet selection.
- Stores historical DID documents for auditability.

Source: [OpenCred repository](https://github.com/stateofca/opencred)

Recommended architecture:

- OpenCred (or equivalent) for credential exchange and selective disclosure.
- Ethereum (`did:ethr`/`did:pkh` + attestations) for portable, auditable cryptographic anchors.
- Keep private user attributes off-chain unless explicit user/legal requirements demand otherwise.

## Risks and mitigations

- Risk: standards fragmentation across DID methods and wallet stacks.  
  Mitigation: publish one interoperability profile and test suite early.
- Risk: verifier insecurity from ambiguous account-control semantics.  
  Mitigation: normative verification order and fixture-driven conformance tests.
- Risk: privacy regression via over-linked identifiers.  
  Mitigation: pairwise DID guidance and strict non-PII defaults.
- Risk: over-scoping into a brand-new DID method too early.  
  Mitigation: prioritize `did:ethr` modernization and re-evaluate after adoption metrics.

## Recommendation on "revamp vs new DID method"

Current recommendation:

- Revamp `did:ethr` now.
- Publish an AA+interop profile spanning `did:ethr` and `did:pkh`.
- Defer any new Ethereum DID method decision until:
  - conformance suite adoption is demonstrated,
  - cross-wallet interoperability passes in production,
  - unresolved requirements remain that cannot be represented with updated `did:ethr` + profile.

## Proposed acceptance criteria

- Updated spec accepted in DIF process track with public review.
- Reference resolver and tests released under permissive license.
- At least 3 independent wallet/account stacks pass core conformance cases.
- Verified interoperability examples for SIWE/SIWx/CACAO published.
- Clear migration and security guidance adopted by at least 2 relying-party implementations.

## Sources

- W3C DID Core v1.0: [https://www.w3.org/TR/did-core/](https://www.w3.org/TR/did-core/)
- W3C DID v1.1: [https://www.w3.org/TR/did-1.1/](https://www.w3.org/TR/did-1.1/)
- W3C DID Resolution v0.3: [https://www.w3.org/TR/did-resolution/](https://www.w3.org/TR/did-resolution/)
- W3C DID Methods Note: [https://www.w3.org/TR/did-extensions-methods/all/](https://www.w3.org/TR/did-extensions-methods/all/)
- EF RFP for `did:ethr`: [https://esp.ethereum.foundation/applicants/rfp/did_ethr_method_spec](https://esp.ethereum.foundation/applicants/rfp/did_ethr_method_spec)
- EF values and direction:
  - [https://ethereum.foundation/silviculture-society](https://ethereum.foundation/silviculture-society)
  - [https://blog.ethereum.org/2025/04/28/ef-vision](https://blog.ethereum.org/2025/04/28/ef-vision)
  - [https://blog.ethereum.org/2025/08/29/protocol-update-003](https://blog.ethereum.org/2025/08/29/protocol-update-003)
- `did:ethr` spec draft (current resolver repo):  
  [https://raw.githubusercontent.com/decentralized-identity/ethr-did-resolver/master/doc/did-method-spec.md](https://raw.githubusercontent.com/decentralized-identity/ethr-did-resolver/master/doc/did-method-spec.md)
- `did:pkh` draft:  
  [https://raw.githubusercontent.com/w3c-ccg/did-pkh/main/did-pkh-method-draft.md](https://raw.githubusercontent.com/w3c-ccg/did-pkh/main/did-pkh-method-draft.md)
- Ethereum standards:
  - `EIP-7702`: [https://raw.githubusercontent.com/ethereum/EIPs/master/EIPS/eip-7702.md](https://raw.githubusercontent.com/ethereum/EIPs/master/EIPS/eip-7702.md)
  - `ERC-4337`: [https://raw.githubusercontent.com/ethereum/ercs/master/ERCS/erc-4337.md](https://raw.githubusercontent.com/ethereum/ercs/master/ERCS/erc-4337.md)
  - `ERC-1271`: [https://raw.githubusercontent.com/ethereum/ercs/master/ERCS/erc-1271.md](https://raw.githubusercontent.com/ethereum/ercs/master/ERCS/erc-1271.md)
  - `ERC-6492`: [https://raw.githubusercontent.com/ethereum/ercs/master/ERCS/erc-6492.md](https://raw.githubusercontent.com/ethereum/ercs/master/ERCS/erc-6492.md)
  - `ERC-7579`: [https://raw.githubusercontent.com/ethereum/ercs/master/ERCS/erc-7579.md](https://raw.githubusercontent.com/ethereum/ercs/master/ERCS/erc-7579.md)
  - `ERC-7683`: [https://raw.githubusercontent.com/ethereum/ercs/master/ERCS/erc-7683.md](https://raw.githubusercontent.com/ethereum/ercs/master/ERCS/erc-7683.md)
  - `ERC-4361`: [https://eips.ethereum.org/EIPS/eip-4361](https://eips.ethereum.org/EIPS/eip-4361)
- Chain-agnostic standards:
  - `CAIP-10`: [https://standards.chainagnostic.org/CAIPs/caip-10](https://standards.chainagnostic.org/CAIPs/caip-10)
  - `CAIP-122`: [https://standards.chainagnostic.org/CAIPs/caip-122](https://standards.chainagnostic.org/CAIPs/caip-122)
  - `CAIP-74`: [https://standards.chainagnostic.org/CAIPs/caip-74](https://standards.chainagnostic.org/CAIPs/caip-74)
- OpenCred repository: [https://github.com/stateofca/opencred](https://github.com/stateofca/opencred)
