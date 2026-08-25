# Resources

Verified 2026-08-24/25. Addresses and facts below were read from primary sources; anything inferred
is marked. Re-verify before any transaction.

## Event: SustainableFinance.Live 2026 Hackathon

Finextra Research. London and online. Theme: *"a coordination layer for community, place, and
stewardship"*, aligned to the UK Government's Pride in Place programme.

- Hackathon page: <https://www.sustainablefinance.live/hackathon>
  (returns 403 to plain HTTP clients — read it through a browser)
- Agenda / key dates: <https://www.sustainablefinance.live/hackathon-agenda>
- Contact: `events@finextra.com`

| Date | Event |
|---|---|
| 1 Sep 2026 | Webinar |
| **16 Oct** | Bootcamp — full problem briefings released here |
| 16–27 Oct | Build window (~11 days) |
| 20 Oct | Sustainable Finance Live Conference, London + online |
| 27 Oct, 14:00–15:00 | Submission deadline |
| 28 Oct | Pitches 10:00–12:00, judging 13:00–14:00, awards 15:00–16:00 |

**Target track — Problem Statement 2, "From Underbanked to Understood — Community Credit and
Commitment Pools"**, verbatim:

> Community organisations — such as sports clubs, charities, housing groups, and local producers —
> hold real value through relationships, skills, and local demand. However, traditional financial
> systems often see them as low value or high risk because of their fragmented records, limited
> collateral, and volatile cash flow. How might we make these assets, commitments, and histories
> visible to support fair finance, mutual credit, and better coordination? Can we build tools that
> help banks and funders understand place-based organisations, while enabling communities and meet
> local needs without relying solely on cash?
>
> **Idea Starter** — The Sarafu Network enables communities to issue redeemable vouchers for goods,
> services, and labour, creating transparent and auditable commitment pools. Could you build on
> Sarafu, or design a compatible solution, to help communities coordinate resources, route support,
> and make local capacity visible? Could this data also help banks, councils, and investors identify
> which projects are resilient, trustworthy, and investable?

Adjacent statements: **PS3** ("From Satellite to Community Space") explicitly invites a geospatial
add-on to *"the One Planet or Sarafu system"*. **PS1 / Collaboration Reverse Challenge** is a
One Planet knowledge-graph plus agentic-AI brief that overlaps the Regen Coordination Knowledge
Commons ontology work.

Judging criteria and prizes were still unpublished as of 2026-08-24; the PS2 briefing is introduced
by an unnamed "established actor" at the 16 Oct bootcamp. Stated deliverable is *"MVPs, platform
concepts, and customer journeys"* — not a deployed protocol.

## Cosmo-Local Credit (Grassroots Economics, Will Ruddick)

- Site: <https://cosmolocal.credit>
- Whitepaper as machine-readable text: <https://cosmolocal.credit/llms-full.txt>
  (the richest single source — carries CPP interfaces, the MCC, fee waterfall, KPIs, governance)
- Simulator: <https://sim.cosmolocal.credit> (Streamlit; not text-readable)
- GitHub org: <https://github.com/cosmo-local-credit>

| Repo | Contents |
|---|---|
| `protocol` | Core Solidity. **AGPL-3.0.** Last push 2026-08-18 |
| `docs` | Documentation |
| `sim` | Python simulation/modelling |
| `eth-tracker` | Go — EVM tx/event/deployment tracker |
| `eth-indexer` | Go — indexes GE activity on Celo |
| `ens-offchain-resolver` | Go — ENS offchain resolver gateway |
| `storage-server` | Go — content storage |

Documentation safe to read (not `src/`): `README.md`, `docs/SPEC.md`, `docs/DEPLOY.md`,
`docs/PUBLISH.md`. `docs/SPEC.md` is a complete public interface reference — functions, events,
errors, seal bitmasks, fee math — sufficient to hand-write interfaces without touching AGPL source.

**Licensing** — `LICENSE` is present and is AGPL-3.0 for everything under `src/`; unmodified Solady
snippets stay MIT; `NOTICE` carries attributions to Louis Holbrook, 0xSplits and Solady. This
supersedes the 2026-07-02 "missing LICENSE file" observation recorded in
`commitment-pooling/exchange-architecture-brief.md` §6.

