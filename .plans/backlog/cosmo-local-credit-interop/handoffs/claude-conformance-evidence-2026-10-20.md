# Conformance evidence: CLC bytecode and CCIP extra-args (read-only)

**Observed:** 2026-10-20T05:42Z UTC. Gnosis block 48848261 (timestamp 2026-10-20T05:42:25Z) for
the code reads; Gnosis blocks 48848261 to 48848263 and Arbitrum blocks 516507398 to 516507430
(2026-10-20T05:42:38Z) for the router calls. Every read was `eth_getCode`, `eth_call` or
`eth_blockNumber` through `cast` 1.7.1 against the public endpoints `https://rpc.gnosischain.com`
and `https://arb1.arbitrum.io/rpc`; nothing was signed or broadcast. Build artifacts came from the
GitHub contents API. **Clean room held:** only the published `pkg/publish/contracts/*/*.bin`
build outputs (hex text) were downloaded; no `src/` file and no explorer source endpoint was
opened. The downloads sat in an isolated scratch folder and were compared by a script kept outside
that folder, run with `python3 -I`.

This file closes the two items the [second-pass review](claude-architecture-review-results.md)
left pending in findings F2 and F5. Labels follow the research skill.

## 1. Conclusions

| Item | Result | Label |
|---|---|---|
| Deployed Gnosis implementations versus published artifacts | The deployed runtime code of `GiftableToken`, `SwapPool`, `Limiter` and `ERC1967Factory` is byte-identical to the runtime embedded in the published v1.0.0 creation artifacts: each runtime is the exact suffix of its creation code, metadata included. The v1.0.0 and v1.1.0 artifacts are byte-identical for all four. | ESTABLISHED |
| README compiler line | The embedded CBOR metadata records solc 0.8.34 (`solc` value bytes `00 08 22`) for all four deployed implementations; the README says 0.8.36. Conformance is unaffected. Anyone verifying these contracts on Gnosisscan should compile with 0.8.34. | CORRECTED |
| CCIP lane support | Both routers report `Router 1.2.0`; `isChainSupported` is true in both directions; the Arbitrum on-ramp for Gnosis and the Gnosis on-ramp for Arbitrum both report `OnRamp 2.0.0`. | ESTABLISHED |
| Extra-args acceptance | `getFee` on both routers accepts `EVMExtraArgsV1` (the form the settlement codec builds), `GenericExtraArgsV2` and empty extra-args, and quotes the same fee for all three in each direction. | ESTABLISHED at the fee-quoter level |
| What is still open | A fee quote is not a delivery. No `ccipSend` was made, so end-to-end execution on the 2.0.0 lane stays a rehearsal and testnet item, as PRD-1096 and PRD-1326 already say. | UNRESOLVED by design |

## 2. Part A: bytecode conformance

Artifacts at tag v1.0.0 (`94e52d06d848e328fecd0999e7d28460381469db`) and tag v1.1.0
(`ce090fd3d5a7493c726fb939da39af15ef1c9d7c`), fetched as
`pkg/publish/contracts/<name>/<Name>.bin` (hex text beginning `6080604052`):

| Contract | Artifact size (hex chars) | sha256 of the v1.0.0 artifact | Identical at v1.1.0 |
|---|---|---|---|
| GiftableToken | 11361 | `fef1d94488d77a041380e5273ce6660ac735cfa5da038b500a7d37419b6e820b` | yes |
| SwapPool | 22749 | `9919b0794475c50db3801057df2fbbcf6072889af55880f9cac854b6f9ece9ba` | yes |
| Limiter | 4403 | `3cfa1c10118868b1b7d4c698b96163d9c042e0fa7dbd7082180266db5a59ccb0` | yes |
| ERC1967Factory | 3831 | `27ee451f95651859997a85e09ff54fae3b313c72da1ea17a477c4137e98017d3` | yes |

Deployed code at Gnosis block 48848261:

