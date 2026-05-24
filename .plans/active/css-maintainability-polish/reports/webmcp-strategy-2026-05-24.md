# Green Goods WebMCP Strategy

Status: strategy only. Do not ship runtime WebMCP tools in v1.

## Candidate Visible Tools

- Public browser site: navigate public garden, impact, fund, glossary, and onboarding sections that are already visible on the page.
- Client PWA: explain visible offline/sync status, current garden/action context, and available next steps without reading private local data.
- Admin: summarize visible table filters, selected rows, and form validation states only when the user is already on an admin page and explicitly asks for help.
- Docs: retrieve visible public docs headings, links, and page summaries for builder support.

## Forbidden Tools

- Wallet signing, transaction submission, contract upgrades, deployments, or any onchain write.
- Admin mutations, hidden moderation actions, role changes, batch approval, or private operator state.
- Reading local offline stores, private wallet identifiers, PostHog replay/session data, Linear data, environment variables, secrets, or unpublished plans.
- Background-only actions that do not have a visible page affordance and explicit user confirmation.
- Destructive operations, bulk edits, uploads, or cross-origin data extraction.

## Proof Before Runtime

- Existing guidance and `agentic:check` pass reliably.
- `agentic:browser-proof` now rebuilds client, admin, and docs bundles, then records screenshots, accessibility summaries, `/llms.txt` status, reduced-motion state, console/page errors, overflow checks, and WebMCP discovery under `.codex-artifacts/agentic-browser-proof/`.
- Static bundle proof records offline indexer fetches as advisory warnings. A seeded/indexer-backed lane is still required before treating route-entry proof as data-rich visual correctness.
- Browser proof covers screenshots or DOM checks, console health, accessibility-tree sanity, and reduced-motion behavior for motion surfaces.
- Tool descriptions are page-scoped, visible to the user, and have confirmation language for any state-changing action.
