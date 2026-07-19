# Local-First Extended Tooling

Date: 2026-04-12
Status: Idea note
Source: prior local-first extended tooling research

## Why this moved out of backlog

The prior research is substantive, but it is a discovery document, not an execution-ready feature. It mixes media handling, AI, browser APIs, mapping, sync alternatives, and authentication ideas that should not sit in the live backlog together.

## Most promising follow-up ideas

### 1. Offchain EAS attestations

The cleanest product idea in the prior research is offchain attestation signing with later timestamping. It aligns with the existing job queue and could materially improve offline work submission.

### 2. Media storage upgrades

There is a coherent cluster around OPFS, content-addressed media, and local IPFS/CAR preparation. That is worth revisiting only after the core local read-store direction is proven.

### 3. Zero-download quality checks

Image blur, brightness, and EXIF GPS validation are attractive because they add user value without model downloads or major platform risk.

### 4. On-device AI remains exploratory

WebGPU, transcription, and on-device models are interesting, but they should remain future exploration until the offline and media foundations are more mature.

## Re-entry rule

If any one of these areas becomes important enough to build, create a new, narrowly scoped backlog hub for that single capability rather than restoring a broad umbrella plan.
