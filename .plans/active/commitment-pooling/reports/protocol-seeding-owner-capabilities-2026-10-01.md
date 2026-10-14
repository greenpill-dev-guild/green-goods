# PR 968 remaining authority and recovery feedback

At live head `485e87167206167ff744416abd0f38ef5c336415`, the remaining
P1 (`4151988681`) and two related P2s (`4151988689`, `4151988692`) were
confirmed against the prototype and its owning contract/queue rules.

The module-owner branch now separates service creation, claim management, and
confirmation permissions. An owner without root-garden membership retains
Accept/Decline while service seeding and confirmation detail stay blocked.
`requirePoolSteward` permits owner claim management; `resolveCreator` still requires
membership for service creation; module ownership grants no confirmation authority.

Revoked root-garden authority shows `NotPoolSteward`. A separate owner membership
failure shows `UnauthorizedCaller`. Both Request and Offer retain recoverable pool
rows for those terminal states. Timeout copy now describes an unknown outcome and
creator/key reconciliation before retry, preserving the existing identity.

The bounded sweep covered W12, its actions, required-state validator, acceptance
check, and coverage projection. Contract CreationChecksLib/GuardLib/ConfirmLib,
Shared commitment job-executor, and bundling-sender were read as authority sources;
production code is unchanged. The seven previously resolved threads remain closed.

Complete feedback retrieval returned ten threads, 17 inline comments including
replies, nine reviews, and two informational conversation comments. REST collections
used page size 100 and returned fewer entries; no additional pages remained.

Verification:

- RED: added owner capability assertions failed against the exact previous head
  because its confirmation-detail hotspot was still present.
- GREEN: `bun .plans/active/commitment-pooling/hifi/protocol-seeding.check.ts` passed
  positive assertions and 58 negative mutations, including owner claim controls,
  forbidden owner confirmation, both error causes, and unknown timeout outcomes.
- `bun .plans/active/commitment-pooling/prototypes-artifact.build.ts` passed with
  44 screens, 564 states, 790 hotspots, 56 journeys, 336 scenes, zero warnings.
- Rendered proof: **Brave localhost static prototype**, 2026-10-01. Owner Accept
  and Decline are visible with no Seed or actionable confirmation queue. Distinct
  NotPoolSteward/UnauthorizedCaller overlays and Offer timeout reconciliation were
  inspected. Local screenshot: `/tmp/prd-812-preview/owner-capabilities.png`.
  No live signing or on-chain proof is claimed.

Publication uses the verified temporary checkout at the exact PR head because the
original worktree Git metadata is read-only. Connector publication must match the
locally tested blob/tree SHAs. Push/merge gates and current-head CI are recorded
with publication; this report does not claim future checks have passed.
