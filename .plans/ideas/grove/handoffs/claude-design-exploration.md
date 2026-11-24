# Claude Code prompt: explore Grove's living graph

Use this as a bounded design task. It prepares reviewable prototypes; it does not authorize product implementation, dependency installation, publication or a second agent session.

---

Explore the visual design of **Grove by Green Goods — Your garden's living knowledge**. Produce three distinct, polished compositions of one living graph workspace, then recommend one. Make them inspectable in the browser, not only images. Prioritize legibility, visual craft and the feeling of a calm, useful garden memory.

## Establish the workspace and sources

Read root `AGENTS.md`, the nearest applicable guide, `DESIGN.md`, `.claude/skills/design/SKILL.md`, `.claude/skills/design/ai-ui-brief.md`, the applicable locked design decisions, and the available `modern-web-guidance` skill. Use the repository's local guidance tooling without installing or upgrading packages. Apply the design reference roles already in the AI UI brief: Refactoring UI for hierarchy, Material 3 for anatomy, Apple HIG for clarity, and Warm Earth for final identity. Do not invent new global design tokens.

Read `.plans/ideas/grove/{brief,spec,ontology-alignment,architecture-flows,dependencies,visual-design,eval}.md`. Treat these as a proposal with explicit open decisions. The graph engines' screenshots are references, not the approved appearance of Grove. Canonical domain meaning stays with Green Goods and the pinned Commons draft; do not rewrite either ontology.

Inspect `git status` before editing. Work in the supplied Grove checkout and retain other sessions' work. Do not switch branches. If the Grove hub is absent, report the mismatch rather than recreating it. The current draft PR is https://github.com/greenpill-dev-guild/green-goods/pull/1073; verify live metadata if publication state matters.

## Scope and output

Limit edits to `.plans/ideas/grove/design-exploration/` and a link in the Grove brief. Produce self-contained prototype files, their shared synthetic fixture, screenshots and a short comparison. Use already installed tooling and local assets. A lightweight SVG/HTML representation is acceptable for visual exploration; label it as such and do not claim Sigma, model, storage, performance or extension proof. Do not add production files under `packages/extension`, install packages, change manifests/lockfiles/agent guidance, use private garden data, launch other agents, commit, push, merge or deploy.

This is an idea-stage visual study, not acceptance of implementation lanes. If later asked to start production, follow the implementation start gate in `plan.todo.md`, including its actual `linear-sync` result. No Linear write is part of this exploration.

## Design three alternatives, one screen per pass

1. **Garden atlas:** warm, spacious graph with meaningful neighborhoods and a clear route into detail. This is the starting recommendation, not a locked decision.
2. **Evidence map:** a more deliberate relationship view with an excellent inspector, readable directed edges and clear evidence/provenance.
3. **Seasonal memory:** a graph organized around understanding change, with a stronger timeline and clear before/after comparison.

Use the same data, viewport and interaction scenario for all three. Change hierarchy and composition enough to make the alternatives useful; do not return three palette swaps. Use Warm Earth semantic tokens, restrained surfaces, well-spaced typography, intentional labels and meaningful motion. The graph occupies most of the workspace. No KPI wall, separate dashboard/feed/chat, giant marketing hero or decorative 3D scene.

## Synthetic scenario and behavior

Create a clearly labeled fictional garden with approximately 18–24 nodes across Garden, Action, Work, WorkApproval, Source, supporting Concept/Term and local Question. Use one captured playbook reference as a draft type example. Mark all illustrative data and provisional mappings explicitly. Include one new node, a new edge between existing nodes, two suggested connections, one accepted relationship, a superseded relationship in history and an unresolved import. Do not invent canonical Commons IDs.

Walk through: open garden → see what changed → filter to a question → select a suggested relationship → inspect its exact synthetic source excerpt → accept or correct locally → compare earlier/later recorded states. The earlier state must not show the later relationship. Preserve positions and camera. Distinguish recorded time from activity time and personal review from WorkApproval. Use “Suggested” and “Accepted by you” where appropriate.

Implement local presentation-only search/filter, node/edge selection, timeline and inspector transitions. A review interaction may change the synthetic session state only. Display its prototype status; do not imply durable saves. Include a clearly labeled same-device Hub digest preview only inside the inspector if useful; building a new Admin screen is out of scope.

Show an empty state and one failure state (model unavailable or partial import) within the winning direction. Already captured knowledge stays inspectable. Capture permission/session status should be understandable without becoming another primary workspace.

## Quality and evidence

- Inspect at 1440×900 and 1024×768; verify a 390px-wide fallback for reflow without claiming mobile-extension support. Save matching desktop screenshots for all three and a narrow screenshot for the recommendation.
- Keep selected labels readable, unrelated edges subdued, directed relationships discoverable and the inspector out of the graph's focal area. Do not rely on color or one-pixel edge clicks. Provide a keyboard-accessible text result path within the workspace.
- Verify search, filters, selection, review transition and time comparison in a real browser. Check keyboard order, visible focus, contrast, reduced motion and text overflow. No perpetual simulation or pulse loops.
- Record the actual engine and session with each screenshot (for example Chromium localhost synthetic prototype). Never label prototype proof authenticated Brave or installed-extension proof. A later extension implementation requires the repository's Brave path.
- Reuse existing commands and report exact checks run, failures and limitations. Do not install browser tooling to work around an unavailable environment.

Deliver a short comparison explaining which direction best supports a steward finding a relevant source and understanding a new relationship. Include screenshots, local file links, the recommended composition, token/component reuse, estimated custom-renderer needs, and the three most consequential open design decisions. The stopping point is a reviewable exploration for Afo to select; no production build or publication follows automatically.
