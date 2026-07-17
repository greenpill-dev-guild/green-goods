# Wave 8 — Vite 8 Compatibility Audit

**Branch**: `chore/dependency-upgrades`
**Status**: read-only migration audit complete; implementation waits on Waves 6 and 7

## Exact graph

| Package | Current | Target | Result |
|---|---:|---:|---|
| Vite | 7.3.6 | 8.1.4 | Node floor already covered after Wave 7; source/config migration required |
| `@vitejs/plugin-react` | 5.2.0 | 6.0.3 | Vite 8 only; Babel options removed |
| `@rolldown/plugin-babel` | not direct | 0.2.3 | Required by plugin-react 6 for React Compiler |
| `@babel/core` | 7.29.0 transitive | 7.29.7 direct | Supported by the Rolldown Babel plugin and React Compiler |
| `@types/babel__core` | 7.20.5 transitive | 7.20.5 direct | Required for typed Vite configuration |

Every target above is more than three days old on 2026-07-16. Final tarball, lifecycle,
registry, and frozen-install checks remain mandatory when the registry is reachable.

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

## Primary migration sources

- [Vite 8 migration from v7](https://vite.dev/guide/migration)
- [Vite 8 announcement](https://vite.dev/blog/announcing-vite8)
- [Plugin React 6 Babel and React Compiler migration](https://github.com/vitejs/vite-plugin-react/releases/tag/plugin-react%406.0.0)
- [Rolldown manual code splitting](https://rolldown.rs/in-depth/manual-code-splitting)
- [Rolldown Babel plugin](https://www.npmjs.com/package/@rolldown/plugin-babel)
