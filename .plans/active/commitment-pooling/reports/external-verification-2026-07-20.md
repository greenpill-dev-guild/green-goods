# Commitment Pooling external-claim verification — 2026-07-20

**Purpose:** distribution gate for the GoodDollar, House of Alignment, canonical-token, market, and funding claims used by Commitment Pooling. This is a primary-source reread, not permission to distribute. Any `BLOCKED` row keeps external distribution blocked.

## Primary-source results

| Claim | Current primary source | Result | Distribution treatment |
|---|---|---|---|
| GoodDollar V4 makes Celo the primary mint/burn and reserve chain; bridge direction is Celo-primary | [GIP-24](https://discourse.gooddollar.org/t/gip-24-gooddollar-v4-celo-reserve-and-protocol-enhancements/7233) | **VERIFIED** | May be stated with the source date and without implying G$ exists natively on Arbitrum. |
| V4 starts at `1 G$ = $0.0001`, uses a 10% exit fee that may fall toward 5%, and names 40K cUSD weekly / 80K cUSD monthly outflow limits | [GIP-24](https://discourse.gooddollar.org/t/gip-24-gooddollar-v4-celo-reserve-and-protocol-enhancements/7233) | **VERIFIED AS PROTOCOL POLICY** | May be cited as GIP-24 policy; do not present the future fee path as an observed current market rate. |
| Canonical production G$ on Celo is `0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A` | [GoodDocs core contracts](https://docs.gooddollar.org/about-the-protocol/protocol-v4-documentation/core-contracts-and-api), [GoodDocs integration guide](https://docs.gooddollar.org/for-developers/developer-guides/how-to-integrate-the-gusd-token) | **VERIFIED** | Address may be used in settlement configuration only after the deployment lane independently checks chain ID and bytecode. |
| GIP-26 proposed Gardens, Green Goods, ReFi DAO, and Textile as four inaugural members; roughly $800/month in G$, a Flow State splitter, and a September 30 evaluation | [GIP-26](https://discourse.gooddollar.org/t/gip-26-begin-distributions-to-house-of-alignment/8890) | **VERIFIED AS A FAILED PROPOSAL, NOT CURRENT PILOT TERMS** | Public copy must label these as proposal terms. |
| GIP-26 failed; Good Labs Foundation decided to fund a separate pilot with the same four members | [GIP-26 outcome update](https://discourse.gooddollar.org/t/gip-26-begin-distributions-to-house-of-alignment/8890?page=2), [GoodDAO 2.0 update](https://discourse.gooddollar.org/t/gooddao-2-0-gooddollar-governance-re-vision-update/9016) | **VERIFIED** | May be stated. The pilot is Foundation-funded, not an implementation of the failed protocol-emissions change. |
| The Foundation-funded pilot uses the same ~$800/month amount, Flow State splitter, exact September 30 obligation, and has started | The June 23 GoodDAO update says distributions will start soon and asks which mechanism should distribute the funds | **BLOCKED / NOT VERIFIED** | Do not state these as current facts. Obtain a current Good Labs/GoodDollar confirmation. |
| House of Alignment funding currently lands directly in the Green Goods protocol Safe on Celo | No current public primary source found; no live Safe receipt or partner confirmation was available in this session | **BLOCKED / NOT VERIFIED** | Describe direct-to-protocol-Safe as Green Goods' designated topology only. Settlement and distribution need receiving-address plus receipt evidence. |
| July 2026 G$ venue volumes and market depth | The stored CoinGecko numbers conflict with one another and are not issuer/onchain primary evidence | **BLOCKED / NOT VERIFIED** | Do not distribute the numeric market paragraph. Re-sample one timestamp from verifiable onchain venues or remove the figures. |

## Partner and live-evidence gates still open

- GoodDollar / Good Labs must confirm the Foundation-pilot amount, mechanism, start state, reporting date and criteria, and the intended Green Goods recipient.
- Green Goods must record the protocol Safe address and a matching Celo receipt or signed partner confirmation without exposing sensitive operational material.
- Linear and the canonical Google Doc must be live-read after those facts are confirmed; repository wording alone is not convergence proof.
- The current product/runtime claims in the external brief (live-garden count, marketplace availability, and vault status) require a separate current runtime/deployment proof before distribution. This pass did not turn source copy into live product evidence.

**Gate result:** `BLOCKED`. The repo now distinguishes verified protocol facts, failed-proposal terms, and still-unverified Foundation-pilot terms.
