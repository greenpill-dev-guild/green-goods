# Community Needs & Signals: Low-Fidelity Wireframes

**Feature Slug**: `community-interface`  
**Stage**: `active`  
**Updated**: 2026-07-27
**Companions**: `spec.md`, `diagrams.md`, `journeys.md`, `research-plan.md`.

These frames define information hierarchy, states, and recovery. They do not define visual styling. The member frames belong to the planned independent `packages/community` PWA at `community.greengoods.app` and `http://localhost:3010`, after the shared-foundation gate. Admin Need frames W9–W11 belong to the fifth `/community/needs` mode; W12 is the separately gated `/community/members` Manage Members state. Funder frames extend existing `packages/client` public garden, impact, and funding surfaces.

Implementation uses Warm Earth tokens, semantic landmarks and headings, persistent visible labels, logical focus order, visible focus, at least 44px touch targets, text plus icon/shape for state, AA contrast, one polite status announcer, limited assertive announcements, and reduced-motion behavior. Every string and state ships in en/es/pt.

## Surface ownership and state coverage

| Frame | Surface | Mode | Required states represented |
|---|---|---|---|
| W1–W8 | Community PWA | installed PWA and public browser | loading, empty, offline-stale, pending, `waiting_for_hat`, failed, retry, canceled, declined, merged, hidden, retracted |
| W9–W11 | Admin `/community/needs` | authenticated operator/evaluator | loading, empty, stale read, signature rejected, transaction failed, retry, partial-source, export blocked |
| W12 | Admin `/community/members` | authenticated operator | blocked gate; no queue data before RESR-64 clears |
| W13–W14 | Existing client public surfaces | public browser / funder | pending proof, unverified, verified attribution, duplicate ignored, funding failure, attribution failure, retry |
| State and recovery copy contract | all three surfaces | all applicable modes | plain-language names, role visibility, accessible status, and one safe recovery/exit per state |

### Delivery-mode differences

| Mode | Navigation and identity | Writes and offline behavior | Content boundary |
|---|---|---|---|
| Community installed PWA | Community-owned Needs / Create / Profile tabs, manifest, service-worker scope, telemetry, and copy | Full member draft queue; install/update/offline status from shared foundations | No pools, evaluator export, work submission, claiming, wallet drawer, or settlement |
| Community public browser | Community-owned browser navigation; browse works before account or install | First action returns to the exact Need after passkey/join; install remains optional | Global discovery is read-only outside the member’s garden |
| Admin `/community/needs` | Authenticated admin shell and fifth Needs mode | Online moderation and seeding | Gathering, operator triage, selected-Need inspector, Need lineage/export; pool/cycle operations stay in `/community/coordination` |
| Admin `/community/members` | Existing Manage Members mode | Membership actions only after the RESR-64 gate | No Need triage, seeding, lineage, or pool/cycle controls |
| Existing client public browser | Existing garden, impact, and funding navigation, manifest, telemetry, and copy | Existing funding writes plus optional attribution; no Community offline queue | Funder discovery/detail under existing public surfaces |

Client and Community may consume the same shared foundations, but their routes, navigation, manifests, service-worker scopes, telemetry identities, and application copy never merge.

## W1. Community PWA — Needs board

**Question**: Can a member understand the board, both state axes, and where to act without protocol vocabulary?  
**Source**: `spec.md` §§4, 8.

```text
┌──────────────────────────────────────────────┐
│ Rocinha Community Garden                    │
│ This season · promises and progress         │
├──────────────────────────────────────────────┤
│ Needs                             [Explore] │
│ [All] [Open] [Committed] [In progress]      │
│ [Addressed] [This month] [This season]      │
├──────────────────────────────────────────────┤
│ THIS MONTH · IN PROGRESS                     │
│ Elders need reliable market rides           │
│ Better: two rides each market day           │
│ Agro · Education · 8 support · 2 do not     │
│ Acknowledged · In progress                  │
│         [View] [Support] [Do not support]   │
├──────────────────────────────────────────────┤
│ THIS SEASON · OPEN                           │
│ Weekend work days lack a shared tool library│
│ No domain assigned · Open                   │
│         [View] [Support] [Do not support]   │
├──────────────────────────────────────────────┤
│    Needs          ＋ Create          Profile │
└──────────────────────────────────────────────┘
```

