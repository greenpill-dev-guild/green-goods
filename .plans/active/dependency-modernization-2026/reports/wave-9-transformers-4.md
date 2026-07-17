# Wave 9 — Transformers.js 4 Compatibility Audit

**Branch**: `chore/dependency-upgrades`
**Status**: read-only migration audit complete; implementation waits on earlier wave checkpoints

## Exact package contract

- Replace `@xenova/transformers` 2.17.2 with exact `@huggingface/transformers` 4.2.0.
- Keep task `automatic-speech-recognition` and model `Xenova/whisper-tiny.en` unchanged.
- Keep the agent's lazy model load, singleton promise, retry-on-load-failure behavior, and
  text-input fallback message unchanged.
- Keep the existing mono 16 kHz PCM16 WAV decoder. The target API still accepts a raw
  `Float32Array`, and Hugging Face's server-side audio guide still uses that input shape and the
  same Whisper model.

The target was published in April 2026 and passes the three-day release-age gate. Its npm artifact
uses the public registry and the Hugging Face GitHub repository; final lock/audit proof remains
required when registry access is healthy.

## Source and runtime impact

1. The only production source change is the dynamic import in
   `packages/agent/src/services/ai.ts`. The `pipeline()` and ASR result contracts are retained.
2. Model loading remains lazy, so normal agent startup and non-voice webhooks do not pay model
   download or inference memory cost.
3. The Node export directly uses `onnxruntime-node` 1.24.3. Its package has a postinstall script,
   but CPU binaries for Linux and macOS are already shipped in the artifact; the script's extra
   manifest is empty on macOS and CUDA-only on Linux x64. Keep it blocked by Bun and do not add it
   to root `trustedDependencies`.
4. `sharp` remains trusted already. The target introduces no reason to widen the trust allowlist.
5. The production image must be checked for the bundled Linux CPU binding and glibc compatibility;
   a successful TypeScript build alone is not runtime proof.

## RED/GREEN tests

- Add a mocked pipeline regression that writes a minimal mono 16 kHz PCM16 WAV fixture, calls the
  real `transcribe()` path, and proves the pipeline receives the expected `Float32Array` samples.
- Add a mocked load rejection that proves `modelLoading` resets and the existing
  `Voice processing unavailable ... Please use text input instead` fallback is preserved.
- Add an opt-in live test for `Xenova/whisper-tiny.en`; keep it skipped during the default suite.
- Run the live model once under Bun and once from the built agent with deployed Node, recording
  first-load time, warm-load time, and peak RSS against the v2 baseline.
- Verify `bun pm untrusted` shows the expected blocked ONNX postinstall and no allowlist change,
  then run agent tests/build and webhook/transcription smoke coverage.

## Primary migration sources

- [Transformers.js v4 announcement](https://huggingface.co/blog/transformersjs-v4)
- [Transformers.js 4.2.0 release](https://github.com/huggingface/transformers.js/releases/tag/4.2.0)
- [Server-side audio processing](https://huggingface.co/docs/transformers.js/guides/node-audio-processing)
- [Transformers.js repository and 4.2.0 package usage](https://github.com/huggingface/transformers.js)
