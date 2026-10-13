# Where the pooling documentation connects

Not a lane. This note is for whoever writes the Commitment Pooling documentation after this
foundation: the 2.0.0 release-essential slice (PRD-1156) and the full scope (PRD-727).

The current boundary is `plan.todo.md` L13 amended by L21. The first foundation wrote no pooling
tutorial, diagram, or screenshot, did not expand `steward-guide/commitment-pooling.mdx`, published
no placeholder, made no pooling availability claim, and changed no capability record or flag.

## Approved after QA: overview now, user guides later

Afo clarified that “specific action funds” means Commitment Pooling and authorized its integration
on **Welcome, How It Works, and Why We Build**. This hub now owns that concise orientation in
steps 5.1, 5.3, and 5.4. These explanations are now written and locally verified. The later pooling slice
must reuse and reconcile these explanations rather than adding a conflicting second narrative.

- Welcome: why pooling belongs in Green Goods and where it fits.
- How It Works: the relationship between commitments, evidence, review, and conditional funding,
  without treating work approval alone as payment or qualification.
- Why We Build: the user problem pooling addresses, without guaranteed outcomes or unsupported
  claims about current production activation.

Check ontology meaning, capability evidence, and owning implementation together before writing.
The presence of a contract or a UI tab is not proof of production availability. No runtime flag or
capability status changes are authorized by this narrative work. New pooling tutorials, diagrams,
screenshots, user-guide procedures, FAQ flow expansions, and substantive changes to the existing
steward pooling page remain with the later work. PRD-727 retains the full scope; PRD-1156 retains
the release-essential slice. Neither is closed or narrowed into PR #795 or this hub.

The release slice's own plan, `handoffs/release-essential-docs.md` in the pooling hub, was read
on 2026-10-12 from the checkout where that work is being prepared. It is not on `develop` or in
this branch yet, so nothing here links to it. Its step numbers are used below so the two plans
can be read side by side.

## What changed underneath that plan

The pooling plan was written against the older community pages. Four things differ now:

- **The FAQ is at `/faq`.** `/reference/faq` redirects. The source file is still
  `docs/docs/reference/faq.mdx`.
- **Make an Assessment moved** to `community/evaluator-guide/making-an-assessment.mdx`. The old
  steward slug redirects, and the steward sidebar keeps a link to the page.
- **The steward task links begin with** Manage Members
  (`community/steward-guide/managing-members.mdx`). `docs/src/data/steward-path.json` holds the
  path. The existing pooling page is not in that component and remains linked under “Choose your next task” in the steward index.
- **Every task page follows one contract** (`docs/README.md` § Community task pages). The pooling
  plan's page contract is the same one, so a new pooling page drops in without a second pattern.

The existing steward pooling page, `community/steward-guide/commitment-pooling.mdx`, its slug,
its sidebar entry ("Commitment Pool"), and its link from the steward index are unchanged. It is
the one community page that does not follow the page contract yet, by design.

## Insertion points

