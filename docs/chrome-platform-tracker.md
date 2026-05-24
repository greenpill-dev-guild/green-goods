# Chrome Platform Tracker

Last refreshed: 2026-05-24

Guidance sources: `modern-web-guidance@latest`, Chrome same-document View Transitions, Chrome WebMCP, Lighthouse Registered WebMCP tools, Chrome soft-navigation measurement, Chrome DevTools Performance reference, and Chrome DevTools MCP.

| Feature | Current adoption | Candidate surface | Risk | Proof command | Status |
| --- | --- | --- | --- | --- | --- |
| `/llms.txt` and agent-readable docs | Client and docs publish `llms.txt`; browser proof checks `/llms.txt` and route discovery. | Public browser site, docs, and built client/admin route proof. | Stale or overbroad agent context can imply private app or admin access. | `bun run agentic:browser-proof` | ship |
| Semantic, native, accessible DOM | Strong Agentic Modern Web Standard, Warm Earth design rules, Storybook, and browser-proof lanes are present. | Client browser/PWA, admin, docs, Storybook. | Shared UI can pass Storybook while consuming app CSS differs; verify rendered DOM when UI moves. | `bun run agentic:check` | ship |
| Same-document View Transitions | Client and admin already ship View Transition CSS/logic with reduced-motion coverage. | Existing route/card/dialog transitions. | Route transitions must not mask wallet, admin, sheet, or onchain state changes. | Existing component tests plus `bun run agentic:browser-proof` when routes change. | ship |
| WebMCP runtime tools | Strategy and discovery probes only; no runtime tools approved. | Future public read-only route explanation only. | Wallet/passkey, admin, vault, attestation, marketplace, onchain, telemetry, or private garden state would be unsafe. | Chrome DevTools MCP `list_webmcp_tools` must prove no forbidden tools before runtime experiments. | watch |
| Chrome DevTools MCP proof | Browser proof captures screenshots, accessibility summaries, `/llms.txt`, reduced motion, console/page errors, overflow, and WebMCP discovery. | Public browser, admin, and docs debugging when route proof is needed. | Real-profile MCP proof can expose authenticated admin/wallet state or browser profile data. | `bun run agentic:browser-proof`; use isolated/non-default profiles for sensitive proof. | ship |
| Core Web Vitals | Lighthouse scripts and existing performance tests cover parts of LCP/CLS; no normalized soft-navigation plan is documented. | Client SPA/PWA, public browser routes, admin routes. | Admin/client route transitions can shift CWV attribution; soft-navigation measurement remains developing. | Plan first: capture LCP, INP, CLS, route label, `navigationType`, and view-transition context. | prototype |
| Translator/browser AI APIs | Translator adoption exists in client-facing surfaces; other browser AI APIs are not a dependency. | Public copy assistance only where existing UX already supports it. | Browser AI APIs may be unavailable, flag-gated, or privacy-sensitive. | Existing feature-specific tests and visible fallback copy. | prototype |
| HTML-in-Canvas, Declarative Partial Updates, `streamHTML` | No production dependency. | Research backlog only. | Experimental APIs could bypass accessible DOM or weaken Baseline posture. | Explicit spike plan and browser/AX proof required. | watch |

## Adoption Notes

- Preserve the strong existing adoption: `/llms.txt`, semantic DOM, Warm Earth design proof, Storybook, and browser-proof lanes.
- WebMCP remains frozen at strategy/proof level until the user explicitly approves runtime `navigator.modelContext.registerTool`, `toolname`, or `tooldescription` work.
- No wallet, onchain, admin, vault, signing, attestation, or private state should become a WebMCP tool candidate.

## Operational Follow-Up

- Repo-native task surface: `.plans/active/css-maintainability-polish/plan.todo.md` under `Phase 7 - Modern Web UI Primitive Follow-Up`.
- Next proof task: normalize CWV/soft-navigation fields through existing Lighthouse, Vercel/PostHog, and browser-proof evidence before any runtime analytics changes; use isolated DevTools MCP only for public/non-authenticated proof or a separately approved admin session.