Rules:

- My garden is default; Explore is global read-only. Signal controls appear only for same-garden Community Hat members.
- Support and non-support counts remain separate; the interface never derives a net score. A selected direction has text/icon state beyond color, and `[Clear my signal]` replaces neither direction.
- Switching direction shows only the final intended state. Offline rapid changes collapse into one queued signal intent; clear cancels an unsent local intent or queues revocation of the current on-chain winner.
- Board order is recency + status, never funding. Empty domains render “No domain assigned.”
- Moderation and progress are separate labels. Status never relies on color.
- Hidden and retracted Needs do not appear. Merged cards redirect to the canonical Need. Declined cards appear only to their author and operators.

## W2. Community PWA — board source states

**Question**: Can loading, no results, stale offline data, and a failed source be distinguished?  
**Source**: `spec.md` §§4, 8, 13.

```text
LOADING                    EMPTY
┌────────────────────┐     ┌────────────────────┐
│ Needs              │     │ Needs              │
│ Loading this       │     │ No Needs yet.      │
│ garden's Needs…    │     │ Share what better  │
│ [stable card shapes]│    │ could look like.   │
└────────────────────┘     │ [Create a Need]    │
                           └────────────────────┘

OFFLINE-STALE              PARTIAL / RETRYABLE
┌────────────────────┐     ┌────────────────────┐
│ Offline             │     │ Some details did  │
│ Showing saved data  │     │ not load. Existing│
│ from 10:42.         │     │ Needs remain shown│
│ [Try again]         │     │ and labeled.      │
└────────────────────┘     │ [Try EAS again]    │
                           └────────────────────┘
```

A failed EAS or Envio source never renders as an empty list. Focus moves to the state heading only after an explicit user action; background refresh uses the polite announcer.

## W3. Create — describe the problem and capture words

**Question**: Can a member describe the problem in their own words using voice or text, without protocol or schema language?
**Source**: `spec.md` §§3, 5, 8.

```text
┌──────────────────────────────────────────────┐
│ Create                                1 of 3 │
│ What is your community trying to solve?     │
├──────────────────────────────────────────────┤
│ Describe the problem in your own words.      │
│ Requests and offers come later, when someone │
│ makes a commitment to address this Need.     │
│                                              │
│ Tell us what is happening                    │
│ [● Record]  or  [Type here…                ]│
│ Audio is kept · transcript can be edited    │
│ Recording 0:18              [Stop recording]│
├──────────────────────────────────────────────┤
│ [Save and leave]                 [Continue] │
└──────────────────────────────────────────────┘
```

There is no Need-kind choice. A Need captures a problem and desired outcome; Request / Offer is selected later as commitment direction. The recorder has a visible label, elapsed time, stop control, transcript or “audio only” label, permission-denied recovery, and typing fallback. No domain question appears during member creation.

## W4. Create — desired outcome, review, and queue state

**Question**: Does every Need include what better looks like, and can the member recover from offline, membership, or submission failure?  
**Source**: `spec.md` §§5–7.

```text
┌──────────────────────────────────────────────┐
│ Review                                3 of 3 │
│ THIS MONTH · NEED                            │
│ Elders need reliable market rides           │
│ Better: two rides each market day           │
│ Audio 0:42 · 2 photos                        │
├──────────────────────────────────────────────┤
│ Similar in your garden                       │
│ “Transport for clinic visits”       [View]  │
│ [Support this existing Need] [Share mine]   │
├──────────────────────────────────────────────┤
│ SAVED ON THIS DEVICE                         │
│ Waiting for garden membership. No send      │
│ attempts have been used.                    │
│ [About membership] [Edit] [Cancel] [Delete]│
├──────────────────────────────────────────────┤
│ [Share with my garden]                       │
└──────────────────────────────────────────────┘
```

Queue messages by state:

