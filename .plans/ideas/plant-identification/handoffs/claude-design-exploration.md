# Claude prompt: explore the plant identification flow

Create an interactive design artifact for Green Goods plant identification. Compare layouts and explore how identified plants enter action Details, submission metadata, saved work, steward review and reports. Use synthetic data; this is design exploration, not production integration.

## Inputs and scope

Repository: `/Users/afo/Code/greenpill/green-goods`  
Hub: `.plans/ideas/plant-identification/`

Read the hub's `brief.md`, `spec.md` and `eval.md` first. New user answers supersede the recorded design. Read root `AGENTS.md` and relevant package guidance before inspecting app sources. Apply design/modern-web-guidance for UI, and humanize-writing for human-facing prose.

Inspect:

- `packages/client/src/views/Garden/WorkMediaPhotoCard.tsx`, `Media.tsx`, `Details.tsx`, `Review.tsx`: existing Media → Details → Review capture.
- `packages/shared/src/utils/action/templates/agro.ts`: actual action fields.
- Root `DESIGN.md`, `packages/client/DESIGN.md`, `packages/client/DESIGN.pwa.md`, `.claude/skills/design/client-prompt-contract.md`, `.claude/skills/design/implementation.md`: client language and tokens.
- For the steward preview: `packages/admin/DESIGN.md`, `.claude/skills/design/prompt-contract.md`, and `packages/admin/src/views/Garden/WorkDetail/SubmissionDetails.tsx` with its metadata helper.

Allowed writes are this hub's artifacts, design handoffs and design findings. Preserve other sessions' work. Do not modify production code, dependencies/lockfiles, env files, branches, contracts or execution lane states. Do not publish, write external trackers, read secrets or call Kindwise. No background agents are needed.

## Confirmed direction

- Kindwise plant.id and plant.health; the user has credits.
- A manual **Identify plant** button inside the photo box. Upload/view does not trigger requests.
- A readable light card overlays the photo after identification.
- Fill relevant editable Details so gardeners do not retype names. Preserve manual values.
- Launch: Site Assessment & Species Plan, Planting Event, Survival Check, Maintenance Activity, Harvest & Yield Record. Learning Reflection is deferred.
- Optional health through a separate deliberate **Check health** request, initially on Survival Check and Maintenance only.
- Optional per-species planting quantities and per-crop harvest weights in version one.
- Offline identification can be queued with a clear pending state; work capture/manual entry remain usable.
- Results finishing after submission appear as clearly labeled later results; a gardener can attach a deliberate separate update. Preserve the original snapshot.

All six product questions asked so far are answered in the brief. Credit quotas, confidence thresholds, vendor wording, category mappings and the technical late-update design remain for later planning; label any demonstration assumptions in reviewer tooling. Do not claim harvested produce is a supported health input.

## Deliverable

In Claude Code, create one self-contained runnable HTML artifact at `.plans/ideas/plant-identification/artifacts/plant-identification-flow.html`, with inline CSS/JavaScript and deterministic fixtures. No build, install, CDN or external API is needed.

If running in Claude's artifact interface without repository access, produce the equivalent interactive React artifact using the embedded rules here; state which repository references you could not inspect. Ask for the brief/spec only if a missing decision materially blocks exploration. Do not claim repository visual alignment without inspection.

A reviewer-only exploration bar should contain layout A/B, mobile/desktop preview, action selector, scenario controls, reset and optional metadata preview. Keep this tooling outside the simulated gardener experience.

Use a fictional community garden and synthetic guava (`Psidium guajava`), mango (`Mangifera indica`) and tomato (`Solanum lycopersicum`). Scores and health conditions are fictional UI examples, not provider responses. Use safe local assets or inline illustrations labeled as photo stand-ins; no private QA images or identifiable people. State must persist across steps; disclose if reload persistence is omitted.

## Screens

