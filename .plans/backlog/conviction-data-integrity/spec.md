# Conviction Data Integrity Specification

## Required decisions before activation

1. **Pool config source:** verify the deployed pool exposes decay and points-per-voter values and choose an authoritative member-count source. Do not ship a partial config with a synthetic denominator.
2. **Supporter count source:** verify the allocation event and its voter, pool, and hypercert identifiers before adding or changing an indexer entity.
3. **Threshold contract:** identify the exact deployed formula and inputs. A vendor mock is reference material, not proof of the live ABI.
4. **Unavailable state:** define what the UI shows while any required value is missing. Silent numeric fallbacks are not acceptable.

## Package boundaries

| Boundary | Responsibility |
|---|---|
| `packages/contracts` | ABI or contract view changes only if the deployed interface genuinely lacks required data |
| `packages/indexer` | Allocation/member entities and handlers derived from verified events |
| `packages/shared` | Query keys, hooks, typed config, supporter aggregate, and threshold derivation |
| `packages/client` / `packages/admin` | Consume one coherent read model and show explicit incomplete-data states |

## Invariants

- Counts are distinct people/accounts under the agreed identity key, not positive aggregate weight.
- Pool, chain, hypercert, and voter identifiers are composite where necessary.
- The displayed threshold matches the protocol rule for the same pool config used by the percentage calculation.
- No deployment, upgrade, or schema migration is inferred from the May source plans; each requires fresh scope lock.

## Source material

The original B1/B2/B3 briefs, specs, plans, evaluations, and status snapshots live under `artifacts/source-hubs/`. Their file paths and line references are historical and must be checked against current `develop`.
