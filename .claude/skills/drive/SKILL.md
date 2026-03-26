---
name: drive
description: Finds, sorts, and reads Google Drive meeting notes across Greenpill shared drives. Activates for checking new notes, sorting them into folders, or reading specific documents.
argument-hint: "[sort-notes | read <search term> | list <drive name>]"
version: "1.0.0"
status: active
packages: []
dependencies: []
last_updated: "2026-03-22"
last_verified: "2026-03-22"
allowed-tools:
  - mcp__gdrive__drive_list_drives
  - mcp__gdrive__drive_list
  - mcp__gdrive__drive_search
  - mcp__gdrive__drive_read
  - mcp__gdrive__drive_move
  - mcp__gdrive__drive_get_folder_id
mode: interactive
triggers: ["Google Drive","meeting notes drive","sort notes","read doc"]
---

# Google Drive Integration

Interact with Greenpill shared drives — find new meeting notes, sort them into the correct folders, and read their content.

Arguments passed: `$ARGUMENTS`

## Shared Drives Reference

| Drive | ID | Purpose |
|---|---|---|
| Gardens | `0ALUt-0VHWOLRUk9PVA` | Gardens protocol work |
| Greenpill Cali | `0ALfvQq_hTxcnUk9PVA` | California chapter |
| Greenpill Dev Guild | `0ABiNAIIkFtjrUk9PVA` | Engineering, community, growth, leads |
| Greenpill Network | `0ADPqiYLt4dW0Uk9PVA` | Network-wide: chapters, community, guilds, stewards |
| Greenpill Nigeria | `0ANNvoNQ3tROjUk9PVA` | Nigeria chapter operations |
| Regen Coordination | `0AHKbTaY-pk03Uk9PVA` | Cross-org regen coordination |

## Activation

| Trigger | Action |
|---------|--------|
| `/drive sort-notes` | Find and sort recent meeting notes |
| `/drive read <term>` | Read a specific document by search term |
| `/drive list <drive>` | Browse a shared drive's contents |
| `/drive` (no args) | Show status overview of recent activity |

## Part 1: Dispatch on arguments

### `sort-notes` — Find and sort new meeting notes

This is the primary workflow. It finds unsorted Gemini meeting notes and moves them to the correct `Sync/` folders.

**Step 1: Find recent notes**

Use `drive_search` with:
- `nameContains`: "Notes by Gemini"
- `mimeType`: "application/vnd.google-apps.document"
- `modifiedAfter`: last 7 days (or specify a date)

**Step 2: Classify each note**

Match the meeting name against these routing rules. The meeting name is everything before the date in the filename.

| Pattern (in meeting name) | Target Drive | Target Folder Path |
|---|---|---|
| `Community Sync` | Greenpill Dev Guild | `Community/Sync` |
| `Lead Sync`, `Cohort Lead` | Greenpill Dev Guild | `Leads/Sync` |
| `BD Sync`, `BD ` | Greenpill Dev Guild | `Growth/Sync` |
| `AI Coding`, `RealFi`, `Engineering` | Greenpill Dev Guild | `Engineering/Sync` |
| `Tech & Sun`, `Nigeria` | Greenpill Nigeria | root (already correct) |
| `Growth Working Group` | Greenpill Network | `Growth` |
| `Gardens Core`, `Gardens ` | Gardens | root |
| `Coffee Meet`, `Onboarding` | Keep in place (1:1 meetings) |
| `IRL Sync`, `Regen` | Greenpill Network | `Regen Protocols` |

**Step 3: Check if already sorted**

For each note, check if its current `parentId` already matches the target folder. Skip if already in the right place.

**Step 4: Present plan**

Before moving anything, show the user a table:

```markdown
## Notes to Sort

| # | Meeting | Date | Current Location | → Target |
|---|---------|------|------------------|----------|
| 1 | Tech & Sun Weekly Sync | 2026-01-27 | Nigeria root | ✅ Already correct |
| 2 | Growth Working Group | 2025-08-22 | Network/Growth | → Network/Growth/Sync |

Move 1 file? (y/n)
```

**Step 5: Move files**

After user confirmation, use `drive_get_folder_id` to resolve the target path to an ID, then `drive_move` for each file.

**Step 6: Optionally extract action items**

After sorting, ask: "Want me to read any of these notes and extract action items?" If yes, use `drive_read` to export the doc, then invoke the `/meeting-notes` skill with the content.

### `read <search term>` — Read a specific document

1. Use `drive_search` with the search term as `nameContains`
2. If multiple results, present a numbered list and ask which one
3. Use `drive_read` with the selected file ID
4. Output the content

### `list <drive name>` — Browse a shared drive

1. Match the drive name to the reference table above
2. Use `drive_list` with the drive ID
3. If the user specifies a subfolder path, use `drive_get_folder_id` first

### No args — status overview

1. Call `drive_list_drives` to show all accessible drives
2. Call `drive_search` for notes modified in the last 48 hours
3. Show a summary of recent activity and any unsorted notes

## Anti-Patterns

- **Don't move files without showing the plan first** — always present and confirm
- **Don't move 1:1 / Coffee Meet notes** — these are personal, leave them where they are
- **Don't create folders** — if a target folder doesn't exist, flag it and ask the user
- **Don't read every file** — only export content when explicitly asked or for action item extraction

## Related Skills

- `meeting-notes` — extract action items from drive documents
