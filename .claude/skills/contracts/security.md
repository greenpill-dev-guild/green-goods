# Security Audit Patterns

> Sub-file of the [contracts skill](./SKILL.md). Covers smart contract security auditing, static analysis, and threat modeling.

## Progress Tracking (REQUIRED)

Use **TodoWrite** when available. If unavailable, keep a Markdown checklist in the response. See `CLAUDE.md` → Session Continuity.

---

## Part 1: Static Analysis Tooling

### Slither (Primary)

Use only when Slither is already installed or explicitly approved for the current
session. Do not install Python tooling from this skill.

```bash
# Run full analysis
cd packages/contracts
slither src/ --config-file slither.config.json

# Target specific contract
slither src/GardenAccount.sol

# Output formats
slither src/ --print human-summary    # High-level summary
slither src/ --print contract-summary  # Per-contract breakdown
slither src/ --json report.json        # Machine-readable
```

### Aderyn (Rust-based, faster)

Use only when Aderyn is already installed or explicitly approved for the current
session. Do not install external audit tooling from this skill.

```bash
# Run analysis
cd packages/contracts
aderyn src/

# Target specific paths
aderyn src/GardenAccount.sol src/GardenToken.sol
```

### Bun-Wrapped Foundry Checks

```bash
# Gas report through the package wrapper
bun run test:gas

# Invariant testing through the package test wrapper
bun run test -- --match-contract InvariantTest -vvv
```

Storage-layout and selector inspection still need an approved Bun wrapper before
they become executable checklist items. Until that wrapper exists, record them as a
contracts tooling follow-up rather than running raw `forge inspect` from this skill.

| Tool | Speed | Depth | Best For |
|------|-------|-------|----------|
| **Slither** | Medium | Deep | Comprehensive vulnerability detection |
| **Aderyn** | Fast | Medium | Quick pre-commit checks |
| **Foundry** | Fast | Targeted | Storage layout, gas, invariants |

---

## Part 2: Vulnerability Checklist (OWASP Smart Contract Top 10)

### Critical Vulnerabilities

| Vulnerability | Detection | Green Goods Risk |
|---------------|-----------|-----------------|
| **Reentrancy** | Slither `reentrancy-*` detectors | Medium — contract calls external EAS |
| **Access Control** | Manual review of modifiers | High — Hats Protocol role checks |
| **Integer Overflow** | Solidity 0.8+ prevents most | Low — compiler protects |
| **Unchecked Return Values** | Slither `unchecked-lowlevel` | Medium — external calls |
| **Front-Running** | Manual review of state changes | Low — attestation timing |
| **Denial of Service** | Slither `dos-*` detectors | Medium — unbounded loops |
| **Tx Origin Auth** | Slither `tx-origin` | Low — not used |
| **Delegatecall Injection** | Slither `delegatecall-loop` | High — UUPS proxies |
| **Storage Collision** | Approved storage-layout wrapper or contracts tooling follow-up | High — UUPS upgrades |
| **Signature Replay** | Manual review of EIP-712 usage | Medium — EAS attestations |

### Reentrancy Protection

Checks-Effects-Interactions (CEI) is the default ordering for state-mutating paths that make external calls. It is not a substitute for authorization, invariant checks, storage safety, or a reentrancy guard where callbacks can cross another vulnerable path. Document any safe exception.

```solidity
// ✅ Checks-Effects-Interactions pattern
error NotGardener(address caller);
error InactiveAction(bytes32 actionUID);

function submitWork(bytes32 actionUID) external {
    // CHECKS
    if (!isGardener(msg.sender)) revert NotGardener(msg.sender);
    if (!actions[actionUID].active) revert InactiveAction(actionUID);

    // EFFECTS (state changes first)
    workCount++;
    works[workCount] = Work(msg.sender, actionUID, Status.Pending);

    // INTERACTIONS (external calls last)
    eas.attest(attestation);
}

// ❌ Anti-pattern: state change after external call
function submitWork(bytes32 actionUID) external {
    eas.attest(attestation);  // External call first — DANGEROUS
    workCount++;              // State change after — reentrancy risk
}
```

