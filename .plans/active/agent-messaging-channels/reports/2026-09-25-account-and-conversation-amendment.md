# Account paths, conversation loop and implementation simplification

**Observed:** 25 September 2026. Repository `da329c99e556ad248dded850efc1f8e6cc0c75be`.
**Purpose:** answer the user's architecture questions and correct the current technical brief.
**Evidence boundary:** source/document research, not a wallet, provider or chain compatibility test.

## Decisions and corrections

- **CORRECTED:** removing EIP-7702 did not remove delegation from existing Kernel accounts. EOAs sign exact actions; Kernel users can opt into limited reporting and separate review permissions. This is the target architecture, not an enabled capability.
- **USER DECISION:** passkey stewards should be offered a separate limited review delegation. Reporting grants do not include review powers.
- **USER DECISION:** future EOA/passkey association belongs to each person's own account/identity, not a shared steward account. It remains future work.
- **CORRECTED:** users start with unstructured work descriptions. Infer eligible garden Actions and clarify ambiguity. The signature state branches by account authority.
- **CORRECTED:** Jev/extraction must be revisited for meaningful answers and corrections. One call at the start is an incomplete sequence.
- **CORRECTED:** use the PWA design system for no-install browser ceremonies. Recommend two reusable view families, neutral account language, and contextual Help instead of an unspecified Menu.

The current [technical brief](../technical-brief.md) owns the revised diagrams, ERD, dependencies, flows and acceptance requirements. Prior dated reviews describe the design at their review time.

## What the evidence establishes

| Question | Finding and source | Limit |
| --- | --- | --- |
| Current passkey account | [Shared adapter](../../../../packages/shared/src/workflows/auth-passkey-adapters.ts) constructs Kernel 0.3.1 / EntryPoint 0.7 through permissionless, WebAuthn and Pimlico | Does not configure the proposed session permission |
| Kernel can delegate | [Official v3 automation](https://docs.zerodev.app/smart-accounts/permissions/transaction-automation) documents an agent-created signer and owner-approved policy | Generic examples do not prove our account derivation, validator, module address or deployment compatibility |
| What restricts a grant | [Call policy](https://docs.zerodev.app/smart-accounts/permissions/policies/call), [gas policy](https://docs.zerodev.app/smart-accounts/permissions/policies/gas), timestamp and rate policies | Must test the actual dynamic EAS tuple/bytes encoding; an EAS target/selector allowlist is too broad |
| What Jev supplies | [State documentation](https://docs.typesafe.ai/concepts/state) describes snapshot input and independent typed questions; text only | It is not a scheduler, persistence layer, authorization authority or transcription service |
| Existing transport seam | [InboundMessage](../../../../packages/agent/src/types.ts) already represents text and media across providers; Telegraf is installed | Existing [intake smoke script](../../../../packages/agent/scripts/intake-smoke.ts) covers idea/bug capture, not this work flow |
| Existing audio | [AI service](../../../../packages/agent/src/services/ai.ts) uses English Whisper and extension-based OGG conversion | [Agent Dockerfile](../../../../packages/agent/Dockerfile) does not explicitly install/check ffmpeg. WhatsApp codec, language, memory and cleanup behavior remain unproven |
| New dependencies | Agent/Shared/client manifests show existing Hono, SQLite, Viem, XState, AppKit, permissionless and Transformers | Jev integration, extraction provider, direct Sharp/Zod declarations, Kernel permission adapter and signing service are new or conditional |

## Recommended Jev and LLM structure

**INFERRED / PROPOSED:** a code-owned durable coordinator uses Jev for routing and bounded next-step decisions, an LLM for open-field extraction and phrasing, and deterministic code for all schema, identity, permission and transaction checks. Jev can lead the conversational branch without owning execution authority.

For a free-text report or correction: load a minimal versioned snapshot → Jev routing/candidate judgment → extraction when needed → code validation → optional second Jev judgment over the updated facts → revision-checked commit and reply. Independent Jev questions cannot consume each other's newly generated answers within one call. Explicit commands and receipts avoid unnecessary inference. Final confirmation always names the persisted garden, Action, fields and evidence.

Compare this against one extraction LLM plus deterministic branching in the synthetic harness. Measure Action selection, clarification quality, wrong-field proposals, turns to a correct report, latency and cost. Do not treat model confidence or type correctness as proof of factual correctness. Evaluate each supported language separately.

## Why API-first testing is useful

The proposed phase 0 drives the real coordinator and SQLite through a synthetic adapter and private development API. It covers conversation, correction, identity/role rejection, delegation branches, stale results, duplicate events and recovery using explicit fake transports/signers/chain responses. Then test real browser/Kernel/EOA behavior, then Meta adapter conformance and live messaging.

Telegram can offer a convenient interactive surface through the same coordinator, but adds setup and does not prove WhatsApp constraints. Recommend the reproducible API harness first and Telegram only if useful to collaborators. Keep the legacy custodial Telegram flow out of this path.

## Simplification recommendations

Keep participant/channel/account separate for relinking and personal multi-account support. Defer group binding history until groups exist; use chain/address references instead of a garden mirror. Keep immutable source messages and draft revisions, but start with provenance/model diagnostics as bounded JSON. Keep one media record per asset, one publication operation and multiple attempts, because their failure lifetimes differ. A small public-work mapping survives private draft cleanup. API access and onchain execution grants must stay separate.

Two route families can share a typed ceremony engine: continuation for identify/access/grant/sign/status; recovery for account proof/new-channel replacement/status. Server-validated purpose controls the operation. Fewer screens reduce duplication, but neither query parameters nor a generic component may blend authority types. No new UI library is needed.

## Kernel proof and remaining selections

**UNRESOLVED:** exact permissions SDK/module versions compatible with current accounts; onchain restrictions for nested EAS data; owner enable/revoke semantics; existing bundler/paymaster compatibility; final custody provider; gas/frequency/expiry defaults; target-language speech quality and inference-provider terms. These are concrete proof/selection tasks, not a reason to erase the requested delegation path.

Recommended starting permissions are one account/chain/garden, Work-only reporting, and a distinct WorkApproval-only review grant. Propose 24 hours/5 reports and 1 hour/5 review decisions for the demo, each with a separately measured cumulative gas cap. Keep transfers, approvals, account changes and arbitrary signatures excluded. Reviews need an explicit resolver-hook audit because a zero-value attestation may still trigger downstream effects. These limits are recommendations, not user-approved numeric policy.

Recommended custody is a remote policy-checking signer using a managed non-exportable secp256k1 key. [AWS KMS key specifications](https://docs.aws.amazon.com/kms/latest/developerguide/symm-asymm-choose-key-spec.html) establish an available key type, not a drop-in Ethereum integration. A KMS does not enforce garden rules. Encrypted software session keys are simpler but expose decrypted keys to the worker; exact owner signing remains the fallback while delegation proof is incomplete.

A personal application passkey may replace recurring application login after EOA ownership proof. It cannot sign for the unchanged EOA. A personal Kernel execution account has its own address; roles, active reporting identity and recovery require a future migration design. No account creation, migration or delegation installation occurred in this research.

## Change and proof scope

Only the Plan Hub documents and generated brief/wireframes were revised. No runtime code, package manifest, lockfile, environment secret, account or Linear issue changed. All prior implementation lanes remain blocked pending reconciliation and ownership; this evidence is not a dispatch or production-readiness claim.
