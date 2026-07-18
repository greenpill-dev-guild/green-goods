# Wave 9 — Transformers.js 4

**Branch**: `chore/dependency-upgrades`
**Status**: automated green; external live-model download proof unavailable in Codex

## Implemented contract

- Replaced `@xenova/transformers` 2.17.2 with exact `@huggingface/transformers` 4.2.0.
- Preserved task `automatic-speech-recognition` and model `Xenova/whisper-tiny.en`.
- Preserved lazy singleton loading, retry after a failed load, and the existing text-input fallback.
- Preserved mono 16 kHz PCM16 WAV decoding and the `Float32Array` inference boundary.
- Kept root `trustedDependencies` unchanged. Production dependencies remain installed with
  `--ignore-scripts`; no new lifecycle script was authorized.

The lock graph contains Hugging Face Transformers 4.2.0, `onnxruntime-node` 1.24.3 and
`onnxruntime-web` 1.26.0-dev, with no remaining Xenova package. The target passes the plan's
three-day release-age gate.

## RED / GREEN regression proof

The new behavioral tests were first run against a deliberate legacy Xenova import guard. Both
failed with `legacy Transformers.js import used`, proving the test reached the production dynamic
import. After migrating the import, both passed.

The regressions prove:

1. A minimal PCM16 WAV containing `[-32768, 0, 16384]` reaches the ASR pipeline as
   `Float32Array([-1, 0, 0.5])`.
2. The pipeline task and model remain unchanged.
3. A rejected first model load clears the singleton promise and a second call retries successfully.
4. The public fallback remains `Voice processing unavailable: ... Please use text input instead.`

An opt-in live test remains skipped by default and exercises the real model only when
`RUN_LIVE_TRANSFORMERS=true`.

## Validation evidence

| Proof | Result |
|---|---|
| Fresh Bun 1.3.14 frozen install | Pass |
| Agent suite | 21 files pass, 1 live file skipped; 232 pass, 1 skipped |
| Agent format and lint | Pass |
| Agent production build | Pass |
| Node 22 package import | Pass in 958 ms; approximately +38 MiB RSS |
| Bun 1.3.14 package import | Pass in 113 ms; approximately +82 MiB RSS |
| Built agent import under Bun | Pass in 34 ms; approximately +21 MiB RSS; model remains lazy |
| Production `--ignore-scripts` install rehearsal | Pass; 5,339 packages |
| Linux ONNX CPU bindings | Present for arm64 and x64 |
| `bun pm untrusted` | Only existing `@posthog/cli` and `msw`; no trust change |
| Docker image build | Daemon unavailable; production install/layout reproduced directly |
| Live Whisper download/inference | Fetch denied in sandbox; network escalation rejected because the execution account is out of credits |
| Security audit | Codex registry endpoint still returns HTTP 403; host comparison remains pending |

The production agent image runs Bun 1.3.14. A direct Node import of the compiled agent entry is not
a supported deployment path because the existing TypeScript output uses extensionless relative
imports; this behavior predates and is independent of Transformers.js 4. Package-level Node 22
loading succeeds, while the actual built deployment entry succeeds under Bun.

## Production dependency layout

Because Docker was not running, the Dockerfile's production dependency stage was reproduced in a
clean temporary tree using the exact command `bun install --frozen-lockfile --production
--ignore-scripts`. Hugging Face resolved inside the agent workspace and the bundled Linux CPU files
were present for both production architectures:

- `bin/napi-v3/linux/arm64/libonnxruntime.so.1`
- `bin/napi-v3/linux/arm64/onnxruntime_binding.node`
- `bin/napi-v3/linux/x64/libonnxruntime.so.1`
- `bin/napi-v3/linux/x64/onnxruntime_binding.node`

This proves the dependency layout used by the image without widening lifecycle-script trust. The
only remaining runtime proof is the network-dependent model download and inference check.

## Primary migration sources

- [Transformers.js v4 announcement](https://huggingface.co/blog/transformersjs-v4)
- [Transformers.js 4.2.0 release](https://github.com/huggingface/transformers.js/releases/tag/4.2.0)
- [Server-side audio processing](https://huggingface.co/docs/transformers.js/guides/node-audio-processing)
- [Transformers.js repository](https://github.com/huggingface/transformers.js)
