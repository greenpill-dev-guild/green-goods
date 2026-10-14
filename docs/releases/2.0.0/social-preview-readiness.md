---
audience: community
owner: docs
status: prepared
source_of_truth:
  - packages/client/index.html
  - packages/admin/index.html
  - docs/docusaurus.config.ts
  - docs/releases/2.0.0/announcement.md
---

# 2.0.0 social preview readiness

Review of the scoped candidate, October 13, 2026. This is a publishing checklist and
approved-copy handoff, not a record of refreshed social caches or deployed metadata.

## Descriptions

The Client's HTML description, Open Graph description and Twitter description all say
"Bring Community Impact Onchain". Replace this technical slogan with pilot-oriented language
before relying on an automatic homepage preview for the public announcement:

> Green Goods helps communities make commitments, document regenerative work, and review it together. Contact us to explore a pilot.

The Admin Open Graph description still says "operators". Use the visible role name Steward:

> A workspace for Garden Stewards to coordinate promises, review documented work, and manage Garden access.

These proposed HTML changes are not implemented by this documentation update. The owning
files are `packages/client/index.html` and `packages/admin/index.html`. A release message can
use a cleared image attachment while the metadata correction is reviewed separately.

## Images

| Surface | Current asset | Recommendation |
|---|---|---|
| Public Client | `packages/client/public/social-home-hero.png`, 1200 by 630 | The current public hero can remain as evergreen branding. Create a separate 2.0 announcement card with "Promises, work, and review" and "Built with pilot communities". Keep the headline legible at small sizes; omit navigation and app-install controls from the new card. |
| Admin | `packages/admin/public/social-image.webp` | Replace before sharing an Admin link as release media. The current image says "operators", "Certify" and "needs", and shows an older fixture workspace. Use a cleared current Hub view, Steward wording and included review capabilities. |
| Docs | `docs/static/img/green-goods-social-card.webp` | Replace before sharing a Docs link as release media. The current image contains the old "Operator Guide" and older claims. Use a simple Docs title card or a current cleared Docs view. |

No new image generation or replacement is claimed. The six request screenshots in
[media/README.md](media/README.md) are synthetic Storybook illustrations. They may accompany
a clearly labeled feature demonstration, but do not establish live behavior or private QA.
The Garden Promises and steward Hub still need candidate screenshots cleared for public use.

## Before announcement

- Inspect the actual production HTML and confirm title, description, image URL and alt text.
- Confirm the image URLs are public and the images crop legibly in the target channel.
- Check preview cards on Telegram, WhatsApp and X after any metadata/image deployment;
  an existing cached card is not proof of the new metadata.
- Use "Garden", "Gardener" and "Steward" consistently. Do not imply self-service broad
  availability, automatic impact verification, new reward payments or contributor payouts.
- Do not change account handles, avatars or profile banners merely for the version number.
  Review their bios for pilot-focused language; no account profile change is authorized here.