---

## Part 3: Access Control Audit (Hats Protocol)

### Green Goods Role Hierarchy

```
Top Hat (DAO)
├── Garden Admin Hat
│   ├── Can: create gardens, manage operators
│   └── Wears: DAO multisig
├── Operator Hat (per garden)
│   ├── Can: approve work, assess gardens
│   └── Wears: assigned operators
└── Gardener Hat (per garden)
    ├── Can: submit work, view garden
    └── Wears: registered gardeners
```

### Access Control Review Checklist

```solidity
// For every external/public function, verify:
// 1. WHO can call it? (modifier or custom-error guard for privileged paths)
// 2. WHAT does it modify? (state changes)
// 3. CAN the role be escalated? (hat transfer/minting)

// ✅ Correct: explicit hat check
error NotOperator(address caller);

function approveWork(uint256 workId) external {
    if (!hats.isWearerOfHat(msg.sender, operatorHatId)) revert NotOperator(msg.sender);
    // ...
}

// ❌ Dangerous: no access control
function approveWork(uint256 workId) external {
    // Anyone can approve — CRITICAL vulnerability
    works[workId].status = Status.Approved;
}
```

### Hat Permission Matrix

| Function | Required Hat | Escalation Risk |
|----------|-------------|-----------------|
| `createGarden` | Garden Admin | Low — admin-only |
| `submitWork` | Gardener | Low — self-service |
| `approveWork` | Operator | Medium — operator compromise |
| `assessGarden` | Operator | Medium — operator compromise |
| `mintHat` | Top Hat (DAO) | High — creates new roles |
| `transferHat` | Hat Admin | High — reassigns roles |
| `upgradeProxy` | Top Hat (DAO) | Critical — changes implementation |

### Common Access Control Bugs

| Bug | Example | Fix |
|-----|---------|-----|
| Missing modifier | `function withdraw() external { ... }` | Add role check |
| Wrong hat ID | Checking gardener hat for operator action | Verify hat ID mapping |
| Stale hat status | User lost hat but still cached | Check `hats.isWearerOfHat` at call time |
| Admin key centralization | Single EOA as top hat | Use multisig/timelock |

---

## Part 4: UUPS Upgrade Security

### Storage Layout Safety

```bash
# Before ANY upgrade, verify storage compatibility with an approved Bun wrapper.
# If no wrapper exists for the target contract, stop and create a contracts
# tooling follow-up instead of running raw forge commands from agent guidance.
```

### Upgrade Security Rules

```solidity
// ✅ MANDATORY: Storage gap for future variables
uint256[50] private __gap;

// ✅ MANDATORY: Restrict upgrade authority using the contract's established owner model
function _authorizeUpgrade(address) internal override onlyOwner {}

// ❌ NEVER: Allow arbitrary upgrades
function _authorizeUpgrade(address) internal override {}

// ❌ NEVER: Change storage variable order in upgrades
// Existing:  uint256 a; uint256 b;
// Wrong:     uint256 b; uint256 a;  // Swapped — storage collision!
// Wrong:     uint256 c; uint256 a; uint256 b;  // Inserted — shifts slots!
// Correct:   uint256 a; uint256 b; uint256 c;  // Append only
```

### Pre-Upgrade Checklist

- [ ] Storage layout compared (no slot changes for existing vars)
- [ ] `__gap` reduced by number of new variables added
- [ ] `_authorizeUpgrade` still enforces the contract's established owner/authority model
- [ ] Initializer not re-callable (`initializer` modifier)
- [ ] All tests pass against upgrade scenario
- [ ] Dry run on testnet fork through an existing Bun deploy/upgrade dry-run wrapper; add a wrapper first if the target operation has no checked-in wrapper.

