# Embedded Wallet Sponsorship Follow-Ups Spec

## Summary

This hub narrows the remaining follow-up work after embedded auth landed in code. It focuses on three gaps: a truthful sponsorship path for embedded and compatible wallet users, a clear deferred-signing/offline policy for embedded auth, and login/auth UX that explains address continuity without implying that passkey, embedded, and wallet identities are interchangeable.

## Users

- Primary: client users authenticating with AppKit embedded wallets or external wallets
- Secondary: operators or support flows helping users understand account continuity and transaction behavior

## Functional Requirements

1. `EmbeddedSender` and `WalletSender` must expose truthful sponsorship behavior: attempt sponsored execution where supported, and fall back clearly when the capability is unavailable.
2. Embedded auth must have an explicit deferred-signing rule for offline work: users can preserve drafts or queued intent, but actual signature/submission waits until reconnect.
3. Login and auth surfaces must explain that passkey, embedded, and wallet modes are separate on-chain identities with separate history, roles, and balances.
4. Progressive disclosure stays in place, but login copy must distinguish wallet connection from embedded/social auth and avoid implying sponsorship when it does not exist.
5. Tests must cover sender selection, sponsorship capability flags, embedded restore behavior, and address continuity messaging.

## Non-Functional Constraints

- Package boundaries: state/auth/sender work stays in `packages/shared`; copy and login UX changes stay in `packages/client` with small auth-surface touch points elsewhere only if needed
- Contracts: `n/a`
- Security: do not introduce a backend identity-linking service or hidden cross-auth account merge
- Offline / sync: embedded auth must not pretend it can sign fully offline if the wallet flow cannot do that today
- Localization: any new login or continuity copy must ship in `en`, `es`, and `pt`

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| Transaction sender capability, auth/session rules | `state_api` | Primary lane |
| Login and auth continuity UX | `ui` | Client-facing copy and flow updates |
| Contracts | `contracts` | `n/a` |
| QA | `qa_pass_1`, `qa_pass_2` | Sequential sender + UX validation |

## Risks

- Wallet support is fragmented across providers; capability detection must fail safe and preserve the existing unsponsored fallback.
- Address continuity copy can become too abstract; tie it directly to roles, history, and balances in the current product.
- Offline semantics can drift from actual sender behavior; keep the deferred-signing rule aligned with the sender implementation.