| Pooling plan step | File | Where it connects | What is there today |
|---|---|---|---|
| 2 | `docs/sidebars.ts` | Gardener category, after `track-status-and-attestations` | Five gardener pages. No commitments entry |
| 2 | `gardener-guide/index.mdx` | "The path", a new item after Track Your Work | Five numbered links |
| 2 | `gardener-guide/commitments.mdx` | New file, owned by the pooling work | Does not exist. Not created here |
| 3 | `steward-guide/commitment-pooling.mdx` | The whole page | Untouched |
| 3 | `steward-guide/index.mdx` | "Choose your next task", after Review Work | One line linking to the existing page |
| 4 | `gardener-guide/uploading-your-work.mdx` | "Step 1: Choose the action and garden", the paragraph that begins "A **Promise** section may appear" | Two sentences saying work does not need a promise. Linking work to a promise is not explained |
| 4 | `gardener-guide/uploading-your-work.mdx` | "Step 4: Review and upload", the figure caption | The current non-pooling Review capture shows Seedling Transplant, time, count and note. It does not illustrate a linked promise; later pooling work needs its own faithful capture |
| 4 | `gardener-guide/track-status-and-attestations.mdx` | "2. Read the status", the label-led status list | Six labels for ordinary work. No "For a promise" or "Proof" rows |
| 4 | `gardener-guide/track-status-and-attestations.mdx` | "What happens next", after "If it is approved" | Approval is described without the linked, approved, and counted distinction |
| 4 | `gardener-guide/track-status-and-attestations.mdx` | "How gardeners get rewarded" | Two routes: the shared fund and badges. No pool payment |
| 4 | `gardener-guide/recovery-and-sync.mdx` | "1. See what is waiting" and "3. Fix what will not send" | Label-led ordinary-work advice. No new pooling proof or wallet-queued instructions |
| 5, brought forward | `community/welcome.mdx` | Short product orientation and role destinations | Written under “How it works, in one minute”; later guides connect to it |
| 5, brought forward | `community/how-it-works.mdx` | The loop and where funding fits | Written under “Where Commitment Pooling fits” at #commitment-pooling; later guide details stay separate |
| Overview added by L21 | `community/why-we-build.mdx` | Problem and purpose | Written under “From shared goals to promises”, without outcome guarantees |
| 6 | `steward-guide/funding-and-governance.mdx` | "The two funds" table, and "What is not here yet" | Two funds compared. Pool money is not mentioned |
| 6 | `funder-guide/index.mdx` | "Choose how to give" table | Donate and Endow |
| 6 | `reference/faq.mdx` | A new group between "My work" and "Privacy", and the answer under "What works today" | No pooling questions. "What works today" lists gardens, work, review, assessments, donations, and endowments as in use |
| 7 | `scripts/docs/renderers.mjs`, `GLOSSARY_EVERYDAY` | Add everyday pooling terms when approved and their availability wording is reconciled | Thirteen everyday terms. Completed Phase 6 moved formal terms to the generated Builders ontology while keeping old glossary anchors as useful pointers |
| 7 | `packages/shared/src/ontology/green-goods-projections.json` | `capabilities`, `marketing_claims` | Not changed here except `human_concepts` wording and two guide links |
| 8, 9 | `docs/static/img/community/commitment-pooling/` | New images | The existing `img/community/` folder now holds the approved editorial images. Its pooling subfolder does not exist; add it with the first approved pooling image |

## Rules the pooling pages inherit

- **Glossary everyday terms.** A term added to `GLOSSARY_EVERYDAY` needs a `human_concepts`
  record and a heading that is its display name or a declared alias, or the generator throws.
  `scripts/quality/check-ontology.mjs` fails on a heading in "Everyday terms" that resolves to no
  declared term. Each entry's "Availability" line comes from the capability record, so reconcile
  those records (step 7) before adding a pooling term.
- **Formal reference.** Under L20, formal definitions belong with the generated ontology on
  Builders. Reuse its authoritative term and compatibility-link machinery from completed Phase 6; do not
  restore technical tables to the Community glossary or copy a new definition into the guides.
- **Images.** The docs audit fails on an image nothing uses, and does not check that an `<img>`
  path exists. Captions name source and date. The deployed Storybook does not expose its commit.
- **Voice search.** `eval.md` holds the one list of protocol and network names. Hits on the
  steward pooling page were recorded, not changed: at this commit it has none.
- **Twin test.** `docs/scripts/llms.test.mjs` checks the unordered steward task list. If the
  pooling page joins `steward-path.json`, update that assertion in the same change.

## Images that already show pooling screens

These are in the docs today and were not added for pooling. They show what the product shows:

- `img/screenshots/client-work-review.webp`: the Review step with a "Work for" card.
- `img/screenshots/client-work-offline.webp` and `img/builders/client-work-dashboard.webp`: Your
  Work with rows marked "For a promise" and "Proof".
- `img/screenshots/admin-hub.webp`: the Hub with its "Confirm" tab.

## Not decided here

- Q2, the line between the docs site and the Commitment Pooling Google Doc, stays with the
  pooling hub.
- Whether the steward pooling page joins the steward path.
- QA walk scenarios for pooling pages. The catalog's DOCS cases cover the non-pooling guides.


The FAQ now uses native disclosures and explicit question IDs; add later pooling answers through
FaqQuestion/FaqQuestions and preserve twins/search. The steward component is an unordered task
list, not a required sequence. New images need source/build labels and complete text steps.
No new pooling user guide, diagram, screenshot, runtime flag, or availability value was added
in this QA revision. The unchanged existing steward pooling page remains the procedural owner.