---

## Part 5: Pre-Deployment Security Review

### Mainnet Gate Checklist

- [ ] **Production readiness**: `bun run verify:contracts` passes (build → lint → tests → E2E → dry runs on all chains)
- [ ] **Static analysis**: Slither + Aderyn clean (no HIGH/CRITICAL)
- [ ] **Access control**: Every privileged state-changing function enforces the correct authority; permissionless and view paths are explicitly understood
- [ ] **Reentrancy**: State-mutating external-call paths follow CEI or use a documented safe exception/guard
- [ ] **Upgrade safety**: Storage layout preserved
- [ ] **Gas limits**: No unbounded loops over user-controlled arrays
- [ ] **Event emission**: All state changes emit events (for indexer)
- [ ] **Error messages**: Custom errors (not `require` strings) for gas efficiency
- [ ] **Fuzz testing**: Property-based tests for critical paths
- [ ] **Invariant testing**: System-wide invariants hold
- [ ] **Testnet verification**: Deployed and tested on Sepolia

### Severity Classification

| Severity | Criteria | Action |
|----------|----------|--------|
| **Critical** | Fund loss, unauthorized upgrade, broken access control | Block deployment, fix immediately |
| **High** | State corruption, DoS, incorrect attestations | Block deployment, fix before mainnet |
| **Medium** | Gas inefficiency, missing events, edge case bugs | Fix recommended, can deploy with acknowledgment |
| **Low** | Code style, naming, documentation | Fix in next iteration |
| **Informational** | Best practice suggestions | Log for future improvement |

---

## Part 6: Threat Modeling

### Green Goods Threat Actors

| Actor | Motivation | Attack Surface |
|-------|-----------|---------------|
| **Malicious gardener** | Fake work submissions | IPFS media, attestation data |
| **Compromised operator** | Approve fake work | Operator hat, approval flow |
| **External attacker** | Exploit contract bugs | Public functions, flash loans |
| **Insider (DAO member)** | Unauthorized upgrade | Top hat, proxy admin |

### Attack Scenarios

```
1. Fake Work Attack:
   Gardener → submit fake photos → get approved → extract rewards
   Mitigation: Operator review, on-chain media hashing, assessment scoring

2. Hat Escalation:
   Attacker → steal operator key → approve own work → drain rewards
   Mitigation: Multisig operator hats, time-locked approvals

3. Upgrade Attack:
   Attacker → compromise DAO key → upgrade to malicious impl
   Mitigation: Timelock, multisig, emergency pause

4. Indexer Manipulation:
   Attacker → emit fake events → corrupt indexer state
   Mitigation: Indexer validates against contract state, not just events
```

---

## Decision Tree

```
What security concern?
│
├─► Pre-deployment review? ────► Part 5: Full checklist
│                                 → Static analysis first
│                                 → Access control audit
│                                 → Upgrade safety check
│
├─► Specific vulnerability? ───► Part 2: OWASP checklist
│                                 → Run Slither for detection
│                                 → Manual review for context
│
├─► Access control issue? ─────► Part 3: Hats Protocol audit
│                                 → Hat permission matrix
│                                 → Role escalation review
│
├─► Upgrade concern? ──────────► Part 4: UUPS security
│                                 → Storage layout diff
│                                 → Authorization check
│
└─► Threat modeling? ──────────► Part 6: Threat actors
                                  → Attack scenarios
                                  → Mitigation review
```

## Anti-Patterns

- **Never deploy without static analysis** — Slither/Aderyn catch >60% of common bugs
- **Never skip storage layout checks** — UUPS storage collisions are silent and destructive
- **Never trust `tx.origin`** — always use `msg.sender` with hat checks
- **Never use `selfdestruct`** — deprecated and dangerous for proxies
- **Never store secrets on-chain** — all storage is publicly readable
- **Never assume msg.sender is an EOA** — contracts can call contracts
