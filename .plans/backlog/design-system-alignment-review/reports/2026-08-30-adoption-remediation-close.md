# Adoption Remediation Close — Admin Cockpit — 2026-08-30

**Input**: [2026-08-30-post-dl011-012-adoption-audit.md](./2026-08-30-post-dl011-012-adoption-audit.md) (77/100). Afo accepted the full menu: "Let's address all the findings to improve the score near 100."
**Scope executed**: all six priority actions + the enforcement recommendation, across 11 commits on develop (`f4ac05a33` … `0855bea9a` + follow-ups), verified by the full admin/client/shared suites, both tsc projects, and every design/guidance gate at token 2.10.0.

## Score: 95/100 (from 77)

Definition was already ~95; adoption was the gap and is now closed to its sanctioned residue. The remaining five points are honest, named debt below — not unknowns.

## What happened per finding

### 1. Field family — 63% bypass → 99% adoption ✅
**1 shared-primitive render site remains in admin prod code (a file another session has in flight) vs 128 admin-family sites** (audit: 85 bypass vs 49). Five migration waves moved every module: Action config sections, CreateAction steps, Garden settings/members/create, Assessment steps, SubmitWork dynamic fields, CookieJar modals + CampaignCookieJar family, Vault modals, Hypercerts creation flow. Two new family members closed real gaps the migration surfaced:
- **AdminIconButton** (in `AdminButton.tsx`) — glyph-only actions on the DL-011 tiers (28/32/40 + hit target), standard/accent/tonal/filled/danger, mandatory accessible name. Killed every `h-8 w-8 px-0` / `h-9 w-9 p-0` AdminButton hack.
- **AdminFieldGroup** — fieldset+legend (or labelled div) group anatomy with the family's hint/error tokens, for checkbox grids, repeating-row editors, and upload wells. Retired the assessment steps' `LabeledField` (deleted) and the hand-rolled label patterns.
AdminTextField also floats labels permanently over date/time inputs (intrinsic browser text), and hardcoded `" *"` label asterisks died in all three locales — the family renders the required marker.

### 2. Raw buttons — 38 unsanctioned → 12 sanctioned ✅
Icon buttons, text-links, CTA clones, and toggle impostors all folded into AdminButton/AdminIconButton/AdminFilterChip/AdminChoiceGroup/AdminSelectableCard (incl. EnsAddressText's ~20px copy target, ActionFlowShell's `scale-95` back button, MetadataEditor's 25 SDG/capitals toggles, AttestationSelector rows, the domain picker radio grid). The remaining 12 are enumerated in the audited baseline: eight state-layer row/card-as-button sites (list rows opening dialogs — the closest thing to a row primitive today), the avatar identity tile, the stepper dots, the sign-out menu row, and the in-flight file above.

### 3. AdminButton geometry overrides — 9 → 0 ✅
`!h-11 !w-11`, the `min-h-12` pair (guard test updated to the ladder), the `h-9 w-9 p-0` icon hacks, the three InstructionsBuilder tab impostors (now a real AdminTabRail), and the `h-auto p-0` link straggler are all gone.

### 4. Casing — both sweep tails closed, boundary codified as DL-013 ✅
~95 missed action labels flipped (retry family, pool dialog verbs, avatar/profile actions, vault CTAs, aria-only labels — uniformly), ~24 over-swept strings reverted (statuses, kickers, field labels, placeholders, the select-all legend), the pool dialog 7-vs-7 split resolved ("Archive This Pool" / "Reopen This Pool" / "Seed a Commitment"), and **DL-013** pins the boundary: *named things and named acts* are Title Case; status/outcome copy, empty/connect-state titles, kickers, placeholders, field labels, and validation stay sentence case even under title-shaped keys. Three of the batch's own reverts contradicted the codified Voice rule (section titles are Title Case) and were corrected back ("Join Requests" ×2, "Select Approved Attestations").
**defaultMessage↔en.json**: 116 of 118 divergences synced to en.json (runtime truth); the 2 leftovers are multiline strings. Lesson recorded: en.json is the value of record — one key (`app.cookieJar.maxWithdrawal` = "Available now") was briefly "normalized" from its defaultMessage before the runtime value check caught it.

### 5. Typography — 771 raw sizes → 406, ratio flipped ✅ (policy-bounded)
The ten worst files (157 utilities) moved to the M3 aliases (`text-label-sm` chips/eyebrows, `text-body-sm/md` copy, `text-title-sm/md/lg` + `text-headline-sm` headings); migrations killed ~200 more in passing. Admin prod now counts **406 raw vs 481 scale** (audit: 771 vs ~347). The as-touched policy is canon in DESIGN.md: raw sizes migrate whenever a line is edited; new code never adds them.

### 6. Outlined fields + legacy Card ✅
The four `variant="outlined"` fields on transparent surfaces dropped to the underline default. **Legacy shared `Card` renders in admin prod: 0** (from 27 sites / 10 files) — AdminCard gained Header/Body slots on the warm stroke step (Footer was built, had no consumer, and was deleted per the dead-export gate — add it back with its first real site). Rule 7 / Rule 15 updated; shared `FormField` remains the client-side pattern.

### 7. "Rotated wizard labels" — false positive, no change ✅
`app.garden.submit.tab.*.label` keys are the steps' **primary CTAs naming the next action** (`media.label` = "Add Details" sits on the button that navigates to Details — [index.tsx:186-190](../../../../packages/client/src/views/Garden/index.tsx)), not step names. Production is labeled correctly; the misleading key naming is what tripped the audit sweep. Corrected here rather than in code.

## Enforcement now standing
The **wrapper-adoption sweep** in `check:design-tokens` (commit `1bd97f6d8`, refined in `9d1125bbd`) fails any new shared-field-primitive, raw `<button>`, or legacy `Card` render in `packages/admin/src` prod code outside the audited baseline — which burned **156 → 13** entries through the same stale-entry detection that forced each migration to remove its own line (115 pruned in `eec8b6ac8`). Primitive implementations (`Admin*.tsx`) and Shell chrome are excluded as sanctioned raw-element sites.

## Verification (at close, commit `0855bea9a` + working set)
- admin 817/817 · client 974/974 · shared 4450 passed/18 skipped; `typecheck:source` + `typecheck:tests` clean on admin
- check:design-tokens (2.10.0, all sweeps) · check:design-md (0 errors) · check:guidance-links (65) · check:skill-behavior (15) · check:source-structure (7-item shrinking baseline) all green
- Storybook play suite **193/193** (a first run under full-suite load dropped 3 in the known load-flake class; the clean rerun passed everything)

## Remaining named debt (the missing 5 points)
1. **406 raw text sizes** in the long tail — covered by the as-touched policy, not yet by a machine gate.
2. **13 baseline rows** — 8 row/card-as-button sites await a dedicated interactive-row primitive; avatar tile + stepper dots are deliberate specials.
3. **The in-flight file** (`WorkDetail/ReviewForm.tsx`, another session's) holds the last shared `Textarea` + a text-link button.
4. **2 multiline defaultMessage divergences**.
5. Cynefin radio cards kept their custom 3-line anatomy (AdminChoiceGroup handles 2 slots); hover normalized to the ink layer.
