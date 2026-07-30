# PRD-748 post-execution evidence

Status: execution, fixed-block verification, and rendered Hats-aware UI spot checks complete.

- Network: Arbitrum One (`42161`)
- Execution date: `2026-07-28`
- Execution mode: direct common-admin broadcast
- Authorized executor: `0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6`
- Hats Protocol contract: `0x3bc1A0Ad72417f2d411118085256fC53CBdDd137`
- Broadcast artifact:
  `packages/contracts/.generated/foundry/broadcast/RelabelStewardHats.s.sol/42161/run-latest.json`
- Preflight artifact:
  `.plans/active/commitment-pooling/operations/steward-hat-relabel/preflight-42161-488705295.json`
- Executable plan:
  `packages/contracts/deployments/tx-plans/42161-steward-relabel-488705295-plan.json`
- Target count: `18`
- Execution block range: `488773296`–`488773365`
- Receipts: `18/18` succeeded
- Total paid: `0.00003822615545 ETH` (`1,907,436` gas)
- Authorization-blocked gardens: none

## Execution transactions

Transactions are listed in executable-plan target order.

| # | Garden | Final hat details | Block | Transaction |
| ---: | --- | --- | ---: | --- |
| 1 | Green Goods Community Garden | `Green Goods Community Garden Steward` | 488773296 | `0x65da4cca611cf3b94194809ad0fc2577e5a14fb3979170ee6af64c56a8604005` |
| 2 | Aiyeloja Family Garden | `Aiyeloja Family Garden Steward` | 488773300 | `0xd43818343daaae9fde5c77d155e87b53e57807f041da65ac59e4a8f46551416c` |
| 3 | TAS HUB | `TAS HUB Steward` | 488773304 | `0x34de940268e4ca139124cd79e54533b29aca97764aa824b976e476e37fde204c` |
| 4 | Greenpill London | `Greenpill London Steward` | 488773308 | `0x602a4357bc50a7f006f0e23285b98761a27ff5cad4888dcc57a1904d1b751d6a` |
| 5 | GreenSofa | `GreenSofa Steward` | 488773312 | `0xf700c5f5e1846352cdcc150f7366bbb3f9ad02a22c99bb229955fc28f97d2ceb` |
| 6 | Muizenberg Community Garden | `Muizenberg Community Garden Steward` | 488773316 | `0x2fc5ab608b66754d8b139f8efa444caf7bf2c0941660c01ac0a49787fdadeec3` |
| 7 | Rifai Sicilia | `Rifai Sicilia Steward` | 488773320 | `0x8cecabaa680443676d1a04a52a301d9ac353b0913d478ed5a018df000fd29cbf` |
| 8 | Growecosystems | `Growecosystems Steward` | 488773324 | `0xc76f7f972bfc64047b81b3be46a97165ab148d33aff497b8988208cc0e0074d4` |
| 9 | AgroforestDAO | `AgroforestDAO Steward` | 488773328 | `0xac2ee3cc6cec56070fe6d0f7c7e8c551d5e744e4f95257a68625aaf9cb013c3f` |
| 10 | ReFi Barcelona | `ReFi Barcelona Steward` | 488773332 | `0x785e82c655ae98db9f851acc14603a689e6b22ed8f3908b5bcc8a62542424f2d` |
| 11 | DeCleanup Network Action garden | `DeCleanup Network Action garden Steward` | 488773336 | `0x129d8b0e0850c67da89ce681fbe6318ea0d5cadca70e039deb96432edeb46d15` |
| 12 | Greenpill Kenya | `Greenpill Kenya Steward` | 488773340 | `0x8a8aa8dc37a5ebb18a9cd909f1d22e5e4a8370c2e7d842a011775a855c021a1e` |
| 13 | Live Garden Coop | `Live Garden Coop Steward` | 488773344 | `0x38ae484cee7ec929a6efadeea4d7578b222ea18c161c979597ceffd2b284b8ab` |
| 14 | Vida Verde | `Vida Verde Steward` | 488773348 | `0x62fcd2aec96c6e4907e3f7a53041926393241e4151b4856d6d70f247dc3b624a` |
| 15 | Mama Gardens | `Mama Gardens Steward` | 488773353 | `0xa885951dd35463a7fdb4f4d05f09825abfc8c88b296d01a3eb9db17bf95b556e` |
| 16 | La Ligne Verte | `La Ligne Verte Steward` | 488773357 | `0xb99499f709cd15610127893c32a05947963e3c9b33803352918450a8844181a8` |
| 17 | Greenpill Nigeria | `Greenpill Nigeria Steward` | 488773361 | `0x0f3dc82cd519a2a1e4d07d27d5ef901aad9b43f5458e6279d6a5c25c908152db` |
| 18 | abundance islands | `abundance islands Steward` | 488773365 | `0xbdc80c2a2abeb640a05d809f409c71987d1d2b089669a2bc31ca693b631deab1` |

## Independent fixed-block verification

The post-broadcast verifier re-read the same 18 plan targets from Arbitrum at fixed block
`488774048` (`2026-07-29T00:30:30.632Z`):

- `18/18` transaction receipts had success status.
- `18/18` Hats returned the plan's exact `... Steward` details.
- `18/18` Hats remained mutable and active.
- The executor remained an authorized admin for every target.
- Verification failure count: `0`.

## Rendered Hats-aware views

The official Hats Protocol app was reloaded after the subgraph had observed the broadcast. A
rendered-DOM check confirmed that each of the following labels was present and visible in the Green
Goods tree:

1. Green Goods Community Garden
   - URL: `https://app.hatsprotocol.xyz/trees/42161/92`
   - Visible label: `Green Goods Community Garden Steward`
2. TAS HUB
   - URL: `https://app.hatsprotocol.xyz/trees/42161/92`
   - Visible label: `TAS HUB Steward`
3. AgroforestDAO
   - URL: `https://app.hatsprotocol.xyz/trees/42161/92`
   - Visible label: `AgroforestDAO Steward`

The same rendered tree contained all 18 exact `... Steward` labels. No live `Operator` label
remained among the relabel targets.
