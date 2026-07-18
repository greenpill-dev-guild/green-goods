# Wave 4 UI and PWA

Captured on 2026-07-16 after the Wave 3 checkpoint at `1301adb99`.

## Changes

- Aligned Tailwind core, the Vite adapter, and the PostCSS adapter to exact `4.2.4` while
  intentionally holding Tailwind 4.3 until the core and adapters share one release train.
- Upgraded the used Radix families to their current compatible releases: Accordion `1.2.16`,
  Avatar `1.2.2`, Dialog `1.1.19`, Dropdown Menu `2.1.20`, Popover `1.1.19`, Select `2.3.3`, and
  Slot `1.3.0`.
- Upgraded tailwind-merge to `3.6.0`, Remixicon React to `4.9.0`, and Recharts to `3.9.2`.
- Upgraded vite-plugin-pwa to `1.3.0` and aligned Workbox Build and Window to `7.4.1`.
- No component, style, token, manifest, service-worker source, public API, persisted format, or
  application source changed; this wave is dependency-manifest-only.

## Compatibility Evidence

- All selected Radix packages accept React 19, and Recharts 3.9.2 accepts React 19.
- vite-plugin-pwa 1.3.0 supports Vite 7 and declares Workbox 7.4.1-compatible peers.
- Every selected release passed the three-day release-age gate.
- Modern Web Guidance was refreshed before validation; the compatibility target remains Baseline
  Widely Available and the existing semantic/accessibility contracts remain unchanged.

## Security and Supply Chain

- `bunx bun@1.3.14 install --frozen-lockfile`: **PASS**.
- `bunx bun@1.3.14 audit --audit-level=high`: **POLICY PASS**, with 0 critical and 63 transitive
  high findings, one fewer high finding than Wave 3.
- The root multiformats/uint8arrays overrides, resolutions, and postinstall shim remain unchanged.
- No trusted dependency, registry, git dependency, or lifecycle-script permission was added.

## Validation

| Command or gate | Result | Evidence |
|---|---|---|
| focused shared UI/PWA tests | PASS | 4 files and 52 tests cover navigation and service-worker/PWA behavior. |
| focused client UI/PWA tests | PASS | 7 files and 45 tests cover dialogs, update notification, manifest/routing, runtime, and custom service-worker behavior. |
| focused admin interaction tests | PASS | 3 files and 11 tests cover dialogs, instant exit, and selection behavior. |
| DesignMD/token/vocabulary gates | PASS | Generated design artifacts, runtime tokens, focus/material guards, and vocabulary checks passed. |
| Storybook contract and quality | PASS | 197/197 required surfaces have stories and all 169 audited story files satisfy quality guardrails. |
| Storybook browser tests | PASS | 39 files and 120 browser-story tests passed; 200 non-targeted files were intentionally skipped by the configured runner. |
| Storybook production build | PASS | Storybook 10.4.6 built successfully against Vite 7.3.6 and the upgraded UI dependencies. |
| deterministic Sepolia build | PASS | Contracts, shared, indexer, client, and admin built; Tailwind CSS emitted for both apps. |
| PWA generation and budget | PASS | PWA 1.3.0 generated `sw.js` with 21 precache entries; the 0.44 MiB total stayed within budget. |
| docs production build | PASS | Docusaurus built successfully with Remixicon 4.9.0 and Recharts 3.9.2. |
| Repo Quick Gate | PASS | Format, lint, typechecks, shared 3,357 tests, client 638 tests, admin hub 102 tests, and agent 230 tests passed. |

Authenticated Brave proof remains waived by Afo. Automated interaction tests, clean-room
Storybook browser tests, deterministic production builds, and generated PWA checks are the
accepted evidence for this wave and must not be represented as authenticated rendered proof.
