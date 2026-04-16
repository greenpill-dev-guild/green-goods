---
name: stitch
description: "Stitch-to-code pipeline — fetch designs from Stitch projects, download assets, and implement using existing package components. Use when the user says 'build from Stitch', 'implement this screen', or references a Stitch project."
version: "1.0.0"
status: active
packages: ["admin", "client"]
dependencies: ["ui", "design"]
last_updated: "2026-04-15"
last_verified: "2026-04-15"
---

# Stitch Build Skill

Bridge between Google Stitch designs and codebase implementation. Fetches screens from Stitch, downloads assets locally, and implements using the project's existing component system.

## Prerequisites

- Stitch MCP server connected (`claude mcp list` shows stitch as connected)
- `.stitch/config.json` with a valid `projectId`
- Global Stitch skills installed (`~/.claude/skills/stitch-design/`, `enhance-prompt/`, etc.)

## Modes

### Default: Build from Stitch

User says: "build the Work view from Stitch" or "implement screen X"

**Step 1 — Resolve project**
1. Read `.stitch/config.json` for `projectId`
2. If empty, call `list_projects` and ask the user to pick one
3. Save the chosen ID back to config

**Step 2 — Find the screen**
1. Call `list_screens` with the project ID
2. Match the user's description to a screen name
3. If ambiguous, list screens and ask the user to pick

**Step 3 — Fetch screen metadata**
1. Call `get_screen` with project and screen IDs
2. Extract `htmlCode.downloadUrl` and `screenshot.downloadUrl`
3. Download both using the fetch script:
   ```bash
   scripts/fetch-stitch.sh "<htmlCode.downloadUrl>" ".stitch/designs/<screen-name>.html"
   scripts/fetch-stitch.sh "<screenshot.downloadUrl>=w<width>" ".stitch/designs/<screen-name>.png"
   ```
4. Read the downloaded HTML to understand the design structure
5. Read the screenshot to see the visual reference

**Step 4 — Map to target surface**
1. Identify the target surface from `.stitch/config.json` (admin or client)
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
