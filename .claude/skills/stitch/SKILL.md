---
name: stitch
description: "Stitch-to-code pipeline — fetch designs from Stitch projects, download assets, and implement using existing package components. Use when the user says 'build from Stitch', 'implement this screen', or references a Stitch project."
version: "1.1.0"
status: active
packages: ["admin", "client"]
dependencies: ["ui", "design"]
last_updated: "2026-04-17"
last_verified: "2026-04-17"
---

# Stitch Build Skill

Bridge between Google Stitch designs and codebase implementation. Fetches screens from Stitch, downloads assets locally, and implements using the project's existing component system.

## Route to another skill when…

- You need to WRITE a Stitch prompt or sync DESIGN.md from Stitch → user-level **`stitch-design`** skill.
- You need the **admin** AI prompt vocabulary (stable core + never-use list) → **`.claude/skills/design/prompt-contract.md`**.
- You need the **client** AI prompt vocabulary → **`.claude/skills/design/client-prompt-contract.md`**.
- Stitch is not involved → **`design`** (direction) + **`ui`** (implementation).

## Skill Routing Map

Two Stitch skills, two scopes. This diagram shows who owns what:

```text
                      ┌─────────────────────────────────┐
   user says...       │  User-level:  stitch-design     │
  ─────────────       │  (~/.claude/skills/stitch-design)│
                      │                                 │
  "create a Stitch    │  • Prompt enhancement           │
   prompt for X"  ───►│  • DESIGN.md synthesis          │
  "enhance this       │  • Cross-project Stitch MCP     │
   for Stitch"        │  • Surface routing from         │
  "sync DESIGN.md     │    .stitch/config.json          │
   from Stitch"       └────────────┬────────────────────┘
                                   │
                                   │ called by
                                   │ project
                                   ▼
                      ┌─────────────────────────────────┐
   user says...       │  Project-level:  stitch          │
  ─────────────       │  (.claude/skills/stitch)         │
                      │                                 │
  "build from Stitch" │  • Fetch screens from Stitch    │
  "implement this     │  • Download HTML + screenshots  │
   screen"       ────►│  • Map to surface DESIGN.md     │
  "build the Work     │  • Implement using existing      │
   view from Stitch"  │    package components           │
                      │  • Verify against screenshot    │
                      └────────────┬────────────────────┘
                                   │
                                   │ consults
                                   ▼
                      ┌─────────────────────────────────┐
                      │  design + ui skills (project)    │
                      │  design/prompt-contract.md (admin)│
                      │  design/client-prompt-contract.md │
                      └─────────────────────────────────┘
```

**Rule of thumb**:
- Hands on **prompt** → stitch-design (user skill).
- Hands on **code** → stitch (project skill), which pulls from design + ui.

The project `stitch` skill calls the user-level `stitch-design` skill for prompt work (enhance, sync). The user skill is the bridge to the Stitch MCP; the project skill is the bridge from Stitch output to Green Goods code.

## Activation

Triggered by phrases — not user-invocable as a slash command.

| Trigger | Action |
|---------|--------|
| "build from Stitch" / "implement this screen" | Default mode — fetch screen, download assets, implement on target surface |
| "create a Stitch prompt for X" / "enhance for Stitch" | Prompt mode — generate enhanced prompt from DESIGN.md |
| "sync DESIGN.md from Stitch" / "update design tokens" | Sync mode — refresh tokens from Stitch project back into DESIGN.md |

## Prerequisites

- Stitch MCP server connected (`claude mcp list` shows stitch as connected)
- `.stitch/config.json` with surfaces defined
- Global Stitch skills installed (`~/.claude/skills/stitch-design/`, `enhance-prompt/`, etc.)

## Multi-Project Architecture

`.stitch/config.json` supports many Stitch projects. Each project maps to a surface:

```json
{
  "surfaces": { "admin": { ... }, "client": { ... } },
  "projects": {
    "admin-hub-redesign": { "id": "abc123", "surface": "admin" },
    "client-onboarding": { "id": "def456", "surface": "client" }
  }
}
```

**Adding a project:** Call `list_projects`, pick one, and add it to `projects` with a descriptive key and the target surface.

**Removing a project:** Delete the key from `projects`. Surfaces are never removed — they are repo-level constants.

## Modes

### Default: Build from Stitch

User says: "build the Work view from Stitch" or "implement screen X"