**Security review** — `audits/Sarafu-Protocol-Security-Audit.pdf`, at commit `f0944d9`. The README
states it is an *internal engineering review*, explicitly **"not an independent third-party
certification."** It does not satisfy the Green Goods external-audit gate.

### Deployed — Gnosis mainnet, chain 100, v1.0.0

solc 0.8.36, EVM fork osaka, optimizer 200 runs (Calibur 1000). Deployer
`0x33a573149db22e759fb9a38bcc461c12855c2645`.

| Contract | Address |
|---|---|
| Calibur | `0x48A910C8e9FF0b14051b78d0c96dB069E57f0729` |
| ERC1967Factory | `0xB286994c648F98fD3a3BA6C43934828a5b88162b` |
| AccountsIndex | `0x3cA9AB9b8628b43f1A1c53f29e969BA84Ef88BeE` |
| CAT | `0xA12148B6eeb347298F17eCC5AC0377592850202E` |
| ContractRegistry | `0x273B65EA845E2832f41d8d4366E6Cc3a9Fc67186` |
| EthFaucet | `0x3dF58d637f03CD5174c5533FB89cb9B6fd855Ad3` |
| FeePolicy | `0x1b97FfFAF2D2e16C8F7de6826F4F658dc898E5b6` |
| GiftableToken | `0x34445d13F112A11f72C1d353a7dcdc407F3df2d8` |
| Limiter | `0x258AAd6c933F70D7F071E112800a41Fb60434048` |
| OracleQuoter | `0x3334fd1eA4c7e4dCA51f5E62EE3F5f7Dcbd098BA` |
| PeriodSimple | `0x8608051473603279EE982E87f765A78d3D080b00` |
| ProtocolFeeController | `0x302E6d520e7D7AeFceA4813e456234B5daA23B4d` |
| RelativeQuoter | `0x0B0986c0E580377389337C453Cc65A3933511165` |
| Splitter | `0x3b1F9bCC82f2dA5607dcDFCb21E47Cf64Ee54274` |
| SwapPool | `0x9e694D342Cab02e295262B2290b0E64A0334160D` |
| TokenUniqueSymbolIndex | `0x0CEB18BA6562D3227717D98c044A5849bE8362EF` |
| DecimalQuoter | `0x336f493d5472FD59e9E05128804E2D05Be89c4B7` |
| SwapRouter | `0x16e3F29dDe22eF75C081A764C4d200Cd48647bcC` |
| RescueVault | `0x3E5D8d8f63c57EA5DD62cF5aeC7212C50bDA69EF` |

These are **implementation** addresses as published in the README. Proxy instances for a specific
pool are separate and must be resolved through `ContractRegistry` / discovery before use.

**No testnet deployment is published.** The README and `docs/DEPLOY.md` cover Gnosis mainnet only;
there are no Chiado addresses. Any testnet work runs against our own deployment of the published
implementations or against interface-conformant mocks, and cannot observe the live venue's rates,
limits, fees, or de-listing behaviour. See `plan.todo.md` Slice 5 for the 5a/5b split this forces.

### Writing from Will Ruddick

- *What Makes a Pool a Pool?* (2026-08-01) — the five-rung ladder (tracking → verification →
  rewarding → coordination → pooling), pool anatomy (curation / valuation / limitation / exchange /
  settlement / memory+repair), and the three tests.
- *Bioregional Cosmo-Local Credit Flows* — the six cross-pool transaction patterns and the live
  Kenyan chama data (5 pools, 4,606 transactions Jan–Aug 2026, on Celo).
- Recipe library: <https://recipes.grassecon.org>

## Chainlink CCIP — Gnosis

<https://docs.chain.link/ccip/directory/mainnet/chain/xdai-mainnet>

- Chain selector: `465200170687744372`
- **Arbitrum One lane live, OnRamp v1.5.0** (same version family as the Celo lane in use)
- Fee tokens: GHO, LINK, WXDAI, native XDAI
- Router, RMN, token admin registry addresses are truncated in the rendered docs page — read the
  full values from the Chainlink directory at implementation time rather than transcribing them here

## Green Goods — current state (verified 2026-08-24/25)