- `offline-queued`: “Saved on this device. It will send when you are online.”
- `waiting_for_hat`: “Waiting for garden membership. Your five send attempts remain.”
- retryable failure: retain draft and media; name the failed step; offer Retry and Edit.
- transcription failure: retain audio and allow audio-only submission.
- terminal cancellation, deleted draft, rejected join, or revoked/expired account: remove the optimistic board card and explain the next safe action.

The similar-Need prompt is advisory and never blocks authorship.

## W5. Need detail — two axes and evidence lineage

**Question**: Can a member follow Need → promise → work → proof while distinguishing community narrative from verified protocol evidence?  
**Source**: `spec.md` §§4, 8, 11.

```text
┌──────────────────────────────────────────────┐
│ ← Elders need reliable market rides          │
│ THIS MONTH                                   │
│ Moderation: Acknowledged                     │
│ Progress: In progress                        │
│ Agro · Education · 8 support · 2 do not     │
├──────────────────────────────────────────────┤
│ Your neighbor's words                        │
│ “Market days are hard for elders…” [▶ audio]│
│ Better: two rides each market day           │
├──────────────────────────────────────────────┤
│ What followed                                │
│ ✓ Need acknowledged                         │
│ ✓ Promise: 16 market rides this season      │
│ ● Work: 6 rides approved                    │
│ ○ Assessment and eligible confirmation      │
│ ○ Fulfillment and community testimony       │
├──────────────────────────────────────────────┤
│ Funding context                              │
│ 120 G$ funding attribution verified         │
│ Funding supports the garden; it is not escrow│
├──────────────────────────────────────────────┤
│ [Support] [Do not support] [Clear my signal]│
│                              [Add testimony]│
└──────────────────────────────────────────────┘
```

This line is FundingAttribution verification, not commitment reward settlement. Reported and oracle-verified G$ settlement language belongs to the commitment experience and is never inferred from a FundingAttribution.

Signal recovery copy is explicit: queued direction (“Saved on this device — Support will send when you are back online”), queued clear (“Your signal will clear when you are back online”), rejected signature (“Your signal did not change”), resolver/membership failure with Retry, and successful switch/clear announced through the polite status region. The selected state overlays the latest queued intent so an older on-chain direction never flashes as current.

## W6. Profile — drafts, membership, confirmations, and testimony

**Question**: Where does a member recover pending work and act on an eligible confirmation?  
**Source**: `spec.md` §§5, 7–8.

```text
┌──────────────────────────────────────────────┐
│ Profile                                      │
├──────────────────────────────────────────────┤
│ Garden membership                            │
│ Rocinha · Waiting for operator approval     │
│ [How this works] [Cancel request]*           │
├──────────────────────────────────────────────┤
│ Saved and sending                            │
│ Need · Waiting for membership       [Edit]  │
│ Signal · Offline                    [Retry] │
│ Testimony · Upload failed            [Retry]│
├──────────────────────────────────────────────┤
│ Needs your confirmation                      │
│ Market rides · work is ready to review      │
│ You are the eligible Request creator        │
│ [Review evidence] [Confirm fulfillment]     │
├──────────────────────────────────────────────┤
│ Your activity                                │
│ Needs · signals · testimony                 │
└──────────────────────────────────────────────┘
```

`* Cancel request` is shown only after RESR-64 locks a transport with a defined cancellation API. A provider never receives a self-confirm CTA, including steward fallback. If the signed-in account is not eligible, show “Confirmation must come from the named eligible member or group” with no disabled action that implies future eligibility.

## W7. First action — passkey and decision-gated join

**Question**: Can a visitor browse first, understand the wait, and return to the exact action?  
**Source**: `spec.md` §7; `research-plan.md` join decision.

```text
┌──────────────────────────────────────────────┐
│ Join Rocinha Community Garden               │
│ You can keep browsing without joining.      │
├──────────────────────────────────────────────┤
│ 1  Create or recover your passkey account   │
│ 2  Ask the garden operator to add you       │
│ 3  Your saved action sends after approval   │
│                                              │
│ [Continue with passkey]  [Keep browsing]    │
│                                              │
│ Who receives the request, what is stored,   │
│ how to cancel, and when it is deleted must  │
│ appear here after the RESR-64 decision.     │
└──────────────────────────────────────────────┘
```

