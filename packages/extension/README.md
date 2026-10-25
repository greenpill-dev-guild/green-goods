# Grove G0 feasibility spike

A disposable browser extension that measures the four parts of the Grove prototype (the
[Grove idea hub](../../.plans/ideas/grove/brief.md); its `prototype.md`, build-order row G0,
decision 17). It is not a product surface: nothing here ships, and G1 may replace any of it.

| Part | What this package does |
|---|---|
| Graph tab | `entrypoints/graph/` renders a synthetic 50-node garden with Sigma and Graphology |
| Gemma | `src/model/gemma.worker.ts` loads Gemma 4 E2B (q4f16, WebGPU) through Transformers.js and answers one fixed packet; `src/model/validate.ts` keeps only proposals with a known target, a known predicate and an exact quote |
| Pi Durable | `src/execution/` runs a three-phase task (`prepare`, `work`, `apply`) on a Harness opened with an empty model catalog, with an idempotent effect store |
| WebMCP | `entrypoints/webmcp*.content.ts` list and run a page tool shaped like the Admin Hub's `green_goods_get_garden_snapshot` through `document.modelContext` from the isolated and the main world |

Every text in the fixtures is invented. The model weights download from the Hugging Face hub into
the browser's cache; nothing is committed.

## Commands

Run these from the repository root.

| Command | Purpose |
|---|---|
| `bun run --cwd packages/extension build` | Build `.output/chrome-mv3` (copies the ONNX runtime's WebAssembly into `ort/`) |
| `bun run --cwd packages/extension test` | Node unit tests: validation, the synthetic graph, the Pi task with a simulated crash |
| `bun run --cwd packages/extension typecheck` and `bun run --cwd packages/extension lint` | Types and oxlint |
| `bun run --cwd packages/extension g0 -- --only lifecycle,webmcp,model,pi` | Drive the built extension in Brave Beta over CDP and write `g0/out/observations.json`; add `--headed` for visible windows or `--fresh` to wipe the persistent `main` profile |

The rig launches `/Applications/Brave Browser Beta.app` headless with a scratch `--user-data-dir`
under `g0/out/profiles/`, `--remote-debugging-port=0`, `--no-first-run`,
`--enable-blink-features=WebMCP` and `--load-extension`. It never opens a real profile. The
results of each dated run are summarized in the hub's `reports/`.
