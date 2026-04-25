# Locale Energy IoT Data Inputs Spec

## Goal

Define a focused locale.network integration for energy and environmental IoT inputs. This plan starts with discovery because the proof surface matters: low-cost devices, zero knowledge, and trusted execution evidence need to map cleanly to what Green Goods can display and attest.

## Discovery Questions

1. Which device measurements are available for Green Goods action types, especially energy generation, uptime, environmental conditions, and habitat monitoring?
2. How are device identity, location, calibration, and measurement time represented?
3. What zero-knowledge proof artifacts are exposed, and what can Green Goods verify directly?
4. What trusted execution environment evidence is available, if any?
5. What API, webhook, export, or on-chain interface should Green Goods consume?
6. What rate limits, pricing, and pilot hardware constraints apply?

## Candidate Architecture

- `packages/agent/src/partners/locale.ts` normalizes locale.network measurements into verification results.
- `attestationWriter.ts` writes Green Goods trusted-attester EAS attestations with proof metadata.
- `modules/partners.ts` exposes source labels, measurement categories, and confidence/proof badges.
- Admin WorkReview displays advisory energy/environmental verification badges.

## Constraints

- Do not treat ZK/TEE labels as trusted unless the verification material and verification path are known.
- Keep device data advisory for Q2.
- Query EAS directly from shared/admin surfaces; do not add Envio partner indexing.
- Keep Sylvie environmental/reforestation app data in its own hub.
