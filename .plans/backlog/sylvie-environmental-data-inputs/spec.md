# Sylvie Environmental Data Inputs Spec

## Goal

Integrate Sylvie as an environmental/reforestation data input for Green Goods operator review. The plan starts with discovery because API shape, credentials, cadence, and available claim types need confirmation before implementation.

## Discovery Questions

1. What Sylvie objects can map to a Green Goods garden or work submission?
2. Which claims are available: planting event, survival/stewardship, vegetation signal, geospatial evidence, project status, or other environmental proof?
3. Does Sylvie expose per-submission lookup, per-garden/project polling, webhooks, or export batches?
4. What authentication, rate limits, and usage permissions apply?
5. What raw evidence can Green Goods store to IPFS and cite from an EAS attestation?

## Candidate Architecture

- `packages/agent/src/partners/sylvie.ts` normalizes Sylvie responses into a partner verification result.
- `packages/agent/src/services/attestationWriter.ts` writes Green Goods trusted-attester EAS attestations.
- `packages/shared/src/hooks/useWorkAttestations.ts` queries EAS directly for admin display.
- `packages/admin` renders advisory verification badges in the work review flow.

## Constraints

- Sylvie does not sign attestations directly in this plan; Green Goods validates Sylvie data and signs the EAS attestation.
- Partner evidence is advisory; operator approval remains human-governed.
- No Envio schema/config changes for partner attestations.
- Keep this independent from locale.network energy/IoT scope.
