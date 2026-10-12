# October 2026 — v2.0.0

Prepared copy for publication after the October 11 production checks pass.

Green Goods 2.0 brings a Garden's commitments, documented work, and review into one connected flow. It also rebuilds the steward workspace and improves the installed app for work in the field.

## For gardeners

- Make and track promises, see what needs confirmation, and follow a Garden's seasons and campaigns.
- Record work with notes and photos, keep drafts and queued work through connection changes, and see when a send still needs confirmation.
- Install and update the app with clearer progress and controls. An update waits for you before restarting.
- Sign in with an existing passkey and recover the same account across supported Green Goods sites.

## For stewards

- Use the rebuilt Hub, Garden, and Community workspace to find reviews and the next action.
- Set up a commitment pool, seed promises, manage seasons and funding, and review claims with the target and wallet steps shown before acting.
- Review membership and steward requests separately. A signed steward request asks for access; an authorized owner or steward still assigns the role.
- People with no Garden access can open Profile, copy their account address, sign out, and request steward access for a selected Garden. English and Spanish request screens use stable dialog/sheet sizing and compact actions.
- Retry a proven unsent Work submission with corrected details. Closing a submitted Review preserves its confirmation record; uncertain sends keep their recovery identity.

## Public Garden records

Public Garden pages connect documented work, commitments, completed cycles, and impact evidence. Empty or not-yet-started records stay quiet rather than presenting invented statistics.

## Protocol and platform

This release includes Commitment Pooling contract and indexing support, the public Garden impact API, and request-kind support in the Agent API with a preserving SQLite migration. Visible Garden roles use **Steward**; deployed role identifiers retain compatibility.

Funding and settlement actions remain subject to each Garden's live deployment, permissions, available funding, and activation status. A pending transfer is not a completed payout. Existing GardenAccount upgrades and separately gated settlement activation are not promised by this announcement.

## Getting started

- [Open Green Goods](https://greengoods.app)
- [Open the steward workspace](https://admin.greengoods.app)
- [Install or update the app](https://docs.greengoods.app/community/gardener-guide/installing-and-updating)
- [Run a commitment pool](https://docs.greengoods.app/community/steward-guide/commitment-pooling)
- [Passkey sign-in and recovery](https://docs.greengoods.app/builders/integrations/passkey)

Release link, available after the cut: https://github.com/greenpill-dev-guild/green-goods/releases/tag/v2.0.0.
