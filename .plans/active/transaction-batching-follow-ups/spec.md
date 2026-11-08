# Behavior and boundaries

Preserve the approved Add and Send rule: listed passkeys and atomic wallets send proof before confirmation in one atomic request; decline or failure keeps both queued. Plain wallets retain two signatures. A software test cannot establish live wallet proof.

One shared hook owns capability queries, keyed by account, chain, and connector. Unlisted routes do not probe a wallet. Plain-wallet action edits persist each send through the existing journal and never blindly repeat an unknown outcome. Review refusals retain their friendly meaning. A failed works refresh must not hide already loaded reviews, and the review bar must leave the last row reachable.

Octant checkout should prepare wrap/reset/approval/deposit as one atomic request only on supported, explicitly listed wallets, preserving existing preflight, identity, budget, and recovery checks. Unproven rails remain unlisted. No gas limit is inferred from a provider default; five-decision live proof waits for provider evidence.
