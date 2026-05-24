# Green Goods WebMCP Strategy

Status: strategy only. Do not ship runtime WebMCP tools in v1.

## Candidate Visible Tools

- Public browser and docs: summarize visible `/fund`, `/impact`, `/gardens`, `/actions`, `/cookies`, and docs content.
- User-facing navigation: direct the user to visible app or docs routes and explain currently visible controls, filters, empty states, and errors.
- Visible form support: help map user-provided text into already visible fields without submitting, signing, attesting, or publishing.
- Local development proof: expose route-entry, Storybook, accessibility-tree, console, `/llms.txt`, reduced-motion, and WebMCP discovery status for local review only.

## Forbidden Tools

- Wallet details, passkeys, session identifiers, local offline data, private garden state, pending submissions, replay URLs, telemetry identifiers, or secrets.
- Onchain writes, attestations, vault actions, marketplace actions, contract upgrades, admin actions, deploys, or any hidden operator workflow.
- Background-only actions, destructive operations, bulk content changes, cross-origin extraction, or tool calls that bypass the normal authenticated UI.

## User Confirmation And Public Safety

- Runtime tools must be visible, page-scoped, and public-safe by default.
- Any authenticated, financial, wallet, publishing, signing, transaction, or persistence action must stay outside WebMCP until a human-confirmation design and policy test suite exists.
- Read-only tools may describe visible state; they must not infer private state from local storage, indexed databases, API calls, telemetry, or environment configuration.

## Proof Before Runtime

- `bun run agentic:check`, `bun run agentic:browser-proof`, and the relevant Storybook or Lighthouse lane must pass for the affected surfaces.
- Browser proof must record screenshots, accessibility summaries, console/page errors, overflow, `/llms.txt`, reduced-motion status, and WebMCP discovery status.
- Chrome DevTools MCP or Puppeteer WebMCP must verify expected tool discovery, schema validity, graceful errors, user confirmation boundaries, and absence of forbidden tools.
- Tool evals must prove agents choose the right tool, with the right parameters, for visible user journeys before any runtime rollout.
