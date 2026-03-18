# Biome Formatting (ops sub-file)

> Deep reference for the [ops skill](./SKILL.md). Covers Biome configuration, import organization, editor setup, Prettier migration, and the contracts exception (forge fmt).

---

## Configuration

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

Biome only formats specific package directories -- it won't touch `node_modules`, `dist`, `out`, contract artifacts, or CSS files:

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

---

## Usage

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

---

## Differences from Prettier

| Behavior | Prettier | Biome |
|----------|----------|-------|
| Speed | ~1s for project | ~30ms for project (35x faster) |
| Import sorting | Requires plugin | Built-in (`organizeImports`) |
| JSON formatting | Trailing commas allowed | `"trailingCommas": "none"` for JSON |
| CSS formatting | Supported | **Not used** -- CSS excluded from formatting |
| Markdown | Supported | Supported (included in scope) |
| Config format | `.prettierrc` | `biome.json` |
| Ignore file | `.prettierignore` | `includes`/`excludes` in `biome.json` |

### Migration Notes (Prettier -> Biome)

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

---

## Contracts Exception

Solidity files are NOT formatted by Biome. Contracts use **forge fmt**:

```bash
# Format Solidity (separate tool)
cd packages/contracts && forge fmt

# The contracts package also has its own biome.json
# for TypeScript files in script/ and src/
```
