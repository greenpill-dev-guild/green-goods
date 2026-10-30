# Tech and Sun steward Safe: finalize the bootstrap

**Decision, 26 October 2026:** finalize the live Tech and Sun Gnosis Safe now, with Afo's bootstrap
signer and one trusted Tech and Sun steward. This is a one-off operation on the receiver deployed
on 24 October. New gardens move to the general steward Safe model described at the end.

**27 October 2026:** Afo deferred the finalization until the second signer is chosen, so that
choice does not hold up setup; Tech and Sun's hub-day offers went out first. That morning the
roster had four Tech and Sun stewards on Arbitrum, the bootstrap signer among them, and none was
queued, dispatched or mirrored. The publisher held 0.0005 ETH of transport fuel against a quote
of about 0.00005 ETH per mirror, so step 1 needs gas only.

## Why

The receiver started in bootstrap mode with the Hats Signer Gate at a minimum of one and a target
of one. That setting applies to every valid signer, so each steward mirrored from Arbitrum can
sign the Safe alone until `finalizeBootstrap()` runs. The Safe owns the TSV token and can mint it.
It also proposes and executes TSV upgrades through a zero-delay timelock, and holds the Tech and
Sun reserve. On 26 October at 01:10 UTC no steward had been queued, dispatched or mirrored.
Anyone can start mirroring by calling `syncSteward`, and so does any Tech and Sun steward role
change.

| Item | Address |
|---|---|
| Arbitrum HatsModule | `0x5b943088ecdDBF8E4ae387348A88A654aC5F7266` |
| Tech and Sun garden (Arbitrum) | `0xA2DF8Eb73444A3f3cf9b8E3749313C7471d7D5E3` |
| StewardRolePublisher (Arbitrum) | `0xdc53b8EAe588a923D13650339De0c99D29968804` |
| StewardSafeReceiver (Gnosis) | `0x115819bCcaab03Be49107c69c00Bc4c21009839C` |
| Hats Signer Gate (Gnosis) | `0x3Cc943796ccb2fC122b6a61978474Def8fA318c6` |
| Tech and Sun Safe (Gnosis) | `0x9BE5f0D6B95Ea3735df71023F5dFED53b4c1aABf` |
| Bootstrap signer (EOA) | `0x2aa64E6d80390F5C017F0313cB908051BE2FD35e` |

`S` below is the trusted Tech and Sun steward. Replace `<account>` with the Foundry keystore
account (or use `--ledger` or `--interactive`) that signs for each address.

## Steps

**0. Check the starting state (read-only).**

```bash
ARB=https://arb1.arbitrum.io/rpc; GNO=https://rpc.gnosischain.com
cast call 0x5b943088ecdDBF8E4ae387348A88A654aC5F7266 "isStewardOf(address,address)(bool)" 0xA2DF8Eb73444A3f3cf9b8E3749313C7471d7D5E3 0x2aa64E6d80390F5C017F0313cB908051BE2FD35e --rpc-url $ARB
cast call 0x5b943088ecdDBF8E4ae387348A88A654aC5F7266 "isStewardOf(address,address)(bool)" 0xA2DF8Eb73444A3f3cf9b8E3749313C7471d7D5E3 <S> --rpc-url $ARB
cast call 0x115819bCcaab03Be49107c69c00Bc4c21009839C "bootstrapFinalized()(bool)" --rpc-url $GNO
cast call 0x3Cc943796ccb2fC122b6a61978474Def8fA318c6 "validSignerCount()(uint256)" --rpc-url $GNO
```

Expect `true`, `true`, `false` and `1`. Stop if either `isStewardOf` call returns `false`.
Mirroring an account that is not a steward sends `eligible=false`. For the bootstrap signer, that
ends its exception and removes it from the Safe before a second verified steward exists, and
`finalizeBootstrap()` then reverts until one does.

**1. Mirror both accounts (Arbitrum).** The publisher's own fuel pays the CCIP fee; the caller
pays only gas.

```bash
cast send 0xdc53b8EAe588a923D13650339De0c99D29968804 "syncSteward(address)" 0x2aa64E6d80390F5C017F0313cB908051BE2FD35e --account <account> --rpc-url $ARB
cast send 0xdc53b8EAe588a923D13650339De0c99D29968804 "syncSteward(address)" <S> --account <account> --rpc-url $ARB
cast call 0xdc53b8EAe588a923D13650339De0c99D29968804 "dispatchedRevision(address)(uint64)" <each account> --rpc-url $ARB
```

