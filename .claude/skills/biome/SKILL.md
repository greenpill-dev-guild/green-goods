---
name: biome
description: Biome formatter and import organizer - fast Rust-based code formatting. Use for formatting configuration, import organization, and migration from Prettier.
version: "1.1"
last_updated: "2026-02-09"
last_verified: "2026-02-09"
status: proven
packages: [shared, client, admin, indexer, agent]
dependencies: []
---

# Biome Skill

Code formatting with Biome — the Rust-based formatter that replaces Prettier in this project.

---

## Activation

When invoked:
- Run `bun format` to format the entire workspace.
- Edit `biome.json` at the project root for configuration changes.
- Biome handles formatting only — linting is done by oxlint.

## Part 1: Configuration

### Root Config (`biome.json`)

Green Goods uses Biome with these settings:

| Setting | Value | Notes |
|---------|-------|-------|
| Indent style | `space` | 2-space indentation |
| Line width | `100` | Characters per line |
| Quote style | `double` | Double quotes for strings |
| Trailing commas | `es5` | Trailing commas where ES5 allows |
| Semicolons | `always` | Always use semicolons |
| Line ending | `lf` | Unix line endings |
| Arrow parens | `always` | Always parenthesize arrow params |

### Key Design Decisions

**Formatting only, no linting:**
```json
{
  "linter": { "enabled": false },
  "formatter": { "enabled": true }
}
```

Biome's linter is disabled because **oxlint** handles linting across the project. This avoids rule conflicts.

**Import organization is enabled:**
```json
{
  "assist": { "actions": { "source": { "organizeImports": "on" } } }
}
```

Biome automatically sorts and groups imports on format.

### Scoped Formatting

Biome only formats specific package directories — it won't touch `node_modules`, `dist`, `out`, contract artifacts, or CSS files:

```json
{
  "formatter": {
    "includes": [
      "**/packages/client/src/**/*.{ts,tsx,js,jsx,json}",
      "**/packages/admin/src/**/*.{ts,tsx,js,jsx,json}",
      "**/packages/shared/src/**/*.{ts,tsx,js,jsx,json}",
      "**/packages/indexer/**/*.{ts,tsx,js,jsx,json}",
      "**/packages/agent/src/**/*.{ts,tsx,js,jsx,json}",
      "**/packages/contracts/src/**/*.{ts,tsx,js,jsx}",
      "**/packages/contracts/script/**/*.{ts,tsx,js,jsx}"
    ]
  }
}
```

## Part 2: Usage

### Commands

```bash
# Format entire workspace
bun format

# Check formatting without writing (CI)
bunx biome check --write=false

# Format a specific file
bunx biome format --write packages/shared/src/hooks/auth/useAuth.ts

# Check import organization
bunx biome check --assist-enabled=true
```

### Editor Integration

**VS Code:**
1. Install the "Biome" extension (`biomejs.biome`)
2. Set as default formatter for TS/TSX/JS/JSX files
3. Enable "Format on Save"
4. Disable Prettier extension to avoid conflicts

**Settings snippet (`settings.json`):**
```json
{
  "[typescript]": { "editor.defaultFormatter": "biomejs.biome" },
  "[typescriptreact]": { "editor.defaultFormatter": "biomejs.biome" },
  "[javascript]": { "editor.defaultFormatter": "biomejs.biome" },
  "[json]": { "editor.defaultFormatter": "biomejs.biome" },
  "editor.formatOnSave": true
}
```

**Other editors:** Biome has plugins for Zed, Neovim (via LSP), and JetBrains IDEs.

## Part 3: Differences from Prettier

| Behavior | Prettier | Biome |
|----------|----------|-------|
| Speed | ~1s for project | ~30ms for project (35x faster) |
| Import sorting | Requires plugin | Built-in (`organizeImports`) |
| JSON formatting | Trailing commas allowed | `"trailingCommas": "none"` for JSON |
| CSS formatting | Supported | **Not used** — CSS excluded from formatting |
| Markdown | Supported | Supported (included in scope) |
| Config format | `.prettierrc` | `biome.json` |
| Ignore file | `.prettierignore` | `includes`/`excludes` in `biome.json` |

### Migration Notes (Prettier → Biome)

If adding a file or package that previously used Prettier:

1. Remove `.prettierrc`, `.prettierignore` from the package
2. Remove `prettier` from `devDependencies`
3. Add the package's source paths to `biome.json` `includes`
4. Run `bun format` to reformat everything at once
5. Commit the reformatted files as a single `chore: migrate to Biome formatting` commit

### CI Integration

```yaml
# In GitHub Actions workflow
- name: Check formatting
  run: bunx biome check --write=false

# Biome is ~35x faster than Prettier, so CI checks are near-instant
# No caching needed for formatting checks
```

## Part 4: Contracts Exception

Solidity files are NOT formatted by Biome. Contracts use **forge fmt**:

```bash
# Format Solidity (separate tool)
cd packages/contracts && forge fmt

# The contracts package also has its own biome.json
# for TypeScript files in script/ and src/
```

## Anti-Patterns

- **Never disable Biome formatting** — Run `bun format` before committing
- **Never use Prettier alongside Biome** — They conflict on formatting decisions; remove Prettier if found
- **Never add CSS to Biome scope** — TailwindCSS v4 handles CSS formatting via PostCSS
- **Never manually sort imports** — Biome's `organizeImports` handles it automatically
- **Never fight Biome's line-breaking** — Accept its formatting decisions near line-width boundaries
- **Never create package-level `biome.json`** — Use the root config; only exception is `packages/contracts/`
- **Never run Biome on generated files** — Exclude `dist/`, `out/`, `generated/`, contract ABIs
- **Never commit unformatted code** — CI will catch it, but it wastes a round-trip

## Quick Reference

```bash
# Before committing
bun format && bun lint

# Full validation
bun format && bun lint && bun run test && bun build

# Check if formatting is clean (CI mode)
bunx biome check --write=false
```

## Related Skills

- `ci-cd` — CI pipeline runs Biome check as a status gate
- `vite` — Build configuration (Biome runs pre-build)
- `contracts` — Solidity uses forge fmt, not Biome
- `performance` — Biome's speed eliminates formatting as a CI bottleneck
- `git-workflow` — `bun format` is part of pre-commit validation
