# 2.0.0 release media

## Pilot release card

![Green Goods card. Promises, work, and review. Green Goods helps communities make promises, document regenerative work, and review it together. Built with pilot communities. Want to try it with yours? Message us. Behind the text, an AI-generated illustration of two people working on a solar panel at an outdoor table.](pilot-release-card.jpg)

A 1200 by 630 image for posts to prospective pilot communities: the separate announcement card that
[social-preview-readiness.md](../social-preview-readiness.md) recommends. It names no version and
makes no payment, payout, or reward claim, so later pilot outreach can use it too. It is marketing
artwork, not evidence of authenticated 2.0 behavior.

The photo is an AI-generated illustration
(`docs/static/img/community/editorial-solar-workshop.webp`), not a real pilot, person, workshop, or
place. A post that uses the card keeps the caption "Image: AI-generated illustration, not a real
pilot." Where the channel accepts alt text, use the alt text above, which carries all of the card's
words.

The card was drawn with the website's share-card renderer and fonts (`renderSocialCardTextPaths` in
`packages/client/vite/social-preview.ts`).

## Steward access design references

Engine/session: **Brave · Storybook**, October 8, 2026. Synthetic fixture data.
These images show the implemented tall mobile sheet; they do not prove authenticated beta behavior.

| State | English | Español |
|---|---|---|
| Choose a Garden | ![English Garden selection](steward-access-en-choose.jpg) | ![Selección de jardín](steward-access-es-choose.jpg) |
| Review | ![English request review](steward-access-en-review.jpg) | ![Revisión de solicitud](steward-access-es-review.jpg) |
| Pending | ![English pending request](steward-access-en-pending.jpg) | ![Solicitud pendiente](steward-access-es-pending.jpg) |

All three states retain the same sheet height. Review content scrolls when needed; footer actions remain visible. Buttons stay on one line in the prepared English and Spanish examples.
