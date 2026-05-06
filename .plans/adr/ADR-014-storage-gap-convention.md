# ADR-014: Storage Gap Convention (50 Slots)

**Date**: 2026-04-02
**Status**: Accepted

## Context

UUPS-upgradeable contracts (see ADR-010) need reserved storage space for future state variables. Without explicit gaps, adding storage in an upgrade shifts every subsequent slot, silently corrupting existing state. This class of bug is nearly impossible to detect in testing (values look plausible but are wrong) and catastrophic in production (corrupted balances, broken access control).

## Decision

Every upgradeable contract reserves exactly **50 total slots** (own variables + gap). Each contract includes explicit slot accounting documentation that maps:

1. Per-slot assignment of every storage variable
2. Inherited class slot consumption (OpenZeppelin base contracts)
3. Packing analysis (enums + bools sharing a single 32-byte slot)
4. Explicit formula: `__gap = 50 - used_slots`

The exemplary documentation in HatsModule (`packages/contracts/src/modules/Hats.sol`, lines 168-198) maps every slot with the full inheritance chain:

```
// Storage Layout (50-slot budget per contract):
// Slot 0: _initialized (1 byte) + _initializing (1 byte)  [Initializable]
// Slot 1: __gap[49] starts                                  [Initializable]
// ...
// Slot 50: _owner                                           [OwnableUpgradeable]
// ...
// Slot 100: hatsContract (address)                          [HatsModule own]
// Slot 101: gardenHats (mapping)                            [HatsModule own]
// ...
// Slot N: __gap[46]                                         [HatsModule gap]
```

Simpler contracts like `Power.sol` use a compact notation: `4 vars + 46 gap = 50`.

**Convention when adding a new storage variable**: Decrease `__gap` size by the number of slots consumed. For example, adding a `mapping(uint256 => address)` (1 slot) to a contract with `uint256[46] private __gap` changes the gap to `uint256[45] private __gap`.

## Consequences

- **Enables**: Safe upgrades with an explicit slot budget. Reviewers can verify storage layout correctness mechanically by counting slots. The 50-slot budget is generous enough for foreseeable growth while being small enough to reason about.
- **Constrains**: 50-slot limit per contract level. Deeply nested inheritance chains (e.g., OwnableUpgradeable -> UUPSUpgradeable -> ReentrancyGuardUpgradeable -> custom module) consume slots at each level, so the effective "free" slots for custom storage can be surprisingly small. Developers must audit the full inheritance chain.
- **Trade-off**: Verbose documentation overhead -- every contract needs a comment block mapping its storage layout. This is maintenance burden that feels excessive for small contracts, but it prevents silent storage collisions that are nearly impossible to debug post-deployment. The documentation also serves as a review artifact: any PR that adds storage without updating the gap and the layout comment is immediately suspicious.