| Contract | Address | Runtime bytes | keccak256 of runtime | Creation bytes | keccak256 of creation artifact | Runtime offset in creation | Verdict |
|---|---|---|---|---|---|---|---|
| GiftableToken | `0x34445d13F112A11f72C1d353a7dcdc407F3df2d8` | 5543 | `0x074980d5e0e6bfb3afd2faa9f828cf65d65ae7ed568f65b2623fa61190e95d91` | 5680 | `0xb6fd18596967e0176404607fc0c5f28fb02849bd402c1e169f33763927755466` | 137, exact suffix | match |
| SwapPool | `0x9e694D342Cab02e295262B2290b0E64A0334160D` | 11237 | `0xc353aac7dd541d1c50c7eeb20a15a44ea9f93524f23a26217a557667ddd87847` | 11374 | `0xa824bbc032790b7418034e9233ace1a24bbefe9bbd6790489987a8a2d2cd48d6` | 137, exact suffix | match |
| Limiter | `0x258AAd6c933F70D7F071E112800a41Fb60434048` | 2064 | `0x4703592f66925654d50872a319602d2ec144698515abc9e4df00c36d5b4a3d32` | 2201 | `0xda701af552bafa9ff0d3b4a2f6e990313c8a0c86cae8113190301ab19ee50549` | 137, exact suffix | match |
| ERC1967Factory | `0xB286994c648F98fD3a3BA6C43934828a5b88162b` | 1887 | `0x2e06e9a024d7bd35356833e6fcb9f34c1fbdae8bbd91da3bc55e4cc2ba4d1230` | 1915 | `0x2c419bbd4921888180c79ae61a371326db441063745a84675e4b538834c157fd` | 28, exact suffix | match |

Method: the creation artifact is the init code; for a contract deployed by plain `CREATE` with no
constructor arguments and no immutables, the runtime is the trailing portion of that init code.
The check was `creation.endswith(runtime)` on the decoded bytes, confirmed by locating the runtime
inside the creation code (offset above) and by repeating the search with the 53-byte CBOR metadata
tail removed from the runtime. All four matched including metadata, so no metadata-only difference
had to be tolerated.

Metadata tail of every deployed implementation (identical layout, differing only in the ipfs
digest): `a2 64 69706673 58 22 1220 <32-byte digest> 64 736f6c63 43 00 08 22 00 33`. The `solc`
value `00 08 22` is version 0.8.34. The README's "Solidity 0.8.36" line therefore does not
describe these builds. This changes nothing about conformance to the published artifacts, which
are the thing the Green Goods proxies would point at.

Not checked: the other sixteen implementation addresses in the README table, because the
integration uses only the token, pool, limiter and factory in its first slice; the remaining
dependency instances (fee policy, index, quoter) can be checked the same way before PRD-1325.

## 3. Part B: CCIP routers and fee quotes

| Read | Arbitrum One router `0x141fa059441E0ca23ce184B6A78bafD2A517DdE8` | Gnosis router `0x4aAD6071085df840abD9Baf1697d5D5992bDadce` |
|---|---|---|
| `typeAndVersion()` | `Router 1.2.0` | `Router 1.2.0` |
| `isChainSupported(other)` | true for selector `465200170687744372` (Gnosis); also true for Celo `1346049177634351622` | true for selector `4949039107694359620` (Arbitrum); false for the `2^64 - 1` control |
| `getOnRamp(other)` | `0x7B73923E101950eFe098C2Eca74C8320b2813f48`, `OnRamp 2.0.0` | `0x7FcD7604e66AD383b82cD899Aa2aa6b1cf41448B`, `OnRamp 2.0.0` |

Fee quotes for a data-only `EVM2AnyMessage` (receiver = abi-encoded
`0x15c8F6CF25abA2161cc04719b4C4a93c4146935D`, 400 bytes of data, no token amounts, native fee
token), gas limit 200000 in each extra-args form:

| Direction | Block | `EVMExtraArgsV1` (`0x97a657c9`) | `GenericExtraArgsV2` (`0x181dcf10`, out-of-order allowed) | Empty extra-args |
|---|---|---|---|---|
| Arbitrum to Gnosis | 516507430 | 45,710,905,756,923 wei (about 0.0000457 ETH) | same | same |
| Gnosis to Arbitrum | 48848263 | 140,025,061,685,540,473 wei (about 0.140 xDAI) | same | same |

No call reverted. The identical quotes for the empty form indicate the lane applies its default gas
limit when none is given; the settlement codec always sets one. The quotes match the 10 October
reads within a few percent (0.000044 ETH and 0.140 xDAI then), so the fee reserve sizing in the
review stands: about 0.0025 ETH on Arbitrum and about 8 xDAI on Gnosis for fifty commands with
acknowledgments, before margin.

Exact commands (addresses and selectors as above, `$V1` and `$V2` the extra-args hex strings
shown in section 1 of the review's F5 context):

```bash
cast call <router> "getFee(uint64,(bytes,bytes,(address,uint256)[],address,bytes))(uint256)" <destSelector> "(<receiver32>,<data400>,[],0x0000000000000000000000000000000000000000,<extraArgs>)" --rpc-url <rpc>
```

## 4. What PRD-1319 and PRD-1325 can now treat as proven

Proven, at the blocks above: the four Gnosis implementations the first slice depends on are the
published v1.0.0 build (identical to v1.1.0), so hand-written interfaces from `docs/SPEC.md` at
either tag describe the deployed code; the Arbitrum to Gnosis lane is live in both directions on
2.0.0 on-ramps behind 1.2.0 routers; and the existing `EVMExtraArgsV1` message shape is quoted by
both routers, so `SettlementCommandLib._buildMessage`
([CommandLib.sol:227-244](../../../../packages/contracts/src/lib/Settlement/CommandLib.sol#L227))
needs no change for a Gnosis peer. Still pending: a re-read of the same facts at the deployment
block, conformance of the fee policy, index and quoter implementations if they are used, Pimlico
and account facts for members (review F4), and the first real `ccipSend` on a testnet or in the
PRD-1326 rehearsal. The README compiler line is a documentation correction to raise with
Grassroots Economics on the next call, not a blocker.

## 5. Verification record

| Step | Command | Result |
|---|---|---|
| Artifact fetch | `gh api repos/cosmo-local-credit/protocol/contents/pkg/publish/contracts/<c>.bin?ref=<tag commit>` | 8 files, 4 per tag, sizes above |
| Tag identity | sha256 of each pair | identical for all four |
| Code reads | `cast code <addr> --rpc-url https://rpc.gnosischain.com --block 48848261` | four runtimes, lengths and keccaks above |
| Comparison | `python3 -I compare.py <artifacts> <deployed>` (script outside the download folder) | exact suffix match for all four; metadata parsed |
| Router facts | `cast call ... typeAndVersion()`, `isChainSupported(uint64)`, `getOnRamp(uint64)` on both routers; `typeAndVersion()` on both on-ramps | table in section 3 |
| Fee quotes | `cast call ... getFee(...)` three extra-args forms per direction | table in section 3 |
| Hub structure | `node scripts/harness/plan-hub.mjs validate --feature cosmo-local-credit-interop` after writing | recorded in the closing handoff |

Task record: CLC bytecode conformance and CCIP extra-args proof | Type: investigation | Outcome:
complete for the bounded question; no implementation, deployment or tracker write.
Agent/model: Claude Code, Claude Fable 5.1 (claude-fable-5-1) | Coverage: this segment only.

| Phase | Start to end (UTC, 20 October 2026) | Result / evidence |
|---|---|---|
| Fetch and read | 05:40 to 05:43 | Artifacts at both tags; deployed code at block 48848261; router facts and fee quotes |
| Compare and confirm | 05:43 to 05:50 | Suffix match for four contracts; metadata compiler bytes; on-ramp versions |
| Record | 05:50 to 06:00 | This file; review artifact F2 and F5 updated |

Human corrections: 0 in this segment; attention: unknown. Timestamps are observed boundaries, not
effort.