**Step 1 — Resolve project**
1. Read `.stitch/config.json` for `projects`
2. Determine the target surface from context (admin or client)
3. Filter projects by that surface
4. If one match, use it. If multiple, ask the user to pick. If none, call `list_projects` and add a new entry.

**Step 2 — Find the screen**
1. Call `list_screens` with the project ID
2. Match the user's description to a screen name
3. If ambiguous, list screens and ask the user to pick

**Step 3 — Fetch screen metadata**
1. Call `get_screen` with project and screen IDs
2. Extract `htmlCode.downloadUrl` and `screenshot.downloadUrl`
3. Download both using the fetch script (assets organized by project key):
   ```bash
   scripts/fetch-stitch.sh "<htmlCode.downloadUrl>" ".stitch/designs/<project-key>/<screen-name>.html"
   scripts/fetch-stitch.sh "<screenshot.downloadUrl>=w<width>" ".stitch/designs/<project-key>/<screen-name>.png"
   ```
4. Read the downloaded HTML to understand the design structure
5. Read the screenshot to see the visual reference

**Step 4 — Map to target surface**
1. Look up the surface from the project's entry in config (`projects.<key>.surface`)
2. Read the surface's DESIGN.md (`packages/admin/DESIGN.md` or `packages/client/DESIGN.md`)
3. Read the root `DESIGN.md` for shared tokens

**Step 5 — Implement**
For the **admin** surface:
- Use existing `Admin*` M3 wrapper components (AdminCard, AdminFab, AdminIconButton, etc.)
- Use `CanvasLayout` with CSS Grid named areas
- Use sheets from context (LeftSheet, BottomSheet, RightSheet)
- Import hooks from `@green-goods/shared` (never create hooks in admin)
- Follow M3 strict anatomy from `packages/admin/DESIGN.md`

For the **client** surface:
- Use shared components from `@green-goods/shared`
- Follow the adaptive shell pattern (browser vs PWA)
- Import hooks from `@green-goods/shared`

**Step 6 — Verify**
- Run `bun dev:admin` (or `bun dev:client`)
- Review in browser (Chrome MCP if available)
- Compare against the downloaded screenshot

### Prompt: Generate a Stitch prompt

User says: "create a Stitch prompt for X" or "enhance this for Stitch"

1. Read the target surface's DESIGN.md
2. Read root DESIGN.md
3. Use the `enhance-prompt` global skill patterns to structure the prompt:
   - Add design system block with exact tokens from DESIGN.md
   - Add UI/UX keywords and atmosphere descriptors
   - Structure as numbered page sections
4. Output the enhanced prompt for the user to paste into stitch.withgoogle.com

### Sync: Update DESIGN.md from Stitch

User says: "sync DESIGN.md from Stitch" or "update design tokens"

1. Call `get_project` to fetch project-level design theme
2. Call `list_screens` and `get_screen` for each screen
3. Analyze the design patterns across screens
4. Update the relevant DESIGN.md files with any new tokens or patterns
5. Preserve the existing DESIGN.md structure — only update values that changed

## Important

- **Never generate generic React.** Always use the project's existing component system.
- **Screenshots are the source of truth.** HTML from Stitch is a reference, not a template.
- **One screen at a time.** Don't try to implement multiple screens in one pass.
- **The DESIGN.md files are bidirectional.** They inform Stitch prompts AND constrain implementation.

## Anti-Patterns

| Don't | Why |
|-------|-----|
| Generate generic React components | Breaks the project's design system; always use existing `Admin*` / shared components |
| Implement from Stitch HTML alone | HTML is reference-only; screenshots are the source of truth |
| Batch multiple screens in one pass | Each screen needs focused mapping to the surface's DESIGN.md; quality degrades |
| Ignore DESIGN.md constraints | DESIGN.md files are bidirectional — they constrain what's buildable |
| Create hooks in `packages/admin` or `packages/client` | Violates hook boundary — hooks live in `@green-goods/shared` |
| Skip the `.stitch/config.json` project lookup | Assets get stored against the wrong project key; future syncs conflict |

## Related Skills

- `ui` — TailwindCSS, Radix, component composition rules that Stitch output maps to
- `design` — Design direction and spatial UI language that DESIGN.md files express
- `react` — Component architecture and state patterns for the generated code
- `testing` — Storybook stories and a11y coverage for the implemented screen
