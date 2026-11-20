# G0 encoder: a 137M-parameter text encoder inside the browser, offline, on one machine

**Date:** 2026-11-20. **Scope:** whether `nomic-ai/nomic-embed-text-v1.5` (quantized ONNX, through Transformers.js) runs fully inside the browser and offline in the existing G0 rig, measured on WebAssembly and WebGPU separately. **Code:** `packages/extension` on branch `research/grove-encoder-browser-test`. The measurements ran on a local checkout based on develop at `a0d503abc`, where `packages/extension` pinned `@huggingface/transformers` 4.2.0; the branch was then rebased onto a later develop that pins 4.3.2, which this report did not measure. In the code, the worker is `src/model/encoder.worker.ts`, the page is `entrypoints/encoder/`, scoring is `src/model/ranking.ts`, the rig item is `g0/encoder-rig.mjs`. Raw sheets stayed in the gitignored `g0/out/`: `observations-encoder-2026-11-20T20-13-46-529Z.json` (the full run) and `observations-encoder-2026-11-20T20-57-54-952Z.json` (the throttled constrained rerun, merged into `observations.json`, which keeps the first attempt as `constrainedSuperseded`). **Time box:** 90 minutes; the work started at 12:04 PST.

Every text embedded here is synthetic. No real garden, person, project or review appears in the fixture. No model weights are committed; they live in scratch browser profiles and in `g0/out/encoder-model/`. This report is immutable; corrections go in a new dated report.

## Results at a glance

| # | Measure | WebAssembly (4 threads) | WebGPU |
|---|---|---|---|
| 1 | First download | 137,576,996 bytes on the wire in 9 requests; 5.6 s from the first download progress event to the last; 9.0 s to a ready session | 137,577,402 bytes in 9 requests; 16.1 s; 18.5 s to a ready session |
| 2 | Load, warm from the browser cache | 0.77 s (1.22 s in the offline run) | 0.89 s (1.19 s offline) |
| 3 | One requirement (about 34 tokens), median and p95, warm | 131 to 153 ms; 156 to 211 ms | 191 to 230 ms; 236 to 268 ms |
| 4 | One 200-word section (about 231 tokens), median and p95, warm | 816 to 845 ms; 1,035 to 1,122 ms | 891 to 978 ms; 1,000 to 1,279 ms |
| 5 | Rank all 40 requirements against all 120 sections | 105.7 to 111.1 s warm; 106.9 s offline | 116.5 to 128.3 s warm; 149.6 s offline |
| 6 | Correct section ranked first (top three), keyword alone | 28 of 40 (34) | 28 of 40 (34) |
| 7 | The same, encoder alone | 29 of 40 (38) | 30 of 40 (38) |
| 8 | The same, both combined | 29 of 40 (39) | 30 of 40 (39) |
| 9 | Peak extension renderer memory, highest run | 1,580 MiB | 1,809 MiB |
| 10 | Offline rerun: network requests attempted | 0 | 0 |
| 11 | Constrained pass (2 threads, 4x CPU throttle): rank time | 529.9 s under a process throttle measured at 3.63x (170.0 s on 2 threads without an effective throttle) | not run (WebAssembly only, as asked) |
| 12 | Node agreement, cosine over five texts | 0.9847 to 0.9900 | 0.9854 to 0.9915 |

Ranges are across the warm passes (three per backend). Ranking figures were identical in every pass of a backend.

### Gates

| Gate | Result | Measurement |
|---|---|---|
| Runs to completion with the network blocked and zero requests attempted | **Pass** on both | 0 network requests during the run on both backends, by two meters; both positive controls were seen and failed |
| Peak renderer memory under 2 GB | **Pass** on both, narrowly on WebGPU | Highest peak 1,809 MiB (1.90 GB) in the WebGPU offline run; WebAssembly highest 1,580 MiB (1.66 GB) |
| Constrained WebAssembly pass ranks the fixture in under 60 s | **Fail** | 529.9 s on two threads under a process throttle measured at 3.63x; 170.0 s on two threads when the DevTools throttle did not reach the worker. Both are over 60 s |
| Browser and Node embeddings agree at cosine 0.99 or higher | **Fail** | 1 of 5 texts reached 0.99 against each backend; lowest 0.9847 |

