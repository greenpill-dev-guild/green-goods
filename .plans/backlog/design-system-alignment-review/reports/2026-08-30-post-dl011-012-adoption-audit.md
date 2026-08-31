# Post-DL-011/012 Adoption Audit — Admin Cockpit — 2026-08-30

**Scope**: packages/admin/src (views + components), en.json casing surface, admin typography. Read-only; no fixes applied.
**Question asked**: now that the system is updated (DL-009→012, compact metric, Title Case, field anatomy, 21 wrappers), what still bypasses it?
**Method**: full validator suite first (ALL GREEN — check:design-tokens at 2.9.0 incl. all five invariant sweeps, design-md, guidance-links 65, skill-behavior 15), then two parallel evidence sweeps (controls/sizes ×34 calls; casing/typography ×29), load-bearing counts re-verified by hand where they mattered.

**Score: 77/100** — up from 72 (round 1). The split is stark: the system *definition* (tokens, primitives, canon, machine guards) is now ~95; *adoption* in the long-tail views is ~60 and is the entire remaining gap.

## Verdict in one line

The 21 wrappers, the compact metric, and every token gate hold — but roughly a third of the cockpit's real form-and-button surface was built before the wrappers existed and still bypasses them; nothing enforces the wrapper boundary, so the counts will regrow without a lint gate.

## Findings (ranked)

