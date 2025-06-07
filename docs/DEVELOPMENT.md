# Development Setup Guide

This guide will help you set up the Green Goods development environment with the proper tooling.

## Prerequisites

- Node.js (v20 or higher)
- pnpm (v9.x)
- Git
- VS Code (recommended)

## IDE Setup

### VS Code Extensions (Recommended)

Install these extensions for the best development experience:

1. **Biome** (`biomejs.biome`) - Formatting and linting
2. **Solidity** (`nomicfoundation.hardhat-solidity`) - Solidity language support
3. **Even Better TOML** (`tamasfe.even-better-toml`) - TOML file support
4. **GitLens** (`eamodio.gitlens`) - Git integration
5. **Error Lens** (`usernamehw.errorlens`) - Inline error display

### VS Code Settings

The project includes pre-configured VS Code settings in `.vscode/settings.json` that:
- Sets Biome as the default formatter for JS/TS files
- Enables format on save
- Configures automatic import organization
- Sets up proper formatters for different file types

## Code Quality Tools

### Biome 

Biome is our primary tool for formatting and linting JavaScript/TypeScript code.

**Available Commands:**
```bash
# Format all files
pnpm format

# Check formatting without applying changes  
pnpm format:check

# Lint and check code quality (includes Biome + ESLint)
pnpm lint
```

**Key Features:**
- ⚡ **Fast**: 35x faster than Prettier
- 🔧 **Auto-fix**: Automatic import organization and formatting
- 📝 **Linting**: Built-in rules for code quality
- 🎯 **TypeScript**: Native TypeScript support

### ESLint

ESLint is used alongside Biome for additional React and TypeScript-specific rules.

### Solidity

Solidity files are formatted using Forge's built-in formatter.

## Development Workflow

### 1. Before Committing

Always run these commands before committing:

```bash
# Format code
pnpm format

# Run tests
pnpm test

# Check for linting issues
pnpm lint
```

### 2. Auto-formatting

With the VS Code setup, files will be automatically formatted on save. You can also:

- **Format current file**: `Ctrl/Cmd + Shift + P` → "Format Document"
- **Organize imports**: `Ctrl/Cmd + Shift + P` → "Organize Imports"

### 3. Package-specific Development

```bash
# Work on client only
pnpm --filter client dev

# Work on contracts only  
pnpm --filter contracts dev

# Run tests for specific package
pnpm --filter client test
```

## Configuration Files

### Biome Configuration

- **Root**: `biome.json` - Project-wide settings
- **Client**: `packages/client/biome.json` - React/TS specific rules  
- **Contracts**: `packages/contracts/biome.json` - Solidity formatting

### Key Settings

- **Line width**: 100 characters (120 for Solidity)
- **Indentation**: 2 spaces (4 for Solidity)
- **Quotes**: Double quotes
- **Semicolons**: Always
- **Trailing commas**: ES5 style

## Troubleshooting

### Biome Issues

If Biome isn't working:
1. Restart VS Code
2. Check the Biome extension is installed and enabled
3. Verify `node_modules/.bin/biome` exists
4. Run `pnpm install` to ensure dependencies are installed

### Performance

Biome is significantly faster than Prettier:
- **Formatting**: ~35x faster
- **Linting**: Comparable to ESLint with better error messages
- **Memory usage**: Lower memory footprint

### Migration from Prettier

If you encounter old Prettier comments or configuration:
- `/* prettier-ignore */` → `/* biome-ignore format: reason */`
- `.prettierrc` files have been removed and replaced with `biome.json`

## Editor Integration

### VS Code

The project is pre-configured for VS Code. After installing the Biome extension:
- Files format automatically on save
- Imports organize on save
- Inline linting errors appear

### Other Editors

Biome supports other editors too:
- **Neovim**: Via LSP
- **WebStorm**: Via plugin
- **Sublime**: Via package

## Git Hooks (Husky)

The project uses Husky to automatically run code quality checks:

### Pre-commit Hook
Automatically runs `lint-staged` on every commit to:
- Format staged JavaScript/TypeScript files with Biome
- Run Biome checks on staged files
- Format Solidity files in the contracts package

### Pre-push Hook
Runs comprehensive checks before pushing:
- Full format check across the entire codebase
- Linting with error-on-warnings for maximum code quality

### Manual Hook Testing
```bash
# Test pre-commit hook manually
pnpm lint-staged

# Test pre-push checks manually
pnpm format:check && pnpm lint --error-on-warnings
```

### Hook Configuration
- **Hooks location**: `.husky/` directory
- **Lint-staged config**: `package.json` → `"lint-staged"` section
- **Install**: Runs automatically via `pnpm install` (prepare script)

## Contributing

When contributing:
1. Code formatting and basic checks run automatically on commit (Husky pre-commit)
2. Follow the existing code style (enforced by Biome)
3. Comprehensive quality checks run automatically on push (Husky pre-push)
4. Manual commands available: `pnpm format`, `pnpm test`, `pnpm lint`

## Performance Comparison

| Tool | Formatting Time | Memory Usage |
|------|----------------|--------------|
| Biome | ~50ms | ~30MB |
| Prettier | ~1.8s | ~80MB |

*Times based on formatting ~225 files in this project* 