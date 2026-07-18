# Wave 8 — Vite 8 Compatibility Audit

**Branch**: `chore/dependency-upgrades`
**Status**: automated implementation green; host audit comparison pending

## Exact graph

| Package | Current | Target | Result |
|---|---:|---:|---|
| Vite | 7.3.6 | 8.1.4 | Implemented and exact-pinned across root, client, and admin |
| `@vitejs/plugin-react` | 5.2.0 | 6.0.3 | Implemented with the removed Babel option migrated |
| `@rolldown/plugin-babel` | not direct | 0.2.3 | Implemented for explicit React Compiler integration |
| `@babel/core` | 7.29.0 transitive | 7.29.7 direct | Implemented and typed for the Rolldown Babel plugin |
| `@types/babel__core` | 7.20.5 transitive | 7.20.5 direct | Implemented for typed Vite configuration |

Every target above was more than three days old at implementation. The fresh Bun 1.3.14 frozen
install and checked-in release-age policy pass. The audit endpoint still returns HTTP 403 inside
Codex, so the host comparison against the Wave 6 `0 critical / 29 high` baseline remains open.

## Compatibility findings

1. **Stage Vite first.** Plugin React 5.2.0 already declares Vite 8 compatibility, so Vite can be
   upgraded and its Rolldown/Oxc config changes proven before plugin-react removes Babel support.
2. **React Compiler moves to an explicit plugin.** Client and admin currently pass
   `babel-plugin-react-compiler` through `react({ babel: ... })`. Plugin React 6 removes that
   option. Both apps must use `react()` plus `babel({ presets: [reactCompilerPreset()] })` from
   `@rolldown/plugin-babel`. Storybook and Vitest use `react()` without Compiler options and need no
   equivalent Babel plugin.
3. **Client Oxc config is mechanical.** Replace `esbuild.jsxDev` with
   `oxc.jsx.development`; do not rely on Vite 8's temporary esbuild compatibility layer.
4. **Admin chunking needs the Rolldown-native shape.** Replace
   `build.rollupOptions.output.manualChunks` with
   `build.rolldownOptions.output.codeSplitting.groups` for the existing web3 and observability
   regexes. Preserve the current intent that React stays outside those groups. If explicit-only
   grouping is required, validate `includeDependenciesRecursively: false` and execution order from
   the emitted bundle before accepting it.
5. **Adjacent peers already support Vite 8.** Storybook 10.4.6, Vite PWA 1.3.0,
   Tailwind's Vite adapter 4.2.4, and mkcert 2.1.0 all declare Vite 8-compatible peer ranges in the
   rehearsed lock graph.

## RED/GREEN contracts

- Vite 8 alone: config typecheck, client/admin production builds, Storybook static build, PWA
  precache budget, source-map cleanup behavior, and dev startup.
- Plugin React 6: first capture the removed `babel` option as RED, then add the official
  Rolldown Babel + `reactCompilerPreset` integration and prove compiler output remains present.
- Admin chunking: compare emitted chunk names/imports and run the built admin entry so a duplicate
  React instance, TDZ cycle, or missing runtime chunk fails the wave.
- Client Oxc: compare dev/build JSX behavior and source maps; no deprecated `esbuild` option remains.
- Final checkpoint: frozen Bun 1.3.14 install, high audit, all browser builds, Storybook, PWA,
  deterministic source maps, and the authenticated-route QA allowed by the current session scope.

## Implementation evidence

### Staged migration

- Vite 8.1.4 was staged first with plugin-react 5.2.0. Client, admin, and Storybook builds passed,
  proving the Vite/Rolldown boundary before the plugin-react migration.
- The old plugin-react configuration was RED: a transformed client component had neither the
  Compiler runtime import nor the memo sentinel. The official `react()` plus
  `babel({ presets: [reactCompilerPreset()] })` integration is GREEN and emits both.
- `esbuild.jsxDev` was replaced by `oxc.jsx.development`; Vite no longer reports the ignored
  esbuild option.
- Admin manual chunks moved to ordered Rolldown `codeSplitting.groups` for React, Web3, and
  observability. An initial explicit-only grouping reproduced a built-entry initialization error;
  recursive groups plus a higher-priority React group repaired the graph. The built entry then
  initialized under jsdom with no TDZ or duplicate-React failure.

### Lock-graph repair

Bun initially retained Vitest's old nested Vite 7.3.6 resolution because Vitest accepts a broad
`^6 || ^7 || ^8` dependency range. That split graph made production builds use Vite 8 while tests
transformed shared TSX through Vite 7, reproducing `React is not defined`. A compatible root
`vite: 8.1.4` override now forces the whole graph onto one Vite instance. A fresh frozen install
shows Vitest linked to Vite 8.1.4, and the unchanged 38-test reproduction file passes. No component
or Vitest workaround was added.

### Green proof

| Proof | Result |
|---|---|
| Bun 1.3.14 frozen install on Node 22 | Pass; 3,504 installs / 3,635 packages |
| Vite graph | One Vite 8.1.4 resolution; plugin-react 6.0.3; Vitest 4.1.10 |
| Client tests | 83 files, 640 tests passed |
| Admin tests | 74 files, 539 tests passed |
| Shared tests | 286 files, 3,357 passed / 1 skipped |
| Client deterministic build | Pass; Vite 8.1.4; PWA 21 entries / 0.44 MiB |
| Admin deterministic build | Pass; Vite 8.1.4; Rolldown groups emitted and initialized |
| Source-map lane | Maps emitted when enabled; cleanup leaves zero public `.map` files |
| Storybook static build | Pass on Storybook 10.4.6 and Vite 8.1.4 |
| Story coverage / quality | 197/197 surfaces; 169 story files pass quality guards |
| Client and admin dev startup | Ready on Vite 8 with no dependency-reoptimization loop |
| Security audit | Host rerun pending; Codex endpoint returns HTTP 403 |

Authenticated Brave proof remains explicitly waived for this dependency program. No public API,
query key, persisted format, route contract, service-worker contract, or user-facing behavior was
intentionally changed.

## Primary migration sources

- [Vite 8 migration from v7](https://vite.dev/guide/migration)
- [Vite 8 announcement](https://vite.dev/blog/announcing-vite8)
- [Plugin React 6 Babel and React Compiler migration](https://github.com/vitejs/vite-plugin-react/releases/tag/plugin-react%406.0.0)
- [Rolldown manual code splitting](https://rolldown.rs/in-depth/manual-code-splitting)
- [Rolldown Babel plugin](https://www.npmjs.com/package/@rolldown/plugin-babel)
