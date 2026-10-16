# Keep Older Passkey Accounts Working on Every Site

**Slug**: `passkey-account-continuity`
**Stage**: `backlog`
**Priority**: `p2`
**Created**: `2026-10-16T19:35:57.040Z`

## Problem

Since v2.0.0 (14 October 2026), new passkeys come from the Green Goods passkey directory on the
agent and work on every Green Goods site. Accounts made earlier still sign in only where they
started:

- **App-made passkeys, January to early August 2026, about 45 people.** These passkeys already
  belong to `greengoods.app`, so a browser offers them on every Green Goods site. But the account
  record (credential ID and public key) lives only in the browser that made it. They have no
  directory entry, so nobody can sign in to them by name on admin, another device, or after
  clearing site data.
- **Hosted-server passkeys, August to 13 October, about 23 people.** The hosted passkey server
  tied each passkey to the exact host that made it: about 15 to `www.greengoods.app` and 8 to
  `beta.greengoods.app`. A browser never offers them anywhere else, so they don't work on admin or
  on the other public site.
- **Three staging test sign-ups (June to July)**, whose origin the hosted server stopped
  accepting (probed 4 October 2026).

The current plan for these people (COM-39) moves them to new accounts. A new passkey means a new
smart-account address, which loses garden membership, roles, work history and the Green Goods
name, and gives stewards re-adding work.

## Desired Outcome

- An older account signs in by name on every Green Goods site its passkey can reach, at the same
  address, with no new account and no steward work.
- People who signed in recently need no extra step. People with a saved session get one clear
  action in an account screen they already use.
- Older passkeys tied to one host work on the other Green Goods sites in browsers that support it,
  and the app says where they work when a browser can't.
- Nothing gets worse for anyone who does nothing: sign-in keeps working where it works today, and
  new sign-ups are unchanged.

## Scope Notes

- In scope: adding older accounts to the directory with proof that the person holds the passkey;
  a related-origins file (`/.well-known/webauthn`) on www and beta; directory sign-in for stored
  IDs in hex form; sign-in copy for a passkey made on another site; telemetry to size what is left.
- Out of scope: moving anyone to a new account (kept only as a support fallback); Green Goods
  ENS names (`green-goods-name-reservation`); the Gnosis passkey validator; retiring the hosted
  server; admin-made hosted passkeys (none exist, because admin passkey creation shipped with the
  directory).

## Success Signal

Someone who made their account on www in September signs in by name on `admin.greengoods.app` and
approves a garden action from the same address, with no steward involved.
