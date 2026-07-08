# RWA Yield Expansion Evaluation Plan

## Release Gates

1. **Correctness:** `PresetRegistry` stores Conservative + Balanced presets immutably (new ID per version); `MultistrategyVault` debt allocation stays inside preset bands under on-flow rebalance; `RedemptionQueue` honors FIFO with NAV-at-request pricing; existing vaults auto-migrate to Conservative in a single atomic upgrade tx.
2. **Security:** External audit clears `PresetRegistry` + `RedemptionQueue` + new strategy adapters before **2026-05-30 contract freeze**. `RebalancePolicy` library is pure and hits **≥95% mutation score** (stretch 99%). `PRESET_ADMIN` / `OPERATOR` / `PAUSER` Hat roles gate all admin paths; 48-hour timelock enforced on operator-initiated preset switches. Emergency withdraw only after **14 days** of vault pause.
3. **Yield target:** Rolling **30-day APY ≥ 5%** on at least one mainnet Octant Vault post-audit-deploy.

## Acceptance Checks

| ID | Check | Owner | Evidence |
|---|---|---|---|
| AC-1 | `PresetRegistry` UUPS-upgradeable; Conservative v1 + Balanced v1 registered with sum(targetBps) + bufferBps == 10_000 | `contracts` | `bun run test -- --match-contract PresetRegistryTest -vvv` green; preset IDs committed in deployment artifact |
| AC-2 | `RedemptionQueue` FIFO at NAV-on-request; settles on claim; per-vault; buffer % drains before touching strategies | `contracts` | Forge invariant tests green; fuzz covers queue ordering + NAV drift |
| AC-3 | `RebalancePolicy` library pure (no state); mutation score **≥ 95%** (stretch 99%) | `contracts` | `bun run test:mutation` or equivalent report committed to `artifacts/` |
| AC-4 | On-flow rebalance triggers + Gelato keeper safety net hold debt allocation inside preset bands under adversarial flow sequence | `contracts` | Forge integration test + keeper simulation log in `artifacts/` |
| AC-5 | Existing vault auto-migrates to Conservative on upgrade in a single atomic tx; no withdrawal lockup during migration | `contracts` | Fork test against live mainnet vault state; upgrade path green |
| AC-6 | Hats V2 roles wired: `PRESET_ADMIN` owns `PresetRegistry`; `OPERATOR` switches presets (48h timelock); `PAUSER` pauses vault | `state_api` | Hat role assignment persisted; role-gated call matrix covered by tests |
| AC-7 | `useVaultOperations` / `useVaultPreset` extensions render queued withdrawal, buffer %, preset badge, 48h countdown in `VaultPositionCard` | `ui` | Admin Storybook stories + Chrome MCP spot-check across Conservative / Balanced / pending-switch states |
| AC-8 | External audit complete and clean by **2026-05-30** contract freeze; mainnet deploy **2026-06-30** | `qa_pass_1` | Audit report committed to `.plans/active/rwa-yield-expansion/artifacts/`; deploy tx + block explorer link |
| AC-9 | Rolling **30-day APY ≥ 5%** sustained on at least one mainnet Octant Vault post-deploy | `qa_pass_2` | On-chain NAV snapshots at deploy + 30 days; APY computed from `totalAssets` delta; evidence in `history[]` |

## Test Strategy

- Unit: `PresetRegistry`, `RedemptionQueue`, `RebalancePolicy` (library), Morpho + Ondo strategy adapters; `useVaultOperations` / `useVaultPreset` hooks.
- Integration: Forge tests against mainnet fork (Aave V3, Morpho Metamorpho, Ondo USDY); Gelato keeper dry-run against simulated flow sequence; upgrade path from current live vault state.
- E2E / Playwright: admin preset picker with 48h countdown + cancel; queued-withdrawal state in `VaultPositionCard` across Conservative / Balanced / pending-switch.
- Manual checks:
  - Audit engagement booked with firm by **2026-05-15** (bundled with `SessionKeyValidator.sol` from `agent-messaging-channels`).
  - `PRESET_ADMIN` / `OPERATOR` / `PAUSER` Hat IDs minted to intended signers.
  - Gelato keeper task provisioned + funded on Arbitrum.
  - NAV snapshot cron enabled for 30-day APY evidence at deploy + 30 days.

## QA Sequence

### Claude QA Pass 1

- Run admin Storybook + Chrome MCP over preset picker + queued-withdrawal UX.
- Validate i18n + regenerative vocabulary (`bun run lint:vocab`) for yield copy — no banned terms (no "leaderboard", "FOMO", etc.).
- Record audit status + audit report location in `history[]`.
- If audit slips, record in `handoffs/claude-qa-pass-1.md` and hold mainnet deploy.

### Codex QA Pass 2

- Start only after `qa_pass_1` is passed and `claude/qa-pass-1/rwa-yield-expansion` exists, **and** audit report is green.
- Re-run mainnet-fork invariants + Gelato keeper dry-run against latest state.
- Confirm mutation score meets ≥95% bar on `RebalancePolicy`.
- Snapshot mainnet APY at deploy + 30 days; confirm AC-9 evidence before outcome milestone #13 close.
