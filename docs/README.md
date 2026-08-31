# Green Goods Documentation

The Docusaurus site serves two audiences from one source tree:

- **Community** explains current Green Goods flows for gardeners, stewards/evaluators, and funders.
- **Builders** explains architecture, package boundaries, integrations, testing, and agent workflows.
- **Reference** holds the shared glossary, formal ontology, product history, design rationale, FAQ, and credits.

Implementation facts come from code and configuration. Authored pages explain flows and stable rationale; generated pages project routes, exports, deployment artifacts, ontology, workflows, and QA scenarios from their owning sources.

## Work locally

Run commands from the repository root:

```bash
bun run dev:docs
```

The docs server listens on port 3003. Before handing off a change, run the docs checks selected by the validation planner:

```bash
bun run docs:audit:ci
bun run check:docs-generated
bun run test:docs
bun run build:docs
bun run --cwd docs check:search-index
```

The static build is written to `docs/build`. `bun run build:docs` also fails unless the generated
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

## Generated pages

Generated MDX is committed and reviewed, but never edited directly. Each page declares its generator, source list, and source digest.

```bash
bun run docs:generate
bun run docs:generate -- --scope package
bun run docs:generate -- --scope integration
bun run docs:generate -- --scope ontology
bun run docs:generate -- --scope workflow
bun run docs:generate -- --scope qa
bun run docs:generate -- --scope agentic
```

`bun run check:docs-generated` renders every projection in memory and fails when an output is missing, extra, or stale.

## Deployment

Vercel Git integration is the only deployment owner. Configure the `green-goods-docs` project with Root Directory `docs`, enable source access outside that directory for the monorepo authorities, use `main` as the production branch, and create previews for other branches. `docs/vercel.json` installs from the repository lockfile and runs the same authority, generation, test, and build checks used locally. Do not link this configuration to the Admin, QA, or Storybook Vercel projects that share the repository.

GitHub's Docs workflow validates changes but does not deploy them. Production uses `https://docs.greengoods.app` after the custom domain is attached to the READY `main` deployment.

## Useful references

- [Docusaurus documentation](https://docusaurus.io/docs)
- [Vercel Git deployments](https://vercel.com/docs/git)
- [Builder contribution guide](./docs/builders/how-to-contribute.mdx)
- [Generator ownership](../scripts/README.md)
