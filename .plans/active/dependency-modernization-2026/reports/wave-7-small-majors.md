# Wave 7 — Small Non-Contract Majors

**Branch**: `chore/dependency-upgrades`
**Status**: implementation and automated proof complete; host audit rerun pending

## Release-age and supply-chain gate

All exact targets exist on the public npm registry and were published more than three days before
the 2026-07-16 review. The inspected registry tarballs use npm registry artifacts rather than git
dependencies or alternate registries. No target adds a new `trustedDependencies` requirement.

| Family | Current resolved | Exact target | Published | Compatibility result |
|---|---:|---:|---|---|
| React Helmet Async | 2.0.5 | 3.0.0 | 2026-03-03 | React 19 supported; existing provider/component API retained |
| React Window | 1.8.11 | 2.2.7 | 2026-02-13 | React 19 supported; source migration required |
| React Day Picker | 9.13.0 | 10.0.1 | 2026-05-15 | Existing v9-current props, slots, and class keys remain valid |
| Babel parser/traverse/types | 7.29.x | 8.0.4 | 2026-07-09 | ESM-only; requires Node 22.18+; direct locale scanner is ESM |
| jsdom | 27.4.0 | 29.1.1 | 2026-04-30 | Requires Node 22.13+; root test runtime is compatible |
| js-yaml | 4.3.0 | 5.2.1 | 2026-07-02 | Source migration required; no ESM default export and option/schema changes |
| c8 | 10.1.3 | 11.0.0 | 2026-02-22 | Existing CLI contract retained; Node 22 supported |
| vite-plugin-mkcert | 1.17.12 | 2.1.0 | 2026-06-03 | Vite 7 supported; requires Node 22.19+ |
| Sentry CLI | 2.58.6 | 3.6.0 | 2026-06-26 | Used only through supported `sourcemaps inject/upload` CLI commands |

## Family migration contracts

1. **Helmet 3** — keep `HelmetProvider` and `Helmet` call sites. Add title/head behavior to the
   existing login regression suite, then run the client test/build checkpoint.
2. **React Window 2** — migrate `FixedSizeList` to `List`, `itemCount/itemSize` to
   `rowCount/rowHeight`, and the child renderer to `rowComponent/rowProps`. Preserve the 40-member
   virtualization threshold, 600px viewport, 64px rows, selection dialog behavior, and public
   `GardenGardeners` props/ref. Remove the obsolete ambient v1 declaration because v2 ships types.
3. **Day Picker 10** — retain the `react-day-picker` compatibility package name required by the
   approved plan. The wrappers already use current v9 names (`month_grid`, `button_previous`,
   `button_next`, `selected`, `disabled`) and no removed v9 compatibility API was found.
4. **Babel 8** — exact-pin the three directly consumed AST packages without overriding Babel 7
   used by Vite/Storybook. Prove the locale scanner under Node 22 ESM. Raise the root Node floor once
   to 22.19 so both Babel 8 and mkcert 2 are honestly covered.
5. **jsdom 29** — keep it as the root Vitest environment and run representative shared, client,
   and admin DOM suites before the package-wide checks.
6. **js-yaml 5** — replace default imports with namespace imports. Use `CORE_SCHEMA` for Envio
   config parsing, preserve YAML 1.1 behavior for docs/design front matter where appropriate, and
   replace removed `quotingType` with `quoteStyle`. Remove `@types/js-yaml` because v5 ships types.
7. **c8 11** — retain the indexer `c8 bun run mocha` CLI contract and prove coverage output.
8. **mkcert 2** — retain both Vite plugin call sites. Prove config loading and local dev startup;
   no certificate or trust-store mutation is required for the build checkpoint.
9. **Sentry CLI 3** — retain only `sourcemaps inject` and `sourcemaps upload`, which survive v3.
   Verify the binary version and a dry-run/source-map command path without uploading.

## TDD and rollback

- Each manifest/lock family is applied and validated separately before moving to the next.
- React Window and js-yaml receive failing behavioral regression coverage after their target package
  is installed but before source adaptation.
- Manifest-only families record `TDD: not_applicable` with the exact existing test/build proof.
- Any family that introduces a peer conflict, unexpected lifecycle/trust change, engine mismatch,
  or functional regression is reverted as a complete family before another target is attempted.

## Lock and RED rehearsal

- Bun 1.3.14 resolved all nine exact target families together in an isolated lock rehearsal. The
  graph moved from 3,578 to 3,606 packages without a peer warning, alternate registry, git
  dependency, or change to the root `trustedDependencies` allowlist.
- The only blocked lifecycle scripts remain the already-known PostHog CLI and MSW postinstalls;
  none of the Wave 7 targets asks to join `trustedDependencies`.
- React Window 2 produced the expected RED proof: importing `FixedSizeList` fails because v2
  exports `List` and its row-component API instead.
- js-yaml 5 produced the expected RED proof: `bun run docs:audit` fails at the existing default
  import because v5 is named-export only.
- Babel 8 imports successfully under Node 22, then produced a behavioral RED proof in the real
  locale scanner. Applying both `typescript` and `jsx` parser plugins to every `.ts` file makes
  the generic arrow at `packages/shared/src/hooks/utils/useMutationLock.ts:84` ambiguous. Selecting
  `jsx` only for `.tsx` files parses all 980 scanned source files and preserves the production
  source unchanged; that extension-aware scanner change is the intended GREEN adaptation.
