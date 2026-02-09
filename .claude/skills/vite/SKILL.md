---
name: vite
description: Vite 7.x build tool. Use when configuring Vite, adding plugins, working with dev server, or building.
version: "1.0"
last_updated: "2026-02-08"
last_verified: "2026-02-09"
status: proven
packages: [client, admin]
dependencies: []
---

# Vite Skill

Modern build tool for frontend development with instant server start and lightning-fast HMR.

**Source**: [antfu/skills](https://github.com/antfu/skills)

---

## Activation

When invoked:
- Inspect existing config before proposing changes.
- Keep root `.env` only (no package-level env files).
- Preserve React Compiler and PWA setup unless the request is explicit.

## Green Goods Defaults

- Client config: `packages/client/vite.config.ts`
- Admin config: `packages/admin/vite.config.ts`
- Shared defaults: root `.env` + `dotenv-expand` usage

Prefer editing existing config files over introducing new patterns.

## Why Vite for Green Goods

- **Native ESM**: Instant dev server start (no bundling)
- **Fast HMR**: Sub-50ms hot module replacement
- **Optimized build**: Rollup-based production builds
- **TypeScript native**: First-class support, no config
- **React 19 ready**: Full support for latest React

---

## Configuration (Generic Example)

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      "@": "/src",
    },
  },

  build: {
    target: "esnext",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          query: ["@tanstack/react-query"],
        },
      },
    },
  },

  server: {
    port: 3001,
    strictPort: true,
  },
});
```

### Conditional Config

```typescript
export default defineConfig(({ command, mode }) => {
  if (command === "serve") {
    return { /* dev config */ };
  }
  return { /* build config */ };
});
```

### Async Config

```typescript
export default defineConfig(async () => {
  const data = await fetchConfig();
  return { /* config using data */ };
});
```

---

## Environment Variables

### File Priority (Vite Default)

```
.env                # All modes
.env.local          # All modes, git-ignored
.env.[mode]         # Specific mode (development, production)
.env.[mode].local   # Specific mode, git-ignored
```

> **Green Goods Note:** This project intentionally uses a **single root `.env`** file instead of the full Vite multi-file priority system. This keeps tooling simple (KISS principle) and ensures one chain per deployment (`VITE_CHAIN_ID`). Avoid creating mode-specific env files.

### Usage

```typescript
// Access in code (must be prefixed with VITE_)
const chainId = import.meta.env.VITE_CHAIN_ID;
const apiUrl = import.meta.env.VITE_API_URL;

// Built-in variables
import.meta.env.MODE      // "development" | "production"
import.meta.env.DEV       // true in dev
import.meta.env.PROD      // true in prod
import.meta.env.BASE_URL  // Base URL
```

### TypeScript Definitions

```typescript
// env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHAIN_ID: string;
  readonly VITE_API_URL: string;
  readonly VITE_PIMLICO_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

---

## Static Assets

### Importing Assets

```typescript
// URL import
import logo from "./logo.png";
// → /assets/logo.abc123.png

// Raw import
import shader from "./shader.glsl?raw";

// URL string
import workerUrl from "./worker.js?url";

// Web Worker
import Worker from "./worker.js?worker";
```

### Public Directory

Files in `/public` are served at root and copied as-is:

```
public/
  favicon.ico    → /favicon.ico
  manifest.json  → /manifest.json
```

---

## Glob Imports

```typescript
// Import all modules
const modules = import.meta.glob("./modules/*.ts");
// { "./modules/a.ts": () => import("./modules/a.ts"), ... }

// Eager loading
const modules = import.meta.glob("./modules/*.ts", { eager: true });
// { "./modules/a.ts": { default: ... }, ... }

// Named imports
const modules = import.meta.glob("./modules/*.ts", {
  import: "setup",
});

// Multiple patterns
const modules = import.meta.glob([
  "./modules/*.ts",
  "./plugins/*.ts",
]);
```

---

## CSS Handling

### CSS Modules

```typescript
// Component.module.css
.card { ... }

// Component.tsx
import styles from "./Component.module.css";
<div className={styles.card} />
```

### PostCSS

```javascript
// postcss.config.js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

### Pre-processors

```typescript
// Install: bun add -D sass
import "./styles.scss";
```

---

## Build Optimization

### Code Splitting

```typescript
// Dynamic imports create chunks
const GardenMap = lazy(() => import("./GardenMap"));

// Manual chunks
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        "vendor-react": ["react", "react-dom"],
        "vendor-query": ["@tanstack/react-query"],
        "vendor-web3": ["wagmi", "viem"],
      },
    },
  },
},
```

### Bundle Analysis

```bash
# Generate stats
npx vite-bundle-visualizer
```

---

## CLI Commands

```bash
# Development server
vite                    # Start dev server
vite --port 3001        # Custom port
vite --host             # Expose to network

# Build
vite build              # Production build
vite build --mode staging  # Custom mode

# Preview
vite preview            # Preview production build

# Optimize
vite optimize           # Pre-bundle dependencies
```

---

## Green Goods Specifics

### PWA Configuration

```typescript
// vite.config.ts with PWA plugin
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Green Goods",
        short_name: "GreenGoods",
        theme_color: "#1FC16B",
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
      },
    }),
  ],
});
```

### Multi-Package Setup

```typescript
// packages/client/vite.config.ts
export default defineConfig({
  resolve: {
    alias: {
      "@green-goods/shared": path.resolve(__dirname, "../shared/src"),
    },
  },
  optimizeDeps: {
    include: ["@green-goods/shared"],
  },
});
```

---

## Decision Tree

```
What Vite work?
│
├─► Environment variables? ────► Environment Variables section
│                                 → Must prefix with VITE_
│                                 → Single root .env only
│                                 → Update env.d.ts for TypeScript
│
├─► Build optimization? ───────► Build Optimization section
│                                 → Code splitting with lazy()
│                                 → Manual chunks for vendors
│                                 → Bundle analysis with vite-bundle-visualizer
│
├─► Adding a plugin? ──────────► Configuration section
│                                 → Add to plugins array
│                                 → Check for config conflicts
│                                 → Preserve existing React + PWA setup
│
├─► PWA/service worker? ───────► Green Goods Specifics → PWA
│                                 → VitePWA plugin config
│                                 → Workbox glob patterns
│                                 → registerType: "autoUpdate"
│
├─► Asset handling? ───────────► Static Assets section
│                                 → URL import (default)
│                                 → ?raw for text content
│                                 → ?worker for Web Workers
│                                 → /public for unprocessed files
│
├─► CSS/styling? ──────────────► CSS Handling section
│                                 → PostCSS + Tailwind (default)
│                                 → CSS modules for isolation
│                                 → Pre-processors if needed
│
└─► Debugging build? ──────────► Troubleshooting table
                                  → DEBUG=vite:* for verbose
                                  → Check alias, deps, env prefix
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Slow initial load | Check `optimizeDeps.include` for missing deps |
| HMR not working | Ensure component has named export |
| Import errors | Check `resolve.alias` configuration |
| Build fails | Run `vite build --debug` for details |
| ENV not available | Ensure `VITE_` prefix on variables |

## Related Skills

- `performance` — Bundle analysis and optimization that Vite enables
- `react` — React project configuration and HMR patterns
- `deployment` — Build artifact hosting and release workflows
- `data-layer` — Data-layer and caching strategies that supersede the old offline/PWA approach