### 1. The field family is the big unadopted surface 🔴
**85 shared-control render sites vs 49 admin-field sites** (~63% bypass; hand-verified — the sweep agent's raw 145-vs-7 overcounted). 33 files import `TextInput`/`Textarea`/`NativeSelect` from shared ControlPrimitives; 23 wrap them in shared `FormField`; 4 use self-contained `FormInput`/`FormTextarea` (MetadataEditor ×4, AttestationSelector, GreenWillPanel); 3 hand-roll a bare `<label>` + primitive (ActionTranslationEditor:156, AttestationSelector:143/:180) — **three competing field anatomies** beside the canonical one. Densest clusters: DetailsConfigSection (13), MediaConfigSection (14), GardenSettingsEditor (11), CreateActionSteps/BasicsStep (10), CreateListingDialog (8), CampaignAdvancedSection (8). AttestationSelector's NativeSelects at `py-3 px-4` are also off-scale (~48px).

### 2. 38 raw `<button>` elements outside the wrapper system 🔴
Classified: 11 icon-buttons (worst: EnsAddressText:66 at ~20px hit target; AccountProfileAvatarEditor:123 at 56px — a chrome-tier size on a control), 4 text-link buttons with no hit target (ReviewForm:325, SubmitWorkReview:48, ActionsHarvestStep:152, HypercertPreview:39), 7 hand-rolled CTA clones of AdminButton variants (StrategyKernelStep:469 "Add Outcome", VaultEventHistory:198 "Load more", WithdrawModal:191 danger clone, ActiveListingsTable:183/:201, MetadataEditor:250, ImpactFunders:68), 7 toggles/selectables that should be AdminChoiceGroup/AdminSelectableCard/AdminFilterChip (DomainContextStep:114, ActionTranslationEditor:484 locale pill at ~30px, AttestationSelector:299, MetadataEditor:204/:371/:425, ActionFlowStepper:83), 8 row-as-button sites (mostly m3-state-layer rows — closest to sanctioned), plus HubWorkCard:170's whole-card button.

### 3. AdminButton defeated by className overrides ×9 🟡
The wrapper exists but call sites override its geometry: `!h-11 !w-11` (PoolFundingSection:73 — double-bang), `min-h-12` (CommitmentClaims:64/:77 — 48px is not on the scale at all), `h-9 w-9 rounded p-0` icon hacks (SignalPool:370, Strategies:173 — should be h-8), and the three InstructionsBuilder:42/:58/:74 `h-auto py-3 rounded-none` **tab-rail impostors** that should be AdminTabRail. Also 4 Link/a-as-icon-button sites stepping h-9→sm:h-10 off-ladder (PageHeader:91, GardenDetailHelpers:86, GardenMetadata:122/:174) and 2 `min-h-[44px]` arbitrary values that should be `min-h-11` AdminButton asChild (GardenMetadata:204/:219).

### 4. DL-012 leftovers + over-reach — the sweep was ~90% right, both tails visible 🟡
- **~55 missed action labels**: verbs outside the sweep's list ("Take this up", "Seed commitment", "Raise dispute", "Make this offer", "Claim name", "Generate draft", "Pay by card"…) plus retry actions hidden under error-flavored keys the exclusion regex ate (`cockpit.access.indexerErrorRetry`, `cockpit.garden.pool.readError.retry` — still "Try again" while their code fallbacks now say "Try Again": a live inconsistency, en.json wins at runtime).
- **~17 over-swept**: status/label copy that got Title Case and shouldn't have ("Connection Lost", "Not Deployed", "Start Date"/"End Date" field labels, "Search Gardens…" placeholder, "Support That Keeps Working" kicker; "Audio Notes" trio now internally inconsistent).
- **Dialog-title convention split 7-vs-7 in one family**: pool dialogs half "Close This Pool" style, half "Archive this pool" style; plus "Sign in to Allocate Conviction" (a sentence in Title Case).
- **114 defaultMessage↔en.json divergences** (casing subset ~10, incl. AppBar "Settings" vs "Open Settings"; the other ~90 are semantic drift — out of DL-012 scope but the fallbacks are actively wrong).
- One hardcoded sentence-case action: `views/Cookies/index.tsx:30` `label: "Create cookie jar"` (also untranslated).

### 5. Typography: raw sizes outnumber the scale 2.2:1 🟡
771 raw `text-{xs,sm,base,lg,xl,2xl}` vs 224 scale utilities + 123 bare `.label-*`/`.body-*`. Worst 15 files listed in the sweep (HypercertDetail 24, HypercertPreview 22, ActionDetail 21, GardenCommunityCard 21…). Nastiest pattern: `label-md … sm:text-lg` — a responsive breakpoint escaping the scale on one element (ActionDetail:151, GardenCommunityCard:78). `font-bold` is effectively clean (2 sites).

### 6. Outlined fields on transparent surfaces ×4 + legacy Card tail 🟢
`variant="outlined"` now violates the underline-default rule at Strategies:189, SubmitWorkStepContent:153, SubmitWorkFields:30, ActionTranslationEditor:144 (outlined field inside an outlined section = double outline). Three EditAction sites pend on AdminCard's resolved default variant. Legacy shared `Card`: **10 files / 27 render sites** (down from 13 files); 7 use `Card.Header`/`Body` slots AdminCard lacks — migration needs an API decision, not a rename.

### 7. Found in passing 🔴 (real bug, not design)
`app.garden.submit.tab.*.label` values are **rotated one step against their instructions**: media.label="Add Details" (instruction: take a photo), details.label="Review Work" (instruction: provide details), review.label="Upload Work" (instruction: check correctness). The client submit wizard shows mislabeled step names in production (consumed at client views/Garden/index.tsx:179-256). Predates today; verified directly in en.json:2044-2050.

### Self-corrections from today's own work
`AdminSortSelect.tsx:23` docblock still claims h-10/16px after the h-9 change (mine, hours old). The sweep's exclusion regex both under- and over-reached as documented above — the correction batch belongs to the same follow-up.

## Recommended enforcement (before counts regrow)
oxlint `no-restricted-imports` on `@green-goods/shared/components/Form/*` + `Cards/CardBase` scoped to packages/admin/src (allowlist current files, shrink like the token baseline), plus a raw-`<button>` sweep in check-tokens with the same self-burning TSV pattern that worked for shadows/rings.

## Priority actions
1. **Fix the rotated wizard labels** (bug, one commit).
2. **Casing correction batch**: ~55 missed + ~17 reverts + retry-key family + dialog-title convention pick + casing-subset fallback sync.
3. **Field-family adoption program**: 85 sites by form cluster (DetailsConfig/MediaConfig → GardenSettings → CreateAction steps → CookieJar/Campaign set), with the enforcement baseline landing first.
4. **Raw-button folding**: 38 sites to wrappers; kill the 9 AdminButton overrides and 3 tab impostors.
5. **Typography as-touched policy + targeted pass** on the top-15 files.
6. Outlined-field fixes ×4; legacy Card API decision.
