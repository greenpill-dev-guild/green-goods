# Visual Assets Directory

This directory contains all images, diagrams, screenshots, and visual assets used throughout the Green Goods documentation.

## Directory Structure

```
assets/
├── README.md (this file)
├── logos/                    # Brand logos and icons
├── screenshots/              # App screenshots
│   ├── gardener/            # Gardener app screenshots
│   ├── operator/            # Admin dashboard screenshots
│   └── general/             # General UI screenshots
├── diagrams/                 # Architecture and flow diagrams
├── examples/                 # Example photos (before/after, etc.)
└── guides/                   # Guide-specific images
```

## Asset Guidelines

### Screenshots

**Naming convention**: `{feature}-{view}-{state}.png`

Examples:
- `gardener-login.png`
- `mdr-media-step.png`
- `operator-dashboard.png`
- `work-review-detail.png`

**Requirements**:
- PNG format (smaller file size)
- JPEG for photos (when compression acceptable)
- Max width: 1200px
- Optimize before committing

### Diagrams

**Tools**: Miro, Excalidraw, Figma

**Export**: SVG preferred (scalable), or PNG @2x for retina

**Naming**: `{concept}-diagram.svg`

Examples:
- `mdr-workflow-diagram.svg`
- `system-architecture-diagram.svg`
- `attestation-flow.svg`

### Brand Assets

Logo files located in `packages/client/public/`:
- Reference those for brand assets
- Don't duplicate

## TODO: Assets to Add

### Priority 1 (Core User Flows)

- [ ] `gardener-login.png` - Login screen with passkey prompt
- [ ] `mdr-media-step.png` - Media capture interface
- [ ] `mdr-details-step.png` - Details form
- [ ] `mdr-review-step.png` - Review screen
- [ ] `work-dashboard-gardener.png` - Gardener work dashboard
- [ ] `operator-dashboard.png` - Admin dashboard home
- [ ] `work-review-detail.png` - Operator review interface
- [ ] `eas-attestation-example.png` - EAS explorer page
- [ ] `graphql-playground.png` - GraphQL interface

### Priority 2 (Diagrams)

- [ ] `mdr-workflow-diagram.svg` - 3-step flow visualization
- [ ] `system-architecture-diagram.svg` - High-level system components
- [ ] `attestation-flow.svg` - Work → approval → on-chain flow
- [ ] `gardens-coordination.svg` - Multiple gardens in bioregion
- [ ] `garden-structure-diagram.svg` - Garden components
- [ ] `offline-architecture-diagram.svg` - Job queue system

### Priority 3 (Examples)

- [ ] `before-photo-example.jpg` - Good "before" documentation
- [ ] `after-photo-example.jpg` - Good "after" documentation
- [ ] `guide-before-photo.jpg` - Specific guide example
- [ ] `guide-after-photo.jpg` - Specific guide example

### Priority 4 (Additional UI)

- [ ] `pwa-install.png` - PWA installation prompt
- [ ] `garden-creation-modal.png` - Create garden interface
- [ ] `create-action-modal.png` - Create action interface
- [ ] `approval-confirmation.png` - Approval success state
- [ ] `submission-confirmation.png` - Work submitted state

## Placeholder Images

For development, all image references use:
- Descriptive alt text
- Placeholder URLs (via.placeholder.com)
- TODO comments indicating needed asset

Replace placeholders with real assets before launch.

## Contributing Assets

1. Follow naming conventions above
2. Optimize file size
3. Add descriptive alt text in markdown
4. Update this README with new assets
5. Submit PR

---

For questions: [Telegram](https://t.me/+N3o3_43iRec1Y2Jh)
