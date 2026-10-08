# Steward Access Requests Specification

## User-approved interaction

Request Steward Access is a labeled action below No garden access yet and in Profile. Desktop uses AdminDialog; mobile uses its full-width bottom-sheet presentation. Choose a known garden by name or valid Green Goods link/address, review the garden and primary account address, optionally add a note, then send a signed request. Pending state survives dialog dismissal in the account/chain session and supports viewing and withdrawal. Status checks that require a fresh signature are explicit actions.

User corrections, 2026-10-08: selection, review and status keep the same surface height within each viewport, with a stable target row and footer region. Desktop uses a shorter 75dvh surface capped at 42rem; mobile retains 90dvh. The garden search stays above a list that fills the remaining scroll area, without a 256px cap. Use the client PWA's continuous solid background and compact step-action row: a single action fills the mobile row, paired actions share it, and desktop actions align right. Evidence must show garden selection on mobile as well as the other flow states.

## Domain and authority

Steward maps to deployed Operator; Owner is a stronger existing access role. Existing gardeners may request stewardship, including in open-joining gardens. Existing stewards/owners receive already_steward. Request creation never grants a role. An authorized owner/steward reviews the queue and uses the existing addSteward operation. The API resolves a steward request only after operator/owner membership is confirmed on chain; gardener membership alone leaves it pending. Decline and withdraw retain nonce, revision, expiry and identity checks.

## Backward compatibility and privacy

The default kind remains garden_membership. Omitted proof kind preserves legacy signed message bytes. Explicit steward_access is signed into every operation and checked against the body, query scope and stored record. Membership requestedVia remains garden_detail; stewardship uses admin_access or account_profile. Mine/list requests, duplicate keys and private client caches are kind-separated. Retain encryption, CORS, rate limiting, combined per-garden queue capacity and retention. Availability advertises supportedKinds; an old enabled service supports membership only. SQLite replaces the pending uniqueness index with a kind-aware index without losing encrypted rows. No signatures, notes or private requests enter URLs, browser persistence, telemetry or public fixtures.

## Reuse and capability ownership

- [Existing request hook](../../../packages/shared/src/hooks/garden/useGardenJoinRequests.ts) owns signing and private request lifecycle; its gap is an explicit requested role and kind-separated scope.
- [Agent service](../../../packages/agent/src/services/garden-join-requests.ts) owns encrypted records; [chain reader](../../../packages/agent/src/services/garden-join-requests-chain.ts) must distinguish requested target role from generic membership.
- [No-access state](../../../packages/admin/src/components/Layout/CanvasGardenAccessState.tsx) and [Profile](../../../packages/admin/src/components/Layout/AccountProfilePanel.tsx) own entry actions. A Shared admin-ui controller owns catalog selection and presentation orchestration. It never selects an ineligible garden as the active workspace.
- [Community review](../../../packages/admin/src/views/Community/components/CommunityJoinRequests.tsx) owns queue presentation and existing role mutation calls; extend it with a distinct stewardship section and preserve addGardener for membership.

## Acceptance boundaries

Legacy membership signatures/requests keep their behavior. A tampered kind fails authorization. A gardener can request stewardship but does not fulfill it. Two kinds may have separate pending requests for the same account and garden. An unauthorized actor cannot read or review private requests. Changed account/chain/auth mode cannot reveal or mutate previous scope. Failed or cancelled signing and assignment retain pending state and show recoverable status. Old/unavailable APIs offer address-sharing fallback.
