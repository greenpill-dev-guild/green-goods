# Green Goods WebMCP Strategy

Status: implemented for clean-room DevTools MCP plus public-safe client WebMCP v1. Runtime WebMCP tools are limited to visible public browser routes; private, admin, wallet, onchain, signing, telemetry, and persistence tools remain forbidden.

## Candidate Visible Tools

- Public browser: summarize visible `/`, `/fund`, `/impact`, `/gardens`, `/actions`, `/cookies`, `/landing`, and public Garden detail pages.
- User-facing public navigation: direct the user to approved public routes and explain currently visible controls, filters, empty states, and errors.
- Visible form support: help map user-provided text into already visible fields without submitting, signing, attesting, or publishing.
- Local development proof: expose route-entry, Storybook, accessibility-tree, console, `/llms.txt`, reduced-motion, and WebMCP discovery status for local review.

## Forbidden Tools

- Wallet details, passkeys, session identifiers, local offline data, private garden state, pending submissions, replay URLs, telemetry identifiers, or secrets.
- Onchain writes, attestations, vault actions, marketplace actions, contract upgrades, admin actions, deploys, or any hidden operator workflow.
- Background-only actions, destructive operations, bulk content changes, cross-origin extraction, or tool calls that bypass the normal authenticated UI.

## User Confirmation And Public Safety

- Runtime tools must be visible, page-scoped, and public-safe by default.
- Any authenticated, financial, wallet, publishing, signing, transaction, or persistence action must stay outside WebMCP until a human-confirmation design and policy test suite exists.
- Read-only tools may describe visible state; they must not infer private state from local storage, indexed databases, API calls, telemetry, or environment configuration.

## Clean-Room DevTools MCP Proof Profile

- Project MCP config lives in `.mcp.json` and exposes `brave-devtools` through `scripts/mcp/brave-devtools.mjs`, which starts the upstream `chrome-devtools-mcp@latest` protocol package against Brave only with a compatible Node 22 toolchain, isolated profile, stable viewport, page-id routing, structured output, redacted network headers, localhost HTTPS support, WebMCP debugging category, WebMCP testing flags, and external usage/CrUX calls disabled. The package name is not permission to use Google Chrome, Chrome for Testing, Chromium, or Edge; the wrapper rejects non-Brave executable paths.
- Prefer the repo clean-room browser lane first for public route screenshots/DOM, accessibility summaries, console/page errors, overflow, `/llms.txt`, reduced-motion state, Storybook or route-entry evidence, and WebMCP discovery.
- Use DevTools MCP only for CI/clean-room public-route checks or explicit non-authenticated protocol debugging. Local authenticated QA for admin, PWA, wallet, or private-data surfaces must use the authenticated Brave QA profile and connected browser-extension path.
- Run MCP proof from an isolated Brave profile. Do not connect agent tooling to a normal profile when the inspected surface can expose wallet state, admin sessions, private garden data, telemetry identifiers, cookies, local storage, or private tabs.
- The proof bundle for any runtime candidate must include: route/surface, viewport, screenshot, DOM or accessibility snapshot, console/page error summary, network/performance notes when relevant, `/llms.txt` result, reduced-motion result, and `list_webmcp_tools` output.

## Proof Before Runtime

- `bun run agentic:check`, `CI=true bun run agentic:browser-proof`, and the relevant Storybook or Lighthouse lane must pass for the affected public clean-room surfaces.
- Browser proof must record screenshots, accessibility summaries, console/page errors, overflow, `/llms.txt`, reduced-motion status, and WebMCP discovery status.
- Clean-room DevTools MCP or Puppeteer WebMCP must verify expected tool discovery, schema validity, graceful errors, user confirmation boundaries, and absence of forbidden tools. Native WebMCP discovery requires a Brave build with `navigator.modelContext`; built-route browser proof also injects a model-context probe to verify Green Goods registers its public tools when the browser API is present.
- Tool evals must prove agents choose the right tool, with the right parameters, for visible user journeys before any runtime rollout.

## Runtime Expansion Approval Spec

Before adding tools beyond the public-safe v1 set, write an approval-ready spec that lists candidate visible tools, forbidden tools, confirmation rules, the public/private privacy boundary, input and output schema tests, wrong-tool and wrong-argument evals, user-confirmation evals, and the exact proof commands. Do not add wallet, admin, onchain, signing, persistence, or private-state tools without explicit approval and a matching policy test suite.
