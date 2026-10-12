# Where the pooling documentation connects

Not a lane. This note is for whoever writes the Commitment Pooling documentation after this
foundation: the 2.0.0 release-essential slice (PRD-1156) and the full scope (PRD-727).

The boundary is `plan.todo.md` L13. This hub wrote no pooling tutorial, diagram, or screenshot,
did not expand `steward-guide/commitment-pooling.mdx`, published no placeholder, made no pooling
availability claim, and changed no capability record or flag.

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
- **The steward path has a new second job,** Manage Members
  (`community/steward-guide/managing-members.mdx`). `docs/src/data/steward-path.json` holds the
  path. The existing pooling page is not on that path and is still job 6 in the steward index.
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
| 3 | `steward-guide/index.mdx` | "The jobs, in order", item 6 | One line linking to the existing page |
| 4 | `gardener-guide/uploading-your-work.mdx` | "Step 1: Choose the action and garden", the paragraph that begins "A **Promise** section may appear" | Two sentences saying work does not need a promise. Linking work to a promise is not explained |
| 4 | `gardener-guide/uploading-your-work.mdx` | "Step 4: Review and upload", the figure caption | The existing Review image shows a "Work for" card, and the caption says so in one sentence |
| 4 | `gardener-guide/track-status-and-attestations.mdx` | "2. Read the status", the label table | Six labels for ordinary work. No "For a promise" or "Proof" rows |
| 4 | `gardener-guide/track-status-and-attestations.mdx` | "What happens next", after "If it is approved" | Approval is described without the linked, approved, and counted distinction |
| 4 | `gardener-guide/track-status-and-attestations.mdx` | "How gardeners get rewarded" | Two routes: the shared fund and badges. No pool payment |
| 4 | `gardener-guide/recovery-and-sync.mdx` | "1. See what is waiting" and "3. Fix what will not send" | Rows for ordinary work only. No proof or wallet-queued rows |
| 5 | `community/welcome.mdx` | "How it works, in one minute", and "Find your path" | Five steps and six paths. No pool |
| 5 | `community/how-it-works.mdx` | A new section after "Where the money fits", or a paragraph under "3. Review" | The loop is Plan, Document, Review, Certify, Fund. No promise sequence |
| 6 | `steward-guide/funding-and-governance.mdx` | "The two funds" table, and "What is not here yet" | Two funds compared. Pool money is not mentioned |
| 6 | `funder-guide/index.mdx` | "Choose how to give" table | Donate and Endow |
| 6 | `reference/faq.mdx` | A new group between "My work" and "Privacy", and the answer under "What works today" | No pooling questions. "What works today" lists gardens, work, review, assessments, donations, and endowments as in use |
| 7 | `scripts/docs/renderers.mjs`, `GLOSSARY_EVERYDAY` | Add the pooling term references to the list | Thirteen terms, none of them pooling. Pooling terms are still in the formal tables and the term reference |
| 7 | `packages/shared/src/ontology/green-goods-projections.json` | `capabilities`, `marketing_claims` | Not changed here except `human_concepts` wording and two guide links |
| 8, 9 | `docs/static/img/community/commitment-pooling/` | New images | The `img/community/` folder is empty after this work and no longer in the tree. Create it with the first image |

## Rules the pooling pages inherit

- **Glossary everyday terms.** A term added to `GLOSSARY_EVERYDAY` needs a `human_concepts`
  record and a heading that is its display name or a declared alias, or the generator throws.
  `scripts/quality/check-ontology.mjs` fails on a heading in "Everyday terms" that resolves to no
  declared term. Each entry's "Availability" line comes from the capability record, so reconcile
  those records (step 7) before adding a pooling term.
- **Images.** The docs audit fails on an image nothing uses, and does not check that an `<img>`
  path exists. Captions name source and date. The deployed Storybook does not expose its commit.
- **Voice search.** `eval.md` holds the one list of protocol and network names. Hits on the
  steward pooling page were recorded, not changed: at this commit it has none.
- **Twin test.** `docs/scripts/llms.test.mjs` pins the fourth item of the steward path. If the
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