Authentication recovery variants preserve the original route and unsent action:

```text
PASSKEY CANCELED / UNAVAILABLE          EXISTING-ACCOUNT RECOVERY FAILED
┌──────────────────────────────────┐    ┌──────────────────────────────────┐
│ Nothing was sent.               │    │ We could not recover your       │
│ Your saved action is still here.│    │ existing account. No new account│
│ [Try passkey again]             │    │ or join request was created.    │
│ [Keep browsing]                 │    │ [Try recovery again] [Browse]  │
└──────────────────────────────────┘    └──────────────────────────────────┘
```

Cancellation returns focus to the invoking action. Unsupported/unavailable authenticators use the existing shared passkey capability and recovery guidance; this plan does not invent a password fallback. A failed recovery never silently creates a second account. After successful creation or recovery, the app returns to the exact garden/Need/action deep link and only then proceeds to the separately gated join step. Errors focus a concise named summary and retain the local product write.

Until the RESR-64 engagement-model decision is linked and accepted, the join submission and admin membership queue are blocked. Public on-chain requests, Linear-as-queue, and implicit localStorage are not alternatives.

## W8. Moderation outcomes and author retraction

**Question**: What does each restricted or redirected state show, and to whom?  
**Source**: `spec.md` §4.

```text
MERGED — ANY ALLOWED READER       DECLINED — AUTHOR / OPERATOR
┌──────────────────────────┐      ┌──────────────────────────┐
│ This Need was combined   │      │ Not included on the board│
│ with a clearer record.   │      │ Operator rationale: …    │
│ [Open canonical Need]    │      │ [Ask operator]            │
└──────────────────────────┘      └──────────────────────────┘

HIDDEN — OPERATOR ONLY            RETRACTED WITH LINEAGE
┌──────────────────────────┐      ┌──────────────────────────┐
│ Hidden from public views │      │ Withdrawn by author       │
│ Rationale: …             │      │ Reference: 0x…            │
│ [Reopen with rationale]  │      │ Words and media removed.  │
└──────────────────────────┘      │ Linked evidence remains.  │
                                  └──────────────────────────┘
```

Hidden Needs have no public placeholder. Declined Needs have no public card. A retracted Need has no board card and exposes only the content-free tombstone where immutable lineage requires it. An operator may reopen merged, hidden, or declined by writing a later acknowledged NeedStatus with a mandatory rationale.

## W9. Admin `/community/needs` — gathering and triage

**Question**: Can an operator prepare a gathering and write a typed moderation decision with recovery?  
**Source**: `spec.md` §9.

```text
┌──────────────────────────────────────────────────────────────┐
│ Community / For the gathering                               │
│ [Fresh Needs] [Confirmations] [Recent changes] [Print]      │
├──────────────────────────────────────────────────────────────┤
│ WEEK · Moderation: none · Progress: open                    │
│ Water is pooling beside the school path                     │
│ Better: the path stays passable after rain                  │
│ Domains [Waste ×] [＋ Add domain]                            │
│ [Acknowledge] [Merge…] [Decline…] [Hide…]                  │
│                                                              │
│ Saving status…                                               │
│ Signature rejected. Nothing changed. [Try again] [Edit]     │
├──────────────────────────────────────────────────────────────┤
│ SEASON · Acknowledged · Open                                │
│ Weekend work days lack a shared tool library                │
│ No domain assigned                     [Seed a commitment]  │
└──────────────────────────────────────────────────────────────┘
```

Merge uses a typed same-garden canonical-Need picker for `mergedIntoNeedUID` and a separate rationale field for `noteCID`. Reopen is labeled explicitly and requires rationale. Online NeedStatus writes expose loading, rejected signature, transaction failure, stale read, success, and Retry.

## W10. Admin `/community/needs` — seed a commitment