[Failed gates](#failed-gates) gives each failure with its number. [Limits](#limits) says what this does not show.

## Observation sheet

### Machine, browser and flags

| Field | Value |
|---|---|
| Device | Apple M4, 10 cores, 24 GiB unified memory (25,769,803,776 bytes), macOS 27.0, Darwin 27.0.0. The same machine as the October report. No 8 GB device was used |
| Browser | Brave Browser Beta 158.1.101.52 (user agent `HeadlessChrome/158.0.0.0`), `/Applications/Brave Browser Beta.app`. The October report used 156.1.99.44; the browser updated itself in between |
| Launch | The October rig's flags, unchanged: `--headless`, a scratch `--user-data-dir` under `packages/extension/g0/out/profiles/`, `--remote-debugging-port=0`, `--no-first-run`, `--no-default-browser-check`, `--enable-blink-features=WebMCP`, `--load-extension` and `--disable-extensions-except` for `.output/chrome-mv3`, `--disable-background-timer-throttling`, `--disable-renderer-backgrounding`, `--window-size=1200,800` |
| Real profiles | Never opened. The full run created fresh `encoder-wasm` and `encoder-webgpu` profiles; the throttled rerun reused `encoder-wasm` with the model already cached |
| Page | `chrome-extension://<id>/encoder.html`, cross-origin isolated (COOP `same-origin`, COEP `credentialless`), so WebAssembly threads and `measureUserAgentSpecificMemory()` are available. `navigator.hardwareConcurrency` 10; `navigator.deviceMemory` 16 (the API's cap) |
| WebGPU | Adapter vendor `apple`, architecture `metal-3`, `shader-f16` present, in the page and in the worker |
| Runtimes | `@huggingface/transformers` 4.2.0, the version pinned in `packages/extension` at the measured base (develop has since moved to 4.3.2, not measured here); in the browser it bundles `onnxruntime-web` 1.26.0-dev.20260416-b7804b056c and uses the `asyncify` WebAssembly from the extension's `ort/`; in Node it uses `onnxruntime-node` 1.24.3 (CPU). No dependency was installed or upgraded |
| Toolchain | Node v24.20.0 ran the rig; Bun 1.4.2 ran the package scripts |
| Machine load | 1-minute load average 7.3 at the start of the WebAssembly cold run, 9.5 warm, 10.6 offline, 11.2 for the first constrained pass; 7.9, 14.1 and 11.7 for the WebGPU cold, warm and offline runs; 14.9 for the throttled rerun. Other sessions on the machine were running their own work |

### Model artifact (read from the hub inside the scratch profile)

| Field | Value | Against "137 million parameters, Apache-2.0, about 137 MB quantized" |
|---|---|---|
| Repository | `nomic-ai/nomic-embed-text-v1.5` | |
| Revision | `e9b6763023c676ca8431644204f50c2b100d9aab` (last modified 2026-04-07T14:17:02Z). Files were fetched through `resolve/main`; the three JSON files carried `x-repo-commit` with this hash, and the ONNX file's bytes match the hub's sha256 for it at this revision | |
| File | `onnx/model_quantized.onnx` (Transformers.js `dtype: "q8"`), 137,296,292 bytes, sha256 `b4342336debaea79de872370664b0aaeb67dea4605513d00ee236ea871a81f27`. The hub's `onnx/model_int8.onnx` is the same file (same size and hash) | Matches: 137.3 MB (130.9 MiB) |
| Other files fetched | `tokenizer.json` 711,396 bytes, `config.json` 2,538, `tokenizer_config.json` 1,191; 138,011,417 bytes in Cache Storage in all | |
| Parameters | 136,731,648, from the hub's safetensors index (F32). The quantized ONNX file was not counted separately | Matches when rounded: 136.7 million |
| Licence | `apache-2.0` (card metadata and the `license:apache-2.0` tag) | Matches |
| Architecture | `nomic_bert`, 12 layers, hidden size 768, `model_max_length` 8192 | |

**Following the card.** The model card asks for a task prefix on every text and shows this Transformers.js recipe: mean pooling, `layer_norm` over the embedding dimension, a Matryoshka slice and L2 normalization. The worker does exactly that, with `search_query: ` on requirements and `search_document: ` on sections. It keeps the full 768 dimensions where the card's example slices to 512, so the slice is a no-op. Each text is embedded alone (batch size 1), one after another, in a dedicated module worker.

**Download path.** The first load makes 9 network requests to two hosts: `huggingface.co` (three small JSON files, their `api/resolve-cache` lookups and the model's metadata) and `us.aws.cdn.hf.co`, the Xet bridge that served the 137 MB file. `tokenizer.json` arrives compressed (196 KB on the wire). Bytes on the wire are Network `encodedDataLength` per request id.

## The fixture

`packages/extension/src/model/encoder-fixture.json`, labeled `"synthetic": true`. It has 40 invented requirements from a fictional funding call for community land projects: 20 on growing practice (rainwater storage, soil tests, composting, seed saving, frost dates, erosion and so on) and 20 on governance, money and reporting. It also has 120 invented application sections of 180 to 211 words (median 191; 23,102 words in all), shuffled with a fixed seed. Each requirement has exactly one section written to satisfy it, plus two sections on the same topic that share its vocabulary and do not satisfy it. That makes it a hard-negative test, not a topic-matching test. Requirements tokenize to 29 to 43 tokens with the prefix (median 34) and sections to 207 to 267 (median 231). Place names (Hollowmere, Ashcombe, Pennybrook) are invented. Two language-model subagents drafted the texts from a written brief. A script checked the word counts and ASCII, and the proper nouns were reviewed by hand.

**Scoring.** Keyword scoring is BM25 (k1 1.2, b 0.75) over lowercase word tokens with a short English stopword list and no stemming. The encoder score is cosine similarity. Combined is reciprocal rank fusion (k 60) of the two. A tie puts the correct section at the worse position, so a scorer gets no credit for a tie.

## Results

### Load and first call

| Run | Backend | Load to a ready session | Download window | First requirement | First section |
|---|---|---|---|---|---|
| Cold, fresh profile | WebAssembly | 9,043 ms | 5,599 ms | 304 ms | 815 ms |
| Warm, browser cache | WebAssembly | 768 ms | from cache | 845 ms | 1,377 ms |
| Offline | WebAssembly | 1,216 ms | from cache | 414 ms | 730 ms |
| Cold, fresh profile | WebGPU | 18,468 ms | 16,075 ms | 2,834 ms | 1,178 ms |
| Warm, browser cache | WebGPU | 893 ms | from cache | 720 ms | 951 ms |
| Offline | WebGPU | 1,186 ms | from cache | 1,930 ms | 739 ms |

The download window runs from the first progress event to the last. The two cold downloads ran 23 minutes apart, so the network differed between them; the 5.6 s and 16.1 s say nothing about the backends. The first call on a fresh session is reported apart from the passes because it pays for kernel set-up.

### Embedding and ranking time

| Run | Passes | Requirement median / p95 (ms) | Section median / p95 (ms) | Rank all 40 against 120 |
|---|---|---|---|---|
| WebAssembly cold | 2 | 150 to 156 / 190 to 238 | 852 to 853 / 1,054 to 1,078 | 111.0 to 111.5 s |
| WebAssembly warm | 3 | 131 to 153 / 156 to 211 | 816 to 845 / 1,035 to 1,122 | 105.7 to 111.1 s |
| WebAssembly offline | 1 | 144 / 186 | 826 / 1,021 | 106.9 s |
| WebAssembly, 2 threads, DevTools throttle (did not reach the worker) | 1 | 207 / 271 | 1,324 / 1,710 | 170.0 s |
| WebAssembly, 2 threads, 4x process throttle (3.63x measured) | 1 | 1,028 / 1,358 | 3,969 / 5,781 | 529.9 s |
| WebGPU cold | 2 | 221 to 257 / 289 to 501 | 925 to 967 / 1,218 to 1,223 | 126.3 to 128.7 s |
| WebGPU warm | 3 | 191 to 230 / 236 to 268 | 891 to 978 / 1,000 to 1,279 | 116.5 to 128.3 s |
| WebGPU offline | 1 | 213 / 274 | 1,159 / 1,488 | 149.6 s |

Each pass embeds 40 requirements and 120 sections and then scores. Scoring (BM25, cosines and fusion) took 92 to 163 ms of each total (359 ms in the first constrained pass, whose page thread was throttled); the rest is embedding. WebAssembly ran on ONNX Runtime's default of 4 threads.

**WebGPU was slower than WebAssembly** for this quantized file on this machine. The cause was not diagnosed: ONNX Runtime's node-placement log was not captured, and the console showed no warnings. One explanation to test is that the int8 operators of `model_quantized.onnx` do not run on the WebGPU execution provider and fall back to the CPU. The `fp16` or `q4f16` files may behave differently on WebGPU; neither was measured.

### Ranking on the synthetic fixture

| Scorer | WebAssembly top 1 | WebAssembly top 3 | WebGPU top 1 | WebGPU top 3 |
|---|---|---|---|---|
| Keyword (BM25) alone | 28 of 40 (70%) | 34 of 40 (85%) | 28 of 40 (70%) | 34 of 40 (85%) |
| Encoder alone | 29 of 40 (72.5%) | 38 of 40 (95%) | 30 of 40 (75%) | 38 of 40 (95%) |
| Both, reciprocal rank fusion | 29 of 40 (72.5%) | 39 of 40 (97.5%) | 30 of 40 (75%) | 39 of 40 (97.5%) |

Each backend gave the same figures in every pass, and the constrained passes matched WebAssembly. The one-requirement difference between backends comes from their slightly different vectors (next section).

### Memory

Resident set size of every Brave process of the launch, sampled with `ps` every 250 ms over the whole run (page load, model load, all passes). The extension renderer hosts the page, the encoder worker and ONNX Runtime's threads.

| Run | Extension renderer: baseline, peak | All Brave processes: peak | GPU process: peak | `measureUserAgentSpecificMemory()` after load, after ranking |
|---|---|---|---|---|
| WebAssembly cold (2 passes) | 75 MiB, 794 MiB | 1,135 MiB | 96 MiB | 375 MB, 376 MB |
| WebAssembly warm (3 passes) | 32 MiB, 1,362 MiB | 1,588 MiB | 59 MiB | 374 MB, 376 MB |
| WebAssembly offline (1 pass) | 33 MiB, 1,580 MiB | 1,820 MiB | 50 MiB | 374 MB, 376 MB |
| WebAssembly, 2 threads, DevTools throttle | 34 MiB, 656 MiB | 864 MiB | 50 MiB | 373 MB, 375 MB |
| WebAssembly, 2 threads, 4x process throttle | 176 MiB, 541 MiB | 1,075 MiB | 97 MiB | 373 MB, 375 MB |
| WebGPU cold (2 passes) | 84 MiB, 805 MiB | 1,181 MiB | 104 MiB | 375 MB, 377 MB |
| WebGPU warm (3 passes) | 42 MiB, 1,354 MiB | 1,600 MiB | 92 MiB | 375 MB, 376 MB |
| WebGPU offline (1 pass) | 30 MiB, 1,809 MiB | 2,056 MiB | 87 MiB | 374 MB, 376 MB |

The page's own measure stays near 375 MB in every run, but the renderer's resident size varies between runs from 656 to 1,809 MiB without a pattern by pass count. This sheet does not explain the spread. The gate is read against the highest peak.

### Offline rerun

After the cold and warm runs had cached the model, a new page opened with two meters running: Network domain recording on the page and on every worker and nested worker, attached before each one started; and `Fetch.enable` on the browser session for all of Brave. The browser-level interception failed every `http`, `https` and `ws` request with `InternetDisconnected` and let everything else through. The rig also asked every session for `Network.emulateNetworkConditions` offline, but it ignored errors from that call, so whether it applied to the workers is not recorded; the interception alone is enough to explain the controls failing.

| Backend | Network requests during load and ranking | Everything the browser-level interception saw during the run | Positive control after the run (worker fetch, page fetch of `huggingface.co/api/models/...`) |
|---|---|---|---|
| WebAssembly | 0 | 2 `chrome-extension://` scripts, the page's own bundle, let through | Both failed with `net::ERR_INTERNET_DISCONNECTED`; both meters saw both |
| WebGPU | 0 | the same 2 extension scripts | the same |

The full run completed in both cases, with the same rankings as online. Transformers.js read every file from Cache Storage and made no revalidation request; the ONNX Runtime WebAssembly loaded from the extension package. The controls show the meters were working: a request from the worker or the page would have been seen.

### Constrained pass

The first attempt throttled with the DevTools protocol, as asked. Two findings came out of it. `Emulation.setCPUThrottlingRate` on a worker session returns `Operation is only supported for pages, not workers (-32000)`. Throttling the page left the worker's busy loop at 0.94x and 1.01x of its unthrottled speed in two calibrations, so that run was really two threads at full speed: 170.0 s.

The rerun kept two threads and replaced the throttle mechanism. The rig stops and resumes the extension renderer processes (every thread in them, the worker and ONNX Runtime's pool included) with `SIGSTOP` and `SIGCONT`: in each 40 ms period they run 10 ms. A two-second busy loop in the worker measured 18,447 iterations unthrottled, 18,200 under DevTools throttling (1.01x) and 5,075 under the duty cycle (3.63x). The calibrated slowdown is slightly under the 4x asked for. Under it, the model loaded from cache in 6.3 s and ranking the fixture took 529.9 s: 42.2 s for the 40 requirements and 487.3 s for the 120 sections, with the same rankings as every other WebAssembly pass and no network requests. That is 3.1 times the 170.0 s of the unthrottled two-thread pass.

### Node sanity check

The rig copied the four model files out of the `encoder-wasm` profile's Cache Storage into `g0/out/encoder-model/` and hashed them: the same sha256 as above. Node loaded them with `allowRemoteModels = false`, embedded the same five fixture texts (requirements R01 and R21, sections S060, S025 and S001) with the same prefixes and post-processing, and compared each vector with the browser's warm-run vector.

| Text | Node vs browser WebAssembly | Node vs browser WebGPU | Browser WebAssembly vs WebGPU |
|---|---|---|---|
| R01 (requirement) | 0.98835 | 0.98865 | 0.99054 |
| R21 (requirement) | 0.98530 | 0.98615 | 0.99210 |
| S060 (section) | 0.98468 | 0.98545 | 0.99250 |
| S025 (section) | 0.99002 | 0.99152 | 0.99359 |
| S001 (section) | 0.98683 | 0.98639 | 0.99424 |

Within one backend the vectors are exactly repeatable: cold against warm gave a cosine of 1.0 for all five on WebAssembly. Across runtimes, the same int8 file gives vectors that differ in the second or third decimal of the cosine, between Node and the browser and between the two browser backends. That suggests the gap belongs to the quantized graph's numerics across ONNX Runtime builds (1.24.3 CPU against 1.26 dev web), not to a bug in either path. It was not proven: the fp32 `onnx/model.onnx` would separate the two, and it was not run.

## Failed gates

| Gate | Measurement | Consequence |
|---|---|---|
| Constrained WebAssembly pass under 60 s | 529.9 s on two threads under a process throttle measured at 3.63x; 170.0 s on two threads unthrottled; 105.7 to 111.1 s on four threads unthrottled | Ranking 160 texts one at a time on two throttled threads is minutes of work, not seconds. A real Grove pass should embed incrementally (each new section once, as it arrives), cache document vectors, and keep the query side short |
| Browser and Node cosine at least 0.99 | 0.98468 to 0.99002 against WebAssembly and 0.98545 to 0.99152 against WebGPU; 1 of 5 texts at or above 0.99 against each. The two browser backends agree at 0.99054 to 0.99424 | Vectors from different runtimes should not be mixed in one index without a check. Rankings held up anyway: the backends differed by one requirement out of 40 |
| DevTools CPU throttling on the worker (not a gate, a method failure) | `Emulation.setCPUThrottlingRate` is refused on worker targets; page throttling slowed the worker by 0.94x and 1.01x | The gated constrained figure uses a process duty cycle measured at 3.63x, short of 4x. The gate itself was not loosened |
| The rig's byte meter (corrected) | The first sheet's `networkBytes` reads 275,153,992 and 275,154,804 because a redirect hop repeats a request id | The figures here count each request id once (137,576,996 and 137,577,402); the rig now does the same |

## Limits

- **One machine.** Every number comes from one Apple M4 with 24 GiB of unified memory, in one browser build. Other sessions were running on it; load averages are given per run. No 8 GB device and no Windows, Linux or Android device was used.
- **The fixture is invented.** Two language-model subagents wrote the 160 texts from a brief, with hard negatives on purpose. The ranking figures say how the three scorers compare on this fixture. They say nothing about accuracy on real reviews, real applications or real gardens.
- **The constrained pass is a stand-in.** Two threads with a 3.63x duty cycle on a fast CPU is not a measurement of a weaker laptop, whose memory bandwidth, caches and thermals differ.
- **One file, one way of running it.** Only `model_quantized.onnx` was measured, embedding one text at a time. Batching, shorter sections, the `fp16` and `q4f16` files on WebGPU, a 512-dimension Matryoshka slice, and Transformers.js versions after 4.2.0 were not measured.
- **Memory is resident size, sampled.** Peaks come from `ps` every 250 ms and vary between runs (656 to 1,809 MiB for the renderer) without an explanation in this sheet.
- **Not measured at all:** behaviour on a cold browser start with the cache evicted under storage pressure, power draw, and the Admin Hub origin.

## How to rerun

```bash
bun run --cwd packages/extension build
bun run --cwd packages/extension g0 -- --only encoder
bun run --cwd packages/extension g0 -- --only encoder --encoder-phases constrained
```

The full run takes about 45 minutes on this machine and downloads the model twice (once per fresh profile). On this branch the rig runs the versions develop now pins (Transformers.js 4.3.2), not the 4.2.0 measured here, so a rerun is a new measurement. The second command reruns only the constrained pass on the cached `encoder-wasm` profile and merges it into `g0/out/observations.json`. The model files the Node check uses are exported to `g0/out/encoder-model/` and stay out of Git.

## A sentence a grant application can quote

On an Apple M4 Mac with 24 GiB of memory, in Brave Browser Beta 158, the quantized nomic-embed-text-v1.5 text encoder (a 137,296,292-byte model file) ran entirely inside the browser on WebAssembly with all network access blocked, made zero network requests, and ranked 40 requirements against 120 document sections in 106.9 seconds with a peak renderer memory of 1,580 MiB.
