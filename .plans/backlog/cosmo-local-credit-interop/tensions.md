# Integration Tensions — Green Goods × Cosmo-Local Credit

**Date**: 2026-08-25
**Posture**: analysis only
**Source basis**: `cosmo-local-credit/protocol` `README.md` / `docs/SPEC.md` / `docs/DEPLOY.md`,
`cosmolocal.credit/llms-full.txt`, Chainlink CCIP mainnet directory, and the Green Goods contracts
at the commit this hub was created on. **No AGPL `src/` was read.**

Ordered by how much each hurts if discovered late.

---

## 1. Ownership — what you control and what you do not

Decided: transact against CLC's **live** Gnosis deployment. That makes the ownership split the
sharpest single item in this document.

**Green Goods owns** its `GiftableToken` voucher class. Owner; grants `writer` to the mint adapter.
One asymmetry matters: `burn(amount)` is **owner-only and burns from the caller's own balance**.
Green Goods cannot burn a holder's voucher. Redemption-by-burn requires the holder to send it back,
or the pool to hold it.

**Cosmo-Local Credit owns everything else that decides your economics:**

| Contract | What their owner controls |
|---|---|
| `RelativeQuoter` | `setPriceIndexValue(token, rate)` — **they set what the community's work is worth relative to everything else in the pool** |
| `TokenUniqueSymbolIndex` | listing. `remove` de-lists, and per `SwapPool` validation both `tokenIn` and `tokenOut` must pass the registry check — so **de-listing stops entry *and exit*, trapping holders** |
| `Limiter` | how much of the voucher the pool will absorb |
| `SwapPool` | `withdrawLiquidity` is an owner-only emergency withdrawal of pool liquidity |
| `FeePolicy` / `ProtocolFeeController` | rates, changeable at any time |

### Seal semantics — two easy misreadings

`SwapPool.seal(state)` is a bitmask permanently locking `feePolicy`, `feeAddress`, `quoter`,
`tokenRegistry`, `tokenLimiter` (bits 1/2/4/8/16, `maxSealState` 31).

- *"Sealing an address locks the slot, not the callee: a sealed `quoter` or `feePolicy` can still
  change its own rates."* **"The pool is sealed" does not mean the rate is fixed.**
- Seal is only a commitment when the ERC1967 proxy admin is a different, more conservative principal
  than the owner. `ge-publish` requires `--admin` and rejects `admin == owner` — but that is a
  deploy-time check, not an ongoing guarantee.
- `fullSealMask` is written at `initialize` and frozen, so adding a seal bit in a later
  implementation does not silently unseal existing pools. That part is sound.

### Fees

- `FeePolicy`: a zero-fee pool **is** expressible via `defaultFee = 0`. What is not expressible is a
  zero fee for one pair while others are charged — *"a pair fee of `0` is treated as unset"* and
  falls back to `defaultFee`. Use `removePairFee` to clear an override.
- Protocol fee sits on top of the pool fee, computed against a **1% assumed floor**
  (`DEFAULT_FEE_PPM = 10_000`) explicitly so *"a pool operator can't set a tiny pool fee just to
  shrink the protocol's cut."* Skipped entirely only if the controller is unset, its ppm is 0, or the
  recipient is zero.
- The whitepaper's network layer sits above this: rake `τ_p = f_p · r_p`, a monthly waterfall funding
  insurance reserve / core ops / liquidity mandates, and CLC / stCLC / sCLC gauge voting deciding
  which pools receive incentives. **Green Goods has no weight in that governance unless it
  participates.**

### Mitigation

- The reserved `settlementAdapter` should treat the CLC pool as an **external venue** with explicit
  handling for de-listing, rate change, limit change and pool insolvency.
- Green Goods always publishes the garden's own declared valuation **alongside** the pool's rate, so
  the two are never confused.
- Due diligence is entirely on-chain and available today — see `plan.todo.md` Slice 0.

---

## 2. External marketplaces mean external pricing

Green Goods guardrails — no leaderboards, mutual-aid vocabulary, `lint:vocab`'s banned list, *"care
work is not reduced to a tradeable price"* — govern **Green Goods surfaces**. They cannot follow an
ERC20.

**You cannot simultaneously make care work externally visible and exchangeable and guarantee it will
not be priced.** Someone will quote an hour of cooking against a stablecoin, and it will not be you.

