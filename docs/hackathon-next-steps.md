# Hackathon polish checklist

Short list of follow-up fixes and presentation upgrades that can be completed quickly:

## Product polish

- [x] **Assessment summaries on dashboards** – surface average carbon stock, last assessment date, and pending assessments in the dashboard header to give organizers an at-a-glance status.
- [x] **Garden cards imagery fallback** – generate simple gradient placeholders based on seed data so cards never show empty panels while IPFS images load.
- [x] **Success toasts** – trigger toast notifications after deployments or assessment submissions complete so operators receive feedback even when modals auto-close.
- [x] **Dark mode touch-ups** – audit typography contrast (especially table headers and secondary text) to improve readability on the dark theme.

## Developer experience

- [x] **Shared GraphQL utilities** – lift the EAS client helpers into a shared package to avoid duplication between the client and admin surfaces.
- [ ] **Storybook snapshots** – add stories for the multi-step garden flow to document expected UX and allow quick visual QA.
- [x] **Contract addresses inspector** – expose a small debug drawer that lists addresses per chain for onstage demos.

## Performance quick wins

- [x] **Query caching** – memoize expensive JSON parsing for attestations and reuse via `useMemo`/selectors to reduce repeated parsing in large tables.
- [x] **Lazy-load heavy views** – dynamically import the Gardens assessment list and deployment views so the initial dashboard shell loads instantly.
- [x] **Image optimization** – pipe banner uploads through a tiny image proxy (e.g., Cloudflare Images) for thumbnails to keep the admin snappy on slower hotel Wi-Fi.
