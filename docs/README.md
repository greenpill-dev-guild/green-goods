# Green Goods Documentation

The Docusaurus site serves two audiences from one source tree:

- **Community** explains current Green Goods flows for gardeners, stewards/evaluators, and funders.
- **Builders** explains architecture, package boundaries, integrations, testing, and agent workflows.
- **Reference** holds the shared glossary, formal ontology, product history, design rationale, FAQ, brand kit, and credits.

Implementation facts come from code and configuration. Authored pages explain flows and stable rationale; generated pages project routes, exports, deployment artifacts, ontology, workflows, and QA scenarios from their owning sources.

## Work locally

Run commands from the repository root:

```bash
bun run dev -- docs
```

The docs server listens on port 3003. Before handing off a change, run the docs checks selected by the validation planner:

```bash
node docs/scripts/docs-audit.mjs --ci
bun run check --only docs-generated
bun run --cwd docs test
bun run --cwd docs build
bun run --cwd docs check:search-index
```

The static build is written to `docs/build`. `bun run --cwd docs build` also fails unless the generated
search index contains every live documentation source route.

## Content map

```text
docs/
├── docs/
│   ├── community/   current user flows by role
│   ├── builders/    technical explanations and generated projections
│   └── reference/   shared public reference material
├── src/             Docusaurus theme and interactive components
├── static/          directly consumed public assets
├── docusaurus.config.ts
├── sidebars.ts
└── vercel.json
```

Every live page must be reachable from a sidebar or its role/category index. Do not use `unlisted: true` as an archive. Historical text remains recoverable through Git history.

## Authored pages

Use authored pages for user goals, prerequisites, steps, recovery, stable concepts, rationale, and navigation. Keep changing inventories out of prose. Link to the owning package guide, code, configuration, ontology, workflow, or generated page instead.

Frontmatter must name the audience, owner, status, and exact `source_of_truth` paths. The docs audit treats broken local authority paths and links as errors.

### Brand downloads

`docs/reference/brand.mdx` owns the public `/brand` page. Original exports remain in
`static/brand/v2/`; canonical dark-green icons, palette, fonts, graphics and templates live in
`static/brand/v3/`, with complete and focused ZIPs in `static/brand/`. `src/data/brand-kit-v3.json` owns the current
file inventory, dimensions, source node IDs, colors, and public URLs.
`src/components/docs/BrandAssets.tsx` reads it to show a visual gallery with downloads beside each preview. Keep its public
copy, `static/brand/v3/export-manifest.json`, and the manifest inside the ZIP in sync. Original
vectors, preview sheets, and the export README are bundled in the ZIP rather than served separately.

The docs-owned `src/components/docs/BrandAssets.tsx` is the closest existing implementation.
Its original size selectors and disclosures hid available variants and downloads. Its current
catalogue focuses on dark green, white and black: paired standard/enlarged logo previews, one
symbol framing, and direct SVG/512/1024/2048 PNG links. `AssetPreview` shares the existing preview
behavior between `LogoCard`'s framing comparison and the single-asset `AssetCard`; download rules
stay local to this docs catalogue. Favicons and home-screen files share one Website files section.
Other colors, landscape/original framing and uncommon sizes remain in the unchanged complete kit
and family ZIPs. Keep these bundles beside their relevant sections and avoid selectors or
disclosures. Fonts come from the existing vendored social-card fonts;
their license travels with the public downloads and ZIPs. New graphics and SVG templates reuse
the recorded Figma vector shapes and identify themselves as kit compositions.

Keep the `/brand` route and existing versioned download paths stable when adding a new export.
Dark green (`#367D44`) is the canonical brand color, confirmed by the owner on 4 October 2026.
Brand artwork and the downloadable CSS do not override application or docs UI tokens. Keep
original Figma green and optional recolors labelled as reference colors. Preserve v2 downloads,
including `static/brand/green-goods-brand-kit-v2.zip` and `static/brand/v2/website-ready/` files.

## Generated pages

Generated MDX is committed and reviewed, but never edited directly. Each page declares its generator, source list, and source digest.

```bash
node scripts/docs/generate.mjs
node scripts/docs/generate.mjs --scope package
node scripts/docs/generate.mjs --scope integration
node scripts/docs/generate.mjs --scope ontology
node scripts/docs/generate.mjs --scope workflow
node scripts/docs/generate.mjs --scope qa
node scripts/docs/generate.mjs --scope agentic
```

`bun run check --only docs-generated` renders every projection in memory and fails when an output is missing, extra, or stale.

## Deployment

Vercel Git integration is the only deployment owner. Configure the `green-goods-docs` project with Root Directory `docs`, enable source access outside that directory for the monorepo authorities, use `main` as the production branch, and create previews for other branches. `docs/vercel.json` installs from the repository lockfile and runs the same authority, generation, test, and build checks used locally. Do not link this configuration to the Admin, QA, or Storybook Vercel projects that share the repository.

GitHub's Docs workflow validates changes but does not deploy them. Production uses `https://docs.greengoods.app` after the custom domain is attached to the READY `main` deployment.

## Useful references

- [Docusaurus documentation](https://docusaurus.io/docs)
- [Vercel Git deployments](https://vercel.com/docs/git)
- [Builder contribution guide](./docs/builders/how-to-contribute.mdx)
- [Generator ownership](../scripts/README.md)