Expect `1` for both. A `0` means either the dispatch was deferred or the account is not a steward:
the publisher never pays to send a first `eligible=false`. Repeat that account's `isStewardOf`
check from step 0 and stop if it returns `false`. If it returns `true`, pay for the dispatch
directly:

```bash
FEE=$(cast call 0xdc53b8EAe588a923D13650339De0c99D29968804 "quoteSteward(address)(uint256)" <account address> --rpc-url $ARB | cut -d' ' -f1)
cast send 0xdc53b8EAe588a923D13650339De0c99D29968804 "dispatchSteward(address)" <account address> --value $FEE --account <account> --rpc-url $ARB
```

**2. Wait for both mirrors on Gnosis** (CCIP from Arbitrum usually takes 20 to 30 minutes).

```bash
cast call 0x115819bCcaab03Be49107c69c00Bc4c21009839C "states(address)(uint64,bool)" 0x2aa64E6d80390F5C017F0313cB908051BE2FD35e --rpc-url $GNO
cast call 0x115819bCcaab03Be49107c69c00Bc4c21009839C "states(address)(uint64,bool)" <S> --rpc-url $GNO
cast call 0x3Cc943796ccb2fC122b6a61978474Def8fA318c6 "validSignerCount()(uint256)" --rpc-url $GNO
```

Expect `(1, true)` twice and `2`. If a state reads `(1, true)` but the count is short, the automatic
signer claim ran out of gas; anyone can repair it:

```bash
cast send 0x115819bCcaab03Be49107c69c00Bc4c21009839C "reconcile(address)" <account address> --account <account> --rpc-url $GNO
```

If a state still reads `(0, false)` after 90 minutes, the message did not arrive. Look up the
message ID from that account's `StewardDispatched` event in the [CCIP Explorer](https://ccip.chain.link).
Repeat the account's `isStewardOf` check and stop if it returns `false`. Otherwise resend the
current revision at the caller's cost with the `quoteSteward` and `dispatchSteward` commands from
step 1. `dispatchSteward` resends the queued revision even when `dispatchedRevision` already
records it, and the receiver ignores a second copy of a revision it has already applied.

Do not finalize before your own mirror arrives. `finalizeBootstrap()` removes the bootstrap
exception before counting, so it reverts with `InsufficientVerifiedStewards` until both mirrored
stewards are valid signers.

**3. Finalize immediately (Gnosis, from the bootstrap signer).**

```bash
cast send 0x115819bCcaab03Be49107c69c00Bc4c21009839C "finalizeBootstrap()" --account <bootstrap account> --rpc-url $GNO
```

**4. Verify.**

```bash
cast call 0x115819bCcaab03Be49107c69c00Bc4c21009839C "bootstrapFinalized()(bool)" --rpc-url $GNO
cast call 0x3Cc943796ccb2fC122b6a61978474Def8fA318c6 "thresholdConfig()((uint8,uint120,uint120))" --rpc-url $GNO
cast call 0x3Cc943796ccb2fC122b6a61978474Def8fA318c6 "locked()(bool)" --rpc-url $GNO
cast call 0x9BE5f0D6B95Ea3735df71023F5dFED53b4c1aABf "getThreshold()(uint256)" --rpc-url $GNO
```

Expect `true`, `(0, 2, 2)`, `true` and `2`. Record the four transaction hashes in the
[deployment handoff](codex-live-pilot-deployment.md).

## Exposure during the operation

From the moment `S`'s mirror arrives until step 3 confirms, `S` can sign the Safe alone. So can
any other Tech and Sun steward whom someone mirrors in that window. Run step 3 as soon as step 2
passes. After finalization the Safe needs two signatures and stays locked. If Tech and Sun ever
drops to one steward, this Safe cannot spend until a second steward is granted; the general model
below avoids that freeze for new gardens.

## General model for new gardens (accepted 26 October)

- The Safe mirrors the garden's Hats steward roster: one steward signs alone, and two or more
  stewards need two signatures (gate minimum one, target two, locked at deployment).
- An optional named starting signer can act before the first CCIP mirror arrives. Its special
  status ends automatically once its own Hats status is mirrored; there is no manual finalize.
- The receiver takes the garden's name instead of hardcoded Tech and Sun names, so any garden can
  use it. Wiring it into garden creation waits for the separate garden-creation audit.
