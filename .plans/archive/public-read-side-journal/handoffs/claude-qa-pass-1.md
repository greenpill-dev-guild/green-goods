# Claude QA Pass 1 Handoff - Public Browser Editorial UI

## Goal

Perform visual and interaction QA after UI implementation lands.

## Scope

- Browser screenshots at 375, 768, 1024, and 1440 for:
  - `/`
  - `/gardens`
  - `/gardens/:id`
  - `/impact`
  - `/fund`
  - `/actions`
  - install sheet/module
  - `/fund` `Donate`/`Endow` intent selector
  - `/fund` card/wallet method selector after intent
  - `/fund?garden=...` stale, missing, or ambiguous non-blocking message
  - hidden-by-default unproven card methods
  - curated coming-soon states only when configured
  - card `Endow` receipt/recovery/app-management handoff
  - public receipt state without payer email, provider ids, internal event history, or raw failure details
  - public receipt showing only the canonical funding transaction hash, not approval/reset transaction hashes
  - receipt URL fragment handling where visible, with no receipt token echoed in UI copy and no
    `receiptToken` in captured pageview hash
  - source dialogs
- Confirm public browser never shows installed-PWA bottom `AppBar`.
- Confirm header install CTA behavior across desktop/mobile states.
- Confirm `/fund` does not show competing wallet prompts when card funding is present.
- Confirm `Donate` reads as direct support and `Endow` reads as support designed to preserve the
  visitor's deposit while yield helps the Garden.
- Confirm Donate/support copy does not imply tax deductibility, charitable status, nonprofit status,
  or legal receipt unless separately configured and reviewed.
- Confirm `Endow` includes short smart contract, token, yield, provider, and wallet recovery risk copy.
- Confirm card `Endow` explains thirdweb embedded-wallet receiver/recovery and routes management to
  Install/Open App when that state is visible.
- Confirm card success UI appears only for state/API-funded results, not provider-widget success alone.
- Confirm receipt UI can offer update signup only through a separate explicit subscribe action; funding
  creation does not imply newsletter/update consent.
- Confirm wallet funding remains the Reown/wagmi path and does not surface Agent receipt tracking in this
  pass.
- Confirm `/fund` reads as support-only and does not expose public withdrawal/admin controls.
- Confirm `PublicFundingAvailability.reasonCode` values render through localized UI strings rather
  than raw API copy.
- Confirm amount min/max errors render from local or server quote/create validation after an amount is
  selected, not from base availability reason codes.
- Confirm `/impact` has loading, empty, partial-data, source-limit, and EAS failure states for the v1
  shared-EAS read path, using deterministic latest-activity Garden source ordering where fixtures expose
  the source-limit state.
- Confirm source dialogs have labelled titles, focus handling, escape/overlay close, mobile bottom
  sheet behavior, and reduced-motion fallback.
- Confirm source morphs use unique transition names per item or fall back to simple fades.
- Confirm motion is restrained and reduced-motion fallbacks are present.

## Evidence

Record screenshot paths, browser notes, and any issues back into `status.json` history or a QA
report under this plan hub.
