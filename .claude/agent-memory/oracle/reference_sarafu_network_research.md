---
name: reference-sarafu-network-research
description: Sarafu Network (Grassroots Economics) frontend/UX research — the comparison/anti-pattern reference for Green Goods' commitment-pooling redesign
metadata:
  type: reference
---

Sarafu Network (sarafu.network) by Grassroots Economics is the prior-art "commitment pooling" + Community Asset Voucher (CAV) product Green Goods is trying to out-simplify. Source-grounded findings (researched 2026-06-27):

**Frontend repo**: https://github.com/grassrootseconomics/sarafu.network — "Sarafu Network dApp", TypeScript, AGPL-3.0, actively maintained (pushed 2026-06-08). Stack: **Next.js 16 App Router, React 19, tRPC, wagmi/viem/RainbowKit, Tailwind 4, iron-session + SIWE, Zustand, TanStack Query, Kysely/Postgres (dual DB: graph + federated), Upstash Redis, Sentry**. On **Celo mainnet**. Their own repo CLAUDE.md is an excellent stack summary.

**NOT a true PWA**: `public/site.webmanifest` exists (display:standalone) but **NO service worker** (no serwist/workbox/next-pwa) → installable-ish, zero offline. Direct contrast with Green Goods' offline-first PWA. Open issue #399 wants a "Warning if not Chrome" — Chrome-only fragility (NFC/WebUSB deps).

**Two parallel stacks (key conceptual point)**: (1) wallet-first dApp = sarafu.network (needs a crypto wallet, SIWE). (2) custodial USSD/SMS system for feature phones = NEW generation actively maintained: `eth-custodial` (2026-05), `visedriver-africastalking` (SMS/USSD gateway, 2026-04), `ussd-data-service`, `urdt-ussd-term`. The OLD `cic-ussd` is archived (2024). Academic framing: "two interfaces: USSD for basic phones (custodial) and non-custodial wallets for experienced users" — "an inherent trade-off between blockchain benefits and user interface complexity" (IJCCR / themoonlight.io review).

**Flow step-counts (from source)**: onboarding = Connect Wallet (RainbowKit) → Profile → 4-step Offer-voucher wizard, gas auto-faucet (`EthFaucet.submitGiveTo`) on first SIWE login. Voucher create = 4-step wizard. Pool create = single big form + server-side `trpc.pool.create` 4-step deploy (sponsor-deployed, user doesn't sign). **Swap/exchange = 3 on-chain txs (reset approval → approve → withdraw)** — heavy. Redeem = NO dedicated flow; just ERC20 `transfer` to voucher's `redemption_address` (open issue #407 "Send to Issuer"). `normie-donation-form` = fiat/cUSD gasless on-ramp (name+email, no wallet) via NORMIE_LIQUIDITY_ADDRESS.

**Documented UX pain (Q4)**: low-literacy users **verbally share PINs** (unsafe workaround); rely on **"communal phones" + "champions"** (digitally-literate intermediaries) and **chama social recovery** as structural requirements; **gas costs rising** drove GE to UNSTAKE/exit Celo validation (forum.celo.org/t/.../12091); GitHub issues show onboarding/voucher-UX churn (#339, #317, #403, #404, #410 onramp).

**For Green Goods Q6 (analog-first, ~80% smartphone, in-person work/capital)**: Sarafu's lesson = the operator/steward + intermediary is the real bridge, not the wallet. GG advantages to lean on: true offline-first PWA, sponsored/gasless writes (no per-tx approval theater), single rich form not multi-tx wizard, photo/voice capture + async sync, paper/QR fallback. Avoid Sarafu's 3-tx swap and wallet-first gate.