1. **Media:** Photo boxes with independent preview/remove/Identify controls. Simulate identifying, queued, success, ambiguity, no plant, failure and credit-limit states. Light overlay: common/scientific name, Suggested by Kindwise, Added to Details, Details and Change. Show first-use third-party processing explanation and credit consequence before the simulated request.
2. **Plant disclosure:** Selected taxon, alternatives, source photo, synthetic score/provenance and requested health. Allow choosing an alternative, entering a manual name and removing identification while keeping the photo. Long reference descriptions/care stay here, not in gardener observations.
3. **Details:** Realistic existing fields plus editable plant rows. Planting retains overall planted total/participants and optional species counts. Harvest retains total kg/count and optional crop weights. Survival retains alive/checked/checkpoint. Maintenance retains actual activity/area. Site identification enters Existing plants; only explicit Add to planting plan enters Planned plants. Category tags remain manual and separate.
4. **Review:** Final entries, measurements, included health observations and evidence photos; public publication reminder. Return to edit without losing state.
5. **Saved work:** A clearly simulated Submit produces a snapshot. Gardener and steward previews show Plants/evidence. Work approval differs from identity certainty/health suggestion. Never imply a real attestation.
6. **Garden/report concept:** Filters for observed/planted/harvested and source-work drill-through. Of 20 seedlings, 8 guava + 5 mango leaves 7 unallocated. Of 12 kg, 8 allocated to tomato leaves 4 unallocated. Missing allocations are unknown. Never infer quantity from photos or confidence. Label as future reporting design.

Model final plant entries separately from evidence predictions, per spec. A manual correction preserves original prediction in disclosure. Reviewer-only metadata preview contains selected public-safe fields: no key, access token, custom retrieval ID, private URL, precise location or raw response.

## Required interaction behavior

- Identify fills empty fields without overwriting manual input. Ambiguity requires selection.
- Correcting a suggested name retains manually entered quantities and notes.
- Measurements use explicit units; reject allocations above the overall total and show smaller allocations as an unallocated remainder. Missing optional measurements stay unknown.
- A second supporting photo can join an existing entry without doubling quantity. Species match alone is not individual-plant identity; distinct entries remain possible.
- Photo deletion/replacement resolves stale results/rows visibly and preserves manual work. No active result remains linked to different photo bytes.
- Requested health can be included/removed/corrected as a suggestion. Do not infer a performed maintenance treatment.
- An offline tap queues a photo-specific intent; support pending/cancel/reconnect. Simulate reconnection without duplicate requests and keep manual edits. Demonstrate submitting before analysis completes with a labeled later result and deliberate separate update; never silently change its original snapshot.
- Errors/credit limits preserve the draft. Display/retrieval never starts another analysis.
- Shared state carries through Media, Details, Review and saved work; controls must operate, not just decorate screenshots.

## Visual direction

Client: Warm Earth garden journal, Inter/system fallback, readable warm light surfaces, clear ink hierarchy, restrained garden-green accents and current repository tokens. Keep the overlay compact/readable over busy photos, with preview/remove reachable. Mobile first; no editorial serif in the PWA.

Steward: restrained Warm Earth/M3, Plus Jakarta Sans fallback, solid information surfaces and functional copy. Desktop detail uses a centered dialog adapting on mobile, rather than a new workspace side sheet. Map proposed controls to existing primitives in the handoff; the artifact may approximate them without runtime providers.

Use semantic sibling buttons, accessible names, keyboard operation, visible focus, touch targets, sufficient contrast, reduced motion, focus return and accessible status announcements. Do not add gamification or a full plant inventory. Disclose intentional secondary omissions.

## Exploration and proof

Briefly describe two layouts and their tradeoffs, then build both under the comparison control. A: compact name/source overlay with disclosure. B: expanded light overlay with Added to Details and clearer health state. Behavior stays equivalent. The user authorized mock exploration; make it reviewable without another preliminary layout approval.

Walk through `eval.md`, prioritizing auto-fill, correction with retained measurements, health inclusion, photo invalidation, offline/late-result handling and allocations. Inspect 390 px mobile and desktop with available browser tools. Record engine/session, date, viewports, tested interactions and screenshots when available. If unavailable, return the runnable artifact and label rendered proof `none`; a standalone artifact is not authenticated gardener or installed-PWA proof.

Write `handoffs/claude-design-results.md` with artifact path, recommendation, tested behavior, component mapping, questions and limits. Link results/artifact in hub metadata once they exist; keep stage `ideas` and production lanes `n/a`. Run `node scripts/harness/plan-hub.mjs validate` after hub metadata edits.

Return the artifact, recommendation and questions needed for selection. Stop at a reviewable design artifact; do not begin production integration or paid API experiments.
