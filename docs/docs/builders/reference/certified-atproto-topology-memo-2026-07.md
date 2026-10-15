---
title: "Certified publishing: identity and topology decision"
sidebar_label: Certified identity decision (proposed)
slug: /builders/specs/certified-atproto-topology-memo-2026-07
audience: developer
owner: docs
last_verified: 2026-10-15
feature_status: Planned
source_of_truth:
  - docs/docs/builders/reference/certified-atproto-integration-spec-2026-07.md
---

# Certified identity and publishing topology

**Proposed decision, 2026-10-15:** use an existing Certified identity and project, with delegated
publishing from the Green Goods Agent runtime. Keep account linking, Garden authority, and the
external publishing grant separate. The [architecture](./certified-atproto-integration-spec-2026-07.md)
contains the diagrams, data model, recovery rules, and unresolved gates D1–D9.

## Why the July design changes

The July proposal kept all PDS writes in the browser and used the client job queue as the mirror
trigger. The requested experience now needs durable delivery after a steward approves work,
including direct-wallet and batch paths and periods when the browser is closed. A server source
reconciler covers those paths without weakening the existing onchain retry safeguards.

The July v1.1.0 schema/npm availability finding is historical. The current candidate schema is
the v1.5.1 tag, while some upstream reference pages still describe v1.4.1. Implementation must pin
and test the exact approved version against deployed services; neither an old package blocker nor
unversioned documentation proves current compatibility.

## Compare the viable shapes

| Shape | What it makes possible | Cost or limitation | Decision |
|---|---|---|---|
| Browser OAuth writes to a personal repo | Foreground, user-present publication without retained server grant | Requires browser/session availability; does not cover unattended approval delivery by itself | Alternative only if background group authority is unavailable and product scope is explicitly narrowed |
| Agent backend with delegated existing CGS group/project | Durable publishing, per-Garden routing, recovery and receipts independent of browser lifetime | Requires credential custody, tested group permissions, conditional writes and operational ownership | Recommended, gated by D1–D9 |
| Green Goods provisions its own DIDs/PDS or new groups | More control over identity and hosting | Adds recovery, governance, migration and custody responsibilities beyond account linking | Deferred |

This is one module in the existing Agent deployment, with one concrete Certified adapter. We do
not need a separate integration platform, universal impact schema, or new transaction sender.
Additional platforms should earn their own mappings after their APIs and domain rules are known.

## Identity and authority rules

1. A Green Goods account remains the existing chain-scoped wallet, passkey, or embedded account.
   Certified is an additional linked identity, not a replacement login mode.
2. OAuth proves control of the external personal DID. A nonce-bound Green Goods account proof
   binds the exact DID, account, chain, action, audience and expiry. Account switching invalidates
   unfinished linking. Both proofs are required.
3. A Garden destination names an external repository DID and project collection URI. It is not
   inferred from a matching name, email, handle, wallet address, or existing personal link.
4. A Green Goods steward's ability to approve work does not automatically grant Garden integration
   management. Phase 0 must select and verify the role permitted to create/revoke destination bindings.
5. The external group role and delegated background grant authorize external writes. Recheck them
   and the Green Goods binding authority before dispatch. Account-link status alone is insufficient.
6. A reviewer DID is named only with verified attribution and consent. A group publishing that DID
   is still making an authorship claim; it is not equivalent to a signature by the reviewer.
7. Disconnect revokes future use and cancels unsent work. It cannot guarantee erasure of public
   replicated records or undo an already committed external request.

The application-level account association supports a path toward smart accounts. It does not
claim the native `app.certified.link.evm` proof supports ERC-1271/6492 today. Test the Green Goods
account verifier independently and avoid a misleading native wallet-verification badge.

## Custody is a separate decision

The [CGS integration guide](https://github.com/hypercerts-org/certified-group-service/blob/main/docs/integration-guide.md)
distinguishes groups registered by CGS from existing PDS accounts imported into it. CGS may hold
the main password and recovery key of a newly registered account; the CGS owner role alone does
not establish PDS custody. Imported accounts retain their existing account-control arrangement.
Do not promise full account transfer or portable recovery without verifying that arrangement.

The first pilot selects an existing configured group and project. Provisioning new group accounts,
changing DID governance, recovery transfers, platform-issued DIDs, and PDS hosting are excluded.
The backend stores only the delegated authority required for the chosen flow, encrypted and
revocable. A browser, service worker, or shared job payload never receives that grant.

## Meaning of the external records

A project collection groups work activities. An evaluation describes a particular steward's
review of an exact activity version; attachments carry the permitted evidence and source
provenance. The publisher states that it is a Green Goods review and describes its relationship
to the project. Confidence is not an outcome measurement. None of these records alone mints
credits, establishes an independent ecological assessment, or guarantees Ma Earth display.

Published receipts carry the actual URI and CID. Ma Earth visibility has a separate acceptance
test and status. Corrections require explicit downstream semantics: a later evaluation is not
automatically a protocol-level replacement for an earlier one.

## Rollout decisions

Begin with verified linking and read-only project selection. Next add explicit per-report preview
and publication into an approved test project. Prove Ma Earth display, attribution, corrections,
revocation and uncertain-delivery recovery in a supervised pilot. Enable standing automatic
publication only after those gates pass. Bloom, Silvi and Regen remain later, independently gated
work rather than assumptions inside the Certified implementation.

The implementation Plan Hub remains in backlog. This PR updates the architecture and plan;
runtime implementation and production publication have not been approved or performed by it.