Decided posture: **constrain the marketplaces Green Goods creates** so they work with Green Goods
rules, while enabling the market aspects CLC supports. The conceptual `VoucherClass` already reserves
`transferPolicy` as the mechanism for narrowing where a class may move.

Residual, accepted: outside the constrained set, external pricing happens and Green Goods does not
control it. Worth stating plainly in external material rather than implying otherwise.

---

## 3. Chain split — proof and instrument on different chains

Commitments, EAS, Hats, Hypercerts and 18 pools are on Arbitrum. Vouchers and pools are on Gnosis.
`networks.json` has no chain-100 entry.

**Resolved by the existing pattern.** Arbitrum emits a *mint authorization*; Gnosis mints locally.
Nothing crosses but a message, so "no bridged value ever" is preserved without amendment — the same
shape as `SettlementMessageCodec`'s frozen v1 command/ack for G$.

CCIP is live: Gnosis chain selector `465200170687744372`, **Arbitrum One lane at OnRamp v1.5.0**, fee
tokens GHO / LINK / WXDAI / native XDAI.

Remaining work is real but known-shape: a Gnosis executor deployment, a published and verified lane,
a `ConsiderationRail` enum member, and a reviewed UUPS upgrade — `exchange-architecture-brief.md` §7
already describes exactly this. The relay pattern in `CeloGardenAccountRelay` (authenticated CCIP
proposal/finalisation, replay guard, nonce, expiry, action hash, deliberately not an owner or
module) transfers directly.

---

## 4. Transferability breaks counterparty confirmation

Green Goods confirmation is counterparty-first: the person helped confirms. A `GiftableToken` is a
bearer instrument. If a voucher changes hands three times, whoever redeems it is **not** the person
the service was originally for.

Half of this is already guarded — *"holding or transferring a voucher grants no authority over the
promise, provider, claimant, contributors, confirmation, dispute, recognition, or Story."*

The other half is open: **the redemption event has no confirmed counterparty in the Green Goods
sense.** Fulfilment confirmation and redemption confirmation become two different events with two
different confirmers, and only the first fits the machinery that exists. Needs a design answer before
any redemption path ships.

---

## 5. Expiry is a cliff, and should not be used

`GiftableToken.initialize(..., expiresAt)`; `expiresAt = 0` means never. Once
`block.timestamp >= expiresAt`, *"every transfer (including mint) reverts with `TokenExpired`."*
Expiry flips on the first transfer at or after the timestamp, or explicitly via `applyExpiry()`,
which anyone may call.

The token freezes completely. Value does not decay — it vanishes, and the holder cannot even move it
somewhere to rescue it. Whoever loses out is whoever was slowest to redeem, which is systematically
the least-engaged person. That is strictly worse than demurrage and it is
`pilot-evidence-spec.md`'s "failed redemption remains visible and repairable" gap in its most
damaging form.

### Options

| # | Approach | Assessment |
|---|---|---|
| 1 | **`expiresAt = 0`; scope by issuance.** One class per campaign; cycle close revokes the mint writer rather than killing the token. Holdings stay valid and transferable; redemption is a Green Goods-side obligation with a visible figure | **Recommended** |
| 2 | Expiry plus grace window and pre-expiry sweep | Depends on holders acting — reintroduces the same equity problem |
| 3 | Demurrage | No primitive in their contract set, and modifying their token crosses the AGPL line. Could decay a contribution's *salience in reporting* without touching balances |
| 4 | Two-token split (non-expiring record unit + expiring circulating unit) | Overbuilt for v1 |

Option 1 has a bonus: **the outstanding unredeemed balance becomes a first-class number instead of
something that silently disappears.** That is CLC's own `D_tot` — total outstanding redeemable
obligations — and it is a genuine funder signal. Expiry then becomes a policy a garden decides
explicitly rather than a default that bites.

It also composes with campaign-scoped valuation: one token per campaign means the campaign's weights
are baked into that token's issuance, and the token *is* the versioned artifact.

**To verify on a fork**: whether `burn` still functions after expiry. The spec says every transfer
including mint reverts; burn-to-zero is ambiguous from documentation alone, and it determines whether
a redemption path survives an expired class.

---

## 6. The Limiter caps contracts, not people