**Question**: Which fields are merely suggested from the Need, and which must the operator confirm?  
**Source**: `spec.md` §§9, 11; Commitment Pooling `contract-spec.md`.

```text
┌──────────────────────────────────────────────────────────────┐
│ Community / Seed commitment                                 │
│ From Need: Water beside the school path                     │
├──────────────────────────────────────────────────────────────┤
│ Need UID              [0x91…]  linked, read-only            │
│ Pool / cycle          [Choose…]                             │
│ Offer or Request      [Choose…]                             │
│ Provider / beneficiary[Choose…]                             │
│ Units and target      [________] [________]                  │
│ Domains suggested    [Waste ×] [＋ Add]                     │
│ Required actions     [Action for Waste ▾]                   │
│ Evidence / assessment[____________________]                  │
│ Confirmer rule       [____________________]                  │
│ Reward / source      [____________________]                  │
│ Timing               [____________________]                  │
├──────────────────────────────────────────────────────────────┤
│ Suggestions are not saved until you review every field.     │
│ [Cancel]                       [Review commitment]           │
└──────────────────────────────────────────────────────────────┘
```

Domains are optional arrays; DomainImpact requires one registered, domain-matching action per domain. Action UID `0` remains valid. A Request defaults to its creator/Need author as confirmer; an Offer waits for its accepted recipient. The accepted provider is excluded, and the operator sees an unreachable-threshold error before acceptance.

## W11. Admin `/community/needs` — evaluator lineage and export

**Question**: Can an evaluator trace evidence and avoid exporting an incomplete or privacy-unsafe graph?  
**Source**: `spec.md` §§9, 11.

```text
┌──────────────────────────────────────────────────────────────┐
│ Community / Evaluator lineage                               │
│ Need 0x91… · Acknowledged · Addressed                       │
├──────────────────────────────────────────────────────────────┤
│ Need ─ Commitment ─ Work ─ Approval ─ Assessment            │
│                         └ Testimony ─ Cycle ─ Hypercert      │
│ Each node: source, UID/composite ID, state, timestamp       │
│ Funding proof: verified · direct rail · source link         │
├──────────────────────────────────────────────────────────────┤
│ Source health                                                │
│ ✓ EAS complete  ✓ Envio complete  ✓ Funding proof complete │
│ [Export CSV] [Export JSON]                                  │
└──────────────────────────────────────────────────────────────┘

PARTIAL SOURCE
┌──────────────────────────────────────────────────────────────┐
│ Envio lineage did not load. Export is blocked so evidence   │
│ is not mistaken for complete. [Retry Envio]                 │
└──────────────────────────────────────────────────────────────┘
```

CSV emits one lineage edge per row; JSON nests edges. Retraction yields only the withdrawn tombstone. Text/media CIDs require existing viewer access. Wallet addresses, join identities, and research contacts never export.

## W12. Admin `/community/members` — Manage Members queue gate

**Question**: What may be designed now without pretending join-request storage is decided?  
**Source**: `spec.md` §§7, 9; `research-plan.md`.

```text
┌──────────────────────────────────────────────────────────────┐
│ Community / Membership                                      │
├──────────────────────────────────────────────────────────────┤
│ BLOCKED — RESR-64 decision due 2026-08-12                   │
│                                                              │
│ No queue data is collected or displayed until the selected  │
│ model defines controller, auth, encrypted fields, retention, │
│ deletion, cancellation, recovery, abuse controls, cost,     │
│ incident owner, and shared-operator handoff.                 │
│                                                              │
│ [Open decision record]                                      │
└──────────────────────────────────────────────────────────────┘
```

This is a gate artifact, not a placeholder implementation. It becomes a queue frame only after the signed decision record supplies its actual fields, actions, empty/error states, and operating owner.

## W13. Existing client — funder discovery and detail

**Question**: Can a funder discover and support work without rankings, steering, or escrow?  
**Source**: `spec.md` §10.