- A truly clean frozen install could not complete inside Codex because registry requests stalled
  and timed out. The target lock is therefore rehearsal evidence, not the final frozen-install
  checkpoint; the workspace install must be repeated once registry access is healthy.

## Implementation result

- The final Bun 1.3.14 lock contains all nine exact target families and retains patched
  `systeminformation` 5.31.7. A clean, env-free mirror resolved 3,618 packages and completed
  `bun install --frozen-lockfile`, including the preserved multiformats/uint8arrays postinstall.
- The root Node engine floor is now `>=22.19.0 <23`, covering Babel 8, jsdom 29, and mkcert 2.
- React Window uses the v2 `List`/`rowComponent`/`rowProps` contract. The 40-member threshold,
  600px viewport, 64px row height, list semantics, selection dialog, public props, and forwarded
  ref are unchanged. The obsolete v1 ambient declaration was removed.
- Babel parsing now enables JSX only for `.tsx`, preserving generic-arrow parsing in `.ts` while
  scanning all 980 source files.
- `js-yaml` consumers use namespace imports. Envio/indexer parsing uses `CORE_SCHEMA`; docs and
  DesignMD frontmatter use `YAML11_SCHEMA`; dumping uses `quoteStyle: "double"`; the obsolete
  external type package is removed.
- Helmet keeps its provider/component API. The login suite now proves the asynchronous document
  title update. Day Picker required no source adaptation.
- jsdom 29 made the route location update after a synthetic exit animation observably async. The
  existing vault-management regression now waits for the eventual URL cleanup while preserving
  its stronger contract: the panel remains mounted until exit, `manage=positions` is removed, and
  unrelated query parameters remain intact.

## RED / GREEN evidence

| Family | RED | GREEN |
|---|---|---|
| React Window 2 | The v1 `FixedSizeList` import is undefined under 2.2.7. | `GardenGardeners.test.tsx` passes with virtualization, ARIA position/set size, ref, and selection behavior. |
| Babel 8 | The old scanner parses `.ts` with JSX enabled and fails at the generic arrow in `useMutationLock.ts`. | Extension-aware parser selection passes 12 locale tests across 980 files. |
| js-yaml 5 | `docs:audit` fails because v5 has no default export. | Docs audit, protocol status generation, DesignMD parity, Envio boundary checks, and contract script tests pass with explicit schemas. |
| jsdom 29 | `VaultManagePositions.test.tsx` passes on the pre-upgrade environment and fails under 29.1.1 because the route update completes after the panel unmount. | The test awaits eventual navigation; 13 focused tests and all 640 client tests pass. |

## Validation evidence

- `bun install --frozen-lockfile` — pass under Bun 1.3.14 and Node 22.22.1 in a clean mirror.
- `bun run format:check` — pass across 1,956 files.
- Root Oxlint, `forge fmt --check`, and Solhint — pass with the existing warning baseline. The
  combined root lint wrapper alone cannot complete in this sandbox because inherited Bun runtime
  mode cannot create its temporary file; the three underlying checks pass independently.
- Shared typecheck and tests — 286 files, 3,357 passing and 1 skipped.
- Client tests — 83 files, 640 passing after the jsdom timing repair.
- Admin hub tests — 13 files, 102 passing.
- Agent tests — 20 files, 230 passing; agent build passes.
- Indexer c8 coverage — 186 passing; 99.12% statements/lines, 83.57% branches, 99.08% functions;
  indexer build and boundary check pass.
- Contract script tests — 16 passing; adaptive source build passes without contract, ABI, storage,
  schema, deployment, or broadcast changes.
- Shared Storybook coverage/quality — 197/197 required surfaces and 169 quality-checked story
  files pass.
- Deterministic client and admin production builds pass; client PWA generation reports 21 entries
  and a 0.44 MiB precache. Docs production build and audit pass without warnings.
- Sentry CLI reports 3.6.0 and both supported source-map command help paths pass without upload.
- Authenticated Brave remains explicitly waived for this dependency program.

## Remaining proof limit

`bun audit --audit-level=high` still receives HTTP 403 inside Codex. The last host-certified Wave 6
baseline is 0 critical / 29 transitive high. Wave 7 is ready for a host audit comparison; do not
claim its security checkpoint complete until that output confirms no new critical or direct-high
finding.

## Primary migration sources

- [React Window 2.0 upgrade](https://github.com/bvaughn/react-window/releases/tag/2.0.0)
- [React Day Picker v10 upgrade](https://daypicker.dev/upgrading)
- [Babel 8 migration](https://babeljs.io/docs/v8-migration/)
- [js-yaml v4 to v5 migration](https://github.com/nodeca/js-yaml/blob/master/docs/migrate_v4_to_v5.md)
- [Sentry CLI 3.0 breaking changes](https://github.com/getsentry/sentry-cli/releases/tag/3.0.0)
- [vite-plugin-mkcert 2.0 release](https://github.com/liuweiGL/vite-plugin-mkcert/releases/tag/v2.0.0)