`setLimitFor(token, holder, value)` is owner-or-writer and **rejects externally owned accounts**
(`InvalidHolder`, via an `extcodesize` check — which also means a limit cannot be set in the same
transaction that deploys the holder contract). `SwapPool` enforces on deposit. A limit of `0` **blocks
all deposits**, so the default is fail-closed: a voucher cannot enter the pool until a non-zero limit
exists.

So listing and limit are two separate gates, both CLC-controlled.

**Not a problem — the granularity is correct.** The amount a pool will absorb of a garden's voucher
**is that community's credit line**, set at community level by track record and relationship, never
per person. That is precisely the shape the anti-scoring rule wants. Per-member caps stay Green
Goods-side where the governance is. The only thing to internalise is that the credit line is a number
someone else sets — the way a credit union sets one.

---

## 7. Identity — solved for gardens, open for gardeners

`CeloGardenAccountDeploymentCoordinator` reconstructs the frozen CREATE2 dependency closure and
deploys all 18 foreign-tuple GardenAccounts at their **exact Arbitrum addresses** on Celo in one
transaction, refusing any init code failing the frozen length, hash, CREATE2-target and runtime-hash
checks. `ACCOUNT_SALT` is constant; source chain pinned to 42161. Verified on pinned forks under
PRD-821, with a target 2-of-3 Safe of GardenAccount + protocol recovery Safe + Dev Guild recovery
Safe.

For **garden organisation accounts**, Gnosis is a sibling deployment of proven tooling.

**But that coordinator does not solve gardener identity, and vouchers for individuals go to
gardeners.** It deploys exactly `GARDEN_COUNT = 18` ERC-6551 accounts keyed by `GardenToken` token
IDs — garden organisation accounts and nothing else. Individual contributors authenticate with
per-person Pimlico Kernel accounts
([`auth-passkey-adapters.ts`](../../../packages/shared/src/workflows/auth-passkey-adapters.ts)), an
entirely different derivation with its own cross-chain determinism question. Pointing the coordinator
at the gardener path would reproduce garden accounts and mint to the wrong recipients.

So the honest state is:

| | Status |
|---|---|
| Garden accounts, same address across chains | **Proven** on pinned forks under PRD-821 |
| Gardener Kernel accounts, same address across chains | **Unproven.** Plausible for a deterministic factory with a fixed salt, but not verified, and it is the path vouchers actually take |

**Caveat 1**: the coordinator is one-shot and chain-pinned by constant, so Gnosis is a new instance,
not a reuse.
**Caveat 2**: same *address* is not same *account* on either path. The account still has to be
deployed on Gnosis, and Pimlico needs its own Gnosis bundler and paymaster configuration and funding.
Passkey userOps spend sponsorship per transaction.

---

## 8. Licensing

`cosmo-local-credit/protocol` `src/` is **AGPL-3.0**; unmodified Solady stays MIT; `NOTICE` carries
attributions.

Safe posture, and it is the pattern the repo already uses for ~30 external protocols
(`IHats`, `IGardensV2`, `IJuicebox`, `IUnlock`):

- Hand-write `ISwapPool`, `ILimiter`, `IQuoter`, `IGiftableToken`, `ITokenIndex` from
  `docs/SPEC.md` — documentation, not source.
- Deploy via their `ge-publish` tool run **externally**, never vendored.
- Never import `src/`. Never vendor their Go package.

Interface implementation is not derivation; vendoring is. The counsel question pending since July
only bites past that line, and the repo's stricter clean-room rule (no AGPL source read at all)
remains satisfiable.

---

## Cross-cutting: what none of this fixes

The gates in Linear [PRD-651](https://linear.app/greenpill-dev-guild/issue/PRD-651) are unchanged.
Federation is stage four of four: field evidence of real exchange demand → fulfilled-backed issuance
→ one bounded pool proving authorised issue, bounded seed, exchange in/out, redemption, liquidity,
failed-redemption visibility and repair → then separately gated federation. Every pooling-tier
mainnet action still needs external audit, 3-of-5 Safe ownership, a 48-hour timelock, two weeks of
testnet operation, tested rollback, and explicit human authorization.

Nothing in this document shortens that. What it does is make sure the design decisions taken now —
pool-local valuation, pool-scoped authority predicates, `expiresAt = 0`, weights at mint, one signal
primitive — do not foreclose the path.