```text
┌──────────────────────────────────────────────────────────────┐
│ Rocinha Garden / Community-led work                         │
│ [Garden ▾] [Domain ▾] [Progress ▾]                         │
│ [Horizon ▾] [Status ▾]   Order: Recent activity            │
├──────────────────────────────────────────────────────────────┤
│ IN PROGRESS                                                  │
│ Reliable market rides for elders                            │
│ Promise: 16 rides · 6 approved · community testimony       │
│                                               [Read story]  │
├──────────────────────────────────────────────────────────────┤
│ Need detail                                                  │
│ Funding attribution verified: 120 G$                        │
│ [Donate] [Support through an endowment]                     │
│ Funds support the garden. This is not per-Need escrow and   │
│ does not direct allocation.                                 │
└──────────────────────────────────────────────────────────────┘
```

This view belongs inside existing client public garden/impact/funding surfaces. Funding never becomes a filter or sort. Small-community thresholds and aggregate-only disclosure remain active.

## W14. Existing client — funding and attribution failure

**Question**: Can the funder tell whether funding failed, attribution failed, or proof is still pending without replaying money?  
**Source**: `spec.md` §10.

```text
FUNDING FAILED                         FUNDING SUCCEEDED; ATTRIBUTION FAILED
┌──────────────────────────────┐       ┌──────────────────────────────────┐
│ Funding was not sent.        │       │ Your funding was confirmed.     │
│ No attribution was created.  │       │ We could not attach it to this  │
│ [Try funding again]          │       │ Need. Do not send funds again.  │
└──────────────────────────────┘       │ [Retry attribution] [Not now]   │
                                       └──────────────────────────────────┘

PROOF PENDING / UNVERIFIED             VERIFIED DUPLICATE
┌──────────────────────────────┐       ┌──────────────────────────────────┐
│ Funding confirmed. Receipt   │       │ This receipt is already counted │
│ proof is still checking and  │       │ through the earliest valid      │
│ contributes 0 for now.       │       │ attribution. No total changed.  │
│ [Check again]                │       │ [View canonical record]          │
└──────────────────────────────┘       └──────────────────────────────────┘
```

Verification requires a supported chain and finalized successful canonical receipt matching contract/event, garden, token, and amount. Global de-duplication uses `(chainId, txHash, rail)` across all Needs; the lowest `(timeCreated, uid)` is canonical and every later attribution contributes zero.

## State and recovery copy contract

| State | Plain-language presentation | Recovery / exit |
|---|---|---|
| loading | Name the source or object being loaded; preserve stable layout | Automatic completion; no focus theft |
| empty | State that no matching Needs exist, not that a source returned nothing | Clear filters or Create |
| offline-stale | Label saved-data timestamp | Retry when connected; drafts remain editable |
| pending | Name the active step: upload, sponsorship, signature, receipt proof | Wait or safely cancel where supported |
| `waiting_for_hat` | Membership pending; zero retries consumed | Review membership info; Edit/Cancel/Delete saved product write |
| declined | Author/operator only; show rationale | Ask operator; operator may reopen with rationale |
| merged | Redirect and name canonical record | Open canonical Need |
| hidden | Operator-only with rationale | Reopen with rationale |
| retracted | No board/detail content; lineage tombstone only | No restore promise; protocol references remain |
| transaction failed | State that nothing changed | Retry online action |
| attribution failed | State funding succeeded and must not be replayed | Retry attribution only |
| proof unverified | Contributes zero; name why when safe | Check again or correct attribution |
| partial source | Keep known data labeled; block export | Retry the named source |

## Accessibility and translation acceptance

- Landmarks, headings, lists, form labels, recorder controls, dialogs, tabs, filters, and status announcements have accessible names that make sense without surrounding visuals.
- Focus order follows reading order; dialog focus returns to the trigger; failed submissions focus the error summary; card actions remain at least 44px.
- Text, icon/shape, and accessible state name communicate moderation/progress; contrast and visible focus meet WCAG AA; animations respect reduced motion.
- Audio always has a transcript, captions, or an explicit “audio only” label. Recording never times out.
- All Needs/Create/Profile, offline, membership, moderation, export, and funding strings exist in en/es/pt and pass the shared coverage gate plus `bun run lint:vocab`.