- `packages/contracts/deployments/networks.json` covers mainnet(1), sepolia(11155111),
  localhost(31337), arbitrum(42161), celo(42220). **No Gnosis(100) entry.**
- Pooling contracts deployed and **unpaused on Arbitrum** since 2026-08-13: `commitmentPoolingModule`,
  `commitmentRegistry`, `creditRegistry`, `settlementModule`, `poolingLibraries`,
  `settlementLibraries`, `testimonyResolver`.
- `SettlementModule` and the Celo executor are deployed but **paused**, `authorityEnabled: false`.
- Ownership is still deployer-EOA across the pooling surface; Safe transfer deferred.
- Hosted Envio has **no pooling schema** — pooling queries remain gated off.
- `enum PoolType { Garden, Protocol }` — [ICommitmentPoolingModule.sol:8](../../../packages/contracts/src/interfaces/ICommitmentPoolingModule.sol)
- `enum CycleType { Season, Campaign }`; one open Season per pool, unlimited concurrent Campaigns —
  [CyclesLib.sol:11](../../../packages/contracts/src/lib/CommitmentPooling/CyclesLib.sol)
- `enum ConsiderationRail { None, ArbitrumExternal, CeloSettlement }`
- `Cycle` carries `metadataCID`, `AllocationBps allocation` (snapshot emitted in `CycleOpened`),
  and `RecognitionPolicy { equalParticipationBps, verifiedContributionBps }`.

## Cross-chain identity precedent

- [`CeloGardenAccountDeploymentCoordinator.sol`](../../../packages/contracts/src/accounts/CeloGardenAccountDeploymentCoordinator.sol)
  — one-shot coordinator reconstructing the frozen CREATE2 dependency closure and deploying all 18
  foreign-tuple GardenAccounts at their **exact Arbitrum addresses** on Celo, rejecting any init
  code that fails the frozen length, hash, CREATE2-target and runtime-hash checks.
- [`CeloGardenAccountRelay.sol`](../../../packages/contracts/src/accounts/CeloGardenAccountRelay.sol)
  — authenticated CCIP proposal/finalisation; deliberately not a Safe owner, module, guard, Zodiac
  member, executor, spender or administrator.
- [`SettlementMessageCodec.sol`](../../../packages/contracts/src/libraries/SettlementMessageCodec.sol)
  — frozen v1 data-only command/ack payload codec.
- Plan hub: [`celo-garden-account-safe-ownership`](../../active/celo-garden-account-safe-ownership/),
  Linear PRD-821. Target topology is a 2-of-3 Safe of GardenAccount + protocol recovery Safe + Dev
  Guild recovery Safe, verified on pinned forks.

## Prior Green Goods analysis this hub builds on

- `commitment-pooling/exchange-architecture-brief.md` — the compatibility contract (three separate
  identities), backing modes, quoter, limiter, venue, the buy-vs-build fork (§6), settlement-rail
  generality (§7), guardrails (§8), evidence gates (§9), and the five GE questions (§10).
- `commitment-pooling/settlement-spec.md` — the split-state command/ack pattern and §10.3 gates.
- `commitment-pooling/pilot-evidence-spec.md` — §3 reciprocity, §5 exchange demand, §6 safeguards,
  §8 circulation, §9 privacy, §11 the September evidence packet.
- Linear [PRD-651](https://linear.app/greenpill-dev-guild/issue/PRD-651) — the four-stage
  evidence-gated path to exchange, redemption and federation.
- Linear [PRD-796](https://linear.app/greenpill-dev-guild/issue/PRD-796) — the compatibility freeze.

## Open / unverified

- Whether the **2026-08-19 Grassroots Economics conversation happened**, and what was said. No
  meeting notes and no calendar entry were found. `exchange-architecture-brief.md` §10 lists five
  prepared questions that remain the sharpest open items.
- Whether `GiftableToken.burn` still functions after expiry (docs say every transfer *including
  mint* reverts; burn-to-zero is ambiguous). Must be settled on a fork.
- Live configuration of the CLC Gnosis deployment: owner vs ERC1967 admin on each proxy,
  `ProtocolFeeController.isActive()` / `getProtocolFee()`, `FeePolicy.getDefaultFee()`,
  `SwapPool.isSealed(0)`. All readable on-chain today — see `plan.todo.md` Slice 0.
