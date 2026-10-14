# Green Goods Documentation

The Docusaurus site serves two audiences from one source tree:

- **Community** explains current Green Goods flows for gardeners, stewards, evaluators, and funders.
- **Builders** explains architecture, package boundaries, integrations, testing, and agent workflows.
- **Reference** holds the shared glossary, formal ontology, product history, design rationale, FAQ, brand kit, and credits.

A page's sidebar can differ from its folder. The FAQ (served at `/faq`), the glossary, product history, the brand kit, and credits live in `docs/reference/` and are listed in the Community sidebar. The formal ontology lives there too and is listed under Builders. `sidebars.ts` owns placement.

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

Frontmatter must name the audience, owner, status, and exact `source_of_truth` paths. The docs audit treats broken local authority paths and links as errors, and on a hand-written page so is a repository path in a code span that does not exist (a package page's directory table is read relative to its package).

### Community task pages

A community guide page covers one job. It follows the same order on every page, modeled on Submit Work:

1. **Title:** a verb phrase naming the job.
2. **Purpose:** one or two sentences in the reader's words.
3. **Before you start:** a short list, including physical needs such as being at the garden.
4. **Steps:** numbered Markdown lists that use the exact on-screen labels in bold.
5. **How you know it worked:** what the screen shows.
6. **What happens next:** who acts next, and what the reader sees when they do.
7. **If something goes wrong:** each problem beside its fix, then one support path.
8. **Next step:** exactly one primary link.

Each page must make sense when opened directly from a message or a search result. Concept pages (Welcome, How It Works, Why We Build) use a one-line definition, an everyday comparison, a short story, and a plain "what it is not" instead.

Check every label against the owning view or `packages/shared/src/i18n/en.json`, and every statement about review, rewards, privacy, or money against the code that enforces it, before it goes on a page.

Screenshots support the text and never carry a step alone. Each one needs alt text that says what is shown and a caption that names its source, capture date, viewport/crop where relevant, and build revision when available. If the deployed fixture exposes no revision, say so. Take them from a Storybook fixture, a demo, or a public page, never from a live garden's members or photos. The docs audit fails on an image nothing uses, but it does not check that an `<img>` path exists, so confirm each new path yourself.

### Glossary and ontology ownership

The Community glossary is generated from selected `human_concepts`; formal definitions and
technical vocabulary live in the generated Builders ontology. Both use the canonical ontology
and its projection data. Former glossary anchors remain useful links to their formal destination.
Update sources and run both generators, then docs-generated and ontology checks. Never copy
formal definitions into authored pages. The ontology gate locks definitions/surfaces and checks
public links; deterministic check mode rejects stale outputs. Authored explanations still need
source review when business meaning or availability changes.

### FAQ interaction and stable links

`reference/faq.mdx` uses the docs-owned `FaqQuestions` and `FaqQuestion` components. Each question
keeps an explicit published ID. Native disclosures support keyboard use; direct links reveal
answers, and highlighted search visits open them. Open all answers provides a browser-find path.
The Markdown twin exposes every question and complete answer, without the interaction wrappers.
Keep important privacy and funding warnings visible in the relevant task guide as well.

Generated formal table destinations use `TermAnchor`, which registers the real DOM target with
Docusaurus's link checker. The twin emits a native HTML anchor. Test preserved destinations and
regenerate through the owning renderer; do not silence broken-anchor checking to make a move pass.

### Voice

Community and Builders pages share one voice:

- Second person, active voice, plain words, about an 8th-grade reading level.
- Why before what, condition before instruction, one idea per sentence.
- The product's own labels are the vocabulary. Explain "garden" as a community doing regenerative work together, so nobody reads it as gardening only.
- Community pages leave out protocol names, standards, and network names, except where a reader paying or signing with their own wallet has to choose one. Technical depth belongs on Builders.
- No em dashes, sentence-case section headings, and no superlatives.
- Reassure where people hesitate. Be firm only where the integrity of the record is at stake: your own photos, real dates, real places.
- Money and privacy statements describe what the contracts and code do. They never repeat a guarantee from interface copy.

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
