# Impact integrations, starting with Certified approval publishing

**Slug:** `certified-approval-publishing`  
**Stage:** backlog  
**Created:** 2026-10-15  
**Owner:** implementation owner to be assigned; planning tracked in PR #640

## Problem

Stewards repeat the same approved work and evidence across reporting platforms. Green Goods
needs a reliable way to reuse that evidence under each platform's own project and review
structure while preserving the source decision, attribution, consent and publishing authority.

## Desired outcome

A steward links an existing Certified identity, selects an existing external project for an
authorized Garden, previews a report, and publishes a confirmed work approval. The result carries
source provenance and clear status: approval confirmed, Certified publication complete, and
Ma Earth visibility verified or pending. Later, a Garden can explicitly enable a bounded automatic
policy once recovery, correction and privacy behavior are proven.

## Scope

First: Certified/Ma Earth account linking, Garden destination authority, previewed approval
publication, historical sync preview, durable recovery, comparison/repair and receipts. Then:
supervised pilot and opt-in automation. Keep the observed assessment, evaluator judgment and
planning content distinct; only the judgment is a candidate Hypercerts evaluation.
GainForest/Bumicerts, Bloom Network, Silvi and Regen Network remain research tracks under
[RESR-102](https://linear.app/greenpill-dev-guild/issue/RESR-102). Their provider mappings and possible
pilots inform research; any pilot or Product implementation needs a separate explicit acceptance. The architecture now maps
Garden creation, initial assessment, Season/Campaign creation, commitment creation, Work
submission/approval, commitment fulfillment, delta assessment and certificate minting. Only
approval publishing is an initial public trigger; the remaining triggers need accepted scope.

Provider-specific architectures now cover all four later platforms. A separately scoped social
track adds user-driven X/LinkedIn/Facebook sharing and deterministic impact report exports; it
can proceed after public-data gates without waiting for partner grants. Reusable capability-based
modules share delivery mechanics while retaining native schemas, review and correction semantics.

New DIDs/PDS hosting, new group provisioning, token minting, credit issuance, contract changes,
Envio EAS indexing, a speculative plugin/event-bus framework and public disclosure of private research
notes are outside this plan. The planning PR changes documentation only.

## Success signal

One confirmed approval produces one intended external report in the correct existing project,
with evidence, reviewer attribution and actual Ma Earth visibility. Closing the browser,
replaying events, or losing a response creates neither silent loss nor a duplicate logical record.
Revoking the publishing grant stops future sends without altering Green Goods approval history.
