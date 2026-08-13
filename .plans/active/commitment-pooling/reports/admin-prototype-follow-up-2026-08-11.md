# Admin console prototype follow-up (2026-08-11 correction pass)

Recorded during the client-PWA correction pass (register #101 / Decision Log #63). The client
audit's root causes appear admin-side too, in milder form. **Nothing here was fixed this pass —
client-only scope was an explicit decision (D8b).** Work these when the admin surface gets its
own polish pass, against the same uiux Appendix B addenda.

## Findings

1. **W8 (steward seeding wizard) should become a cast of the corrected composer.** It predates
   the entry-fixed composer: five numbered steps, kv-dense review, and its own chrome. The same
   shell (what → how much → proof → sectioned review, Advanced detour) fits seeding with the
   steward-only extras (step 0 member/kind capture for W9, cycle allocation hand-off to W11).
2. **W10 (commitment console detail) has the same kv-density problem the client review had.**
   Nineteen states of stacked label/value rows; the sectioned-anatomy treatment (grouped cards,
   edit affordances where legal) would make dispute/override/payout surfaces scannable.
3. **sb9c is still a 17-scene ribbon.** It was split once (sb9 → 9a/9b/9c) but "End a season —
   close, compost, or cancel" still concatenates close, compost, reopen, and cancel. Split at
   the act seam: end-season review/compost vs close/compost pool vs cancel-with-reason.
4. **Mid-surface starts remain in admin journeys.** sb50 opens at `W14@delta`, sb17 at
   `W10@accepted`, sb10 at `W8@step4`. The client now enforces drawn home surfaces
   (`ALLOWED_ENTRY` in `hifi/validate.ts`); tightening the admin allowed set to true console
   homes (W7/W12/W13/W21/W22/W24 + HUBWORK) and redrawing those three entries would match.
5. **Stacked full-width buttons exist in admin sheet/dialog states.** The one-row bar rule is
   currently enforced only on `.fbar` (phone flows). Desktop admin dialogs stack action buttons
   in several confirm states; decide whether the M3 dialog action-row convention (trailing
   horizontal actions) should be validator-checked the same way.
6. **Admin browse rows predate the D5 card contract.** W7's commitments table and W13's queue
   rows don't carry creator identity consistently; the client's by-line + one-action rule has an
   admin analog (row anatomy: who · what · state · one primary act).
7. **Vocabulary sweep.** Admin copy is steward-facing so "promise" density matters less, but W8
   and W9 still mix "offer/request/promise" mid-flow; apply the D3 rule (promise = record; acts
   use direction verbs) in the next admin copy pass.

## Already consistent

The echo system, chapter structure, reason-taking confirmations, and blast-radius naming are in
good shape admin-side; the settlement consoles (W21/W22/W24) follow their spec closely and need
no structural change from this audit.
