# Wave 7 — Small Non-Contract Majors

**Branch**: `chore/dependency-upgrades`
**Status**: compatibility audit complete; dependency changes wait on Wave 6 host proofs

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

## Primary migration sources

- [React Window 2.0 upgrade](https://github.com/bvaughn/react-window/releases/tag/2.0.0)
- [React Day Picker v10 upgrade](https://daypicker.dev/upgrading)
- [Babel 8 migration](https://babeljs.io/docs/v8-migration/)
- [js-yaml v4 to v5 migration](https://github.com/nodeca/js-yaml/blob/master/docs/migrate_v4_to_v5.md)
- [Sentry CLI 3.0 breaking changes](https://github.com/getsentry/sentry-cli/releases/tag/3.0.0)
- [vite-plugin-mkcert 2.0 release](https://github.com/liuweiGL/vite-plugin-mkcert/releases/tag/v2.0.0)
