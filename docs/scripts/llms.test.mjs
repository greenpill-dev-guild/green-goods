import assert from "node:assert/strict";
import {readFileSync, readdirSync} from "node:fs";
import path from "node:path";
import {describe, test} from "node:test";

import {inlineCopyCommands, integrationStatusMarkdown, leadSentence, markdownTwin, projectionMarkdown, renderLlmsIndex, twinPath} from "./llms.mjs";

describe("markdown twins", () => {
  test("serve each page at its URL plus .md", () => {
    assert.equal(twinPath("/builders/getting-started"), "/builders/getting-started.md");
    assert.equal(twinPath("/builders/testing/"), "/builders/testing.md");
    assert.equal(twinPath("/"), "/index.md");
  });

  test("drop frontmatter and MDX imports but keep code examples intact", () => {
    const source = [
      "---",
      "title: Example",
      "---",
      "",
      "import {IntegrationProjection} from '@site/src/components/docs';",
      "import {",
      "  NextBestAction,",
      "  StatusBadge,",
      "} from '@site/src/components/docs';",
      "",
      "# Example",
      "",
      "Import your wallet before you start.",
      "",
      "```ts",
      "import { useAuth } from \"@green-goods/shared/hooks/auth/useAuth\";",
      "```",
      "",
      "<IntegrationProjection id=\"hats\" />",
    ].join("\n");
    const twin = markdownTwin(source, "Example");
    assert.doesNotMatch(twin, /^title:/m);
    assert.doesNotMatch(twin, /@site\/src\/components\/docs/);
    assert.match(twin, /^# Example\n/);
    assert.match(twin, /Import your wallet before you start\./, "prose that starts with 'Import' stays");
    assert.match(twin, /import \{ useAuth \} from "@green-goods\/shared\/hooks\/auth\/useAuth";/, "code keeps its imports");
    assert.match(twin, /<IntegrationProjection id="hats" \/>/);
  });

  test("give a title to pages without their own heading", () => {
    assert.equal(markdownTwin("---\nslug: /x\n---\nJust text.\n", "Plain Page"), "# Plain Page\n\nJust text.\n");
  });

  test("render the deployment projection a page embeds, so the twin reads whole", () => {
    const integrations = {
      hats: {
        display: "Hats Protocol",
        definition: "Roles.",
        networks: [{chainId: 42161, name: "Arbitrum One", status: "Deployed", recorded: ["hatsModule"]}],
        totalNetworks: 4,
        indexedContracts: ["HatsModule"],
      },
      ens: {display: "ENS", definition: "Names.", networks: [], totalNetworks: 4, indexedContracts: []},
    };
    const twin = markdownTwin("# Hats\n\n<IntegrationProjection id=\"hats\" />\n\nAfter.\n", "Hats", {integrations});
    assert.doesNotMatch(twin, /<IntegrationProjection/);
    assert.match(twin, /^## Checked-in deployment projection$/m);
    assert.match(twin, /\| Arbitrum One \(`42161`\) \| Deployed \| `hatsModule` \|/);
    assert.match(twin, /Networks without recorded components are omitted/);
    assert.match(twin, /^## Indexer boundary\n\nConfigured indexer contracts: `HatsModule`\.$/m);
    assert.match(twin, /regenerates from checked-in artifacts via `node scripts\/docs\/generate\.mjs`/);
    assert.match(twin, /\nAfter\.\n$/);
    assert.match(projectionMarkdown(integrations.ens), /No checked-in deployment artifact records components/);
    assert.doesNotMatch(projectionMarkdown(integrations.ens), /Indexer boundary/);
    assert.throws(() => markdownTwin("<IntegrationProjection id=\"nope\" />", "X", {integrations}), /Unknown integration projection id/);
  });
});

describe("index descriptions", () => {
  test("use the first real sentence, never a generated banner", () => {
    const twin = "# Skills Catalog\n\n<!-- GENERATED FILE: do not edit. Run `node x`. -->\n\nSkills are packaged workflows. A second sentence.\n";
    assert.equal(leadSentence(twin), "Skills are packaged workflows.");
    // Comments do not nest: the first --> closes one, and an opener left behind hides the rest, so
    // no "<!--" can reach the index (the sanitizer case CodeQL flags).
    const dangling = "# T\n\n<!-<!-- banner -->-\n\nA real sentence.\n";
    assert.equal(leadSentence(dangling), "");
    assert.equal(leadSentence("<!-- never closed\n\nHidden by the open comment."), "");
  });

  test("skip components, lists, and code, and keep link text", () => {
    const twin = "# Page\n\n<StatusBadge status=\"Live\" />\n\n- a list item\n\n```bash\nbun run dev\n```\n\nRead the [Architecture](./architecture) page first.\n";
    assert.equal(leadSentence(twin), "Read the Architecture page first.");
  });
});

describe("llms.txt index", () => {
  test("lists every page once, grouped by section, linking its twin", () => {
    const index = renderLlmsIndex({
      header: "# Green Goods Docs\n\nSite guidance.",
      siteUrl: "https://docs.example",
      pages: [
        {title: "Glossary", permalink: "/glossary", description: "Terms."},
        {title: "Getting Started", permalink: "/builders/getting-started", description: "Run it\nlocally."},
        {title: "Welcome", permalink: "/community/welcome", description: ""},
      ],
    });
    assert.match(index, /^# Green Goods Docs\n\nSite guidance\./);
    assert.match(index, /## Builders\n\n- \[Getting Started\]\(https:\/\/docs\.example\/builders\/getting-started\.md\): Run it locally\./);
    assert.match(index, /## Community\n\n- \[Welcome\]\(https:\/\/docs\.example\/community\/welcome\.md\)\n/);
    assert.match(index, /## Reference\n\n- \[Glossary\]\(https:\/\/docs\.example\/glossary\.md\): Terms\./);
    assert.equal(index.match(/^- \[/gm).length, 3);
  });
});

describe("copy-command tags", () => {
  test("become the code span they render, with the generator's encoding undone", () => {
    const row = '| dev | <CopyCommand command="bun run dev" /> | <CopyCommand command="bun run contracts -- deploy core --sender &lt;sender&gt; &amp;&amp; echo &quot;done&quot; &#124; cat" /> |';
    const twin = markdownTwin(`---\ntitle: T\n---\n\n# T\n\n${row}\n`, "T");
    assert.ok(twin.includes("| dev | `bun run dev` |"), twin);
    assert.ok(twin.includes('`bun run contracts -- deploy core --sender <sender> && echo "done" | cat`'), twin);
    assert.equal(inlineCopyCommands("<CopyCommand command='bun run test' />"), "`bun run test`");
  });

  test("stay literal inside fenced code", () => {
    const source = '---\ntitle: T\n---\n\n# T\n\n```md\n<CopyCommand command="bun run dev" />\n```\n';
    assert.ok(markdownTwin(source, "T").includes('<CopyCommand command="bun run dev" />'));
  });
});

describe("status table and onboarding expansions", () => {
  const integrations = {
    karma: {display: "Karma GAP", networks: [{chainId: 42161, name: "Arbitrum One", status: "Deployed", recorded: ["karmaGAPModule"]}], totalNetworks: 4, indexedContracts: ["KarmaGAPModule"]},
    ens: {display: "ENS", networks: [], totalNetworks: 4, indexedContracts: []},
  };

  test("render the integration status table the overview embeds", () => {
    const twin = markdownTwin("---\ntitle: I\n---\n\n# I\n\n<IntegrationStatusTable />\n", "I", {integrations});
    assert.ok(twin.includes("| [ENS](/builders/integrations/ens) | None recorded | none |"), twin);
    assert.ok(twin.includes("| [Karma GAP](/builders/integrations/karma) | Arbitrum One (Deployed) | `KarmaGAPModule` |"), twin);
    assert.equal(integrationStatusMarkdown(integrations).split("\n").length, 4);
  });

  test("render the onboarding procedure in a four-backtick fence so its own fences survive", () => {
    const text = "# Onboarding\n\n```bash\nbun run dev\n```\n";
    const twin = markdownTwin("---\ntitle: G\n---\n\n# G\n\n<OnboardingProcedure />\n", "G", {onboarding: text});
    assert.ok(twin.includes("````markdown\n# Onboarding\n\n```bash\nbun run dev\n```\n````"), twin);
    assert.ok(markdownTwin("# G\n\n<OnboardingProcedure />\n", "G").includes("<OnboardingProcedure />"));
  });
});

describe("data-backed component fallbacks", () => {
  const docsRoot = path.resolve(import.meta.dirname, "..");
  const data = (name) => JSON.parse(readFileSync(path.join(docsRoot, "src/data", name), "utf8"));
  const siteData = {
    integrations: data("integration-projections.json").integrations,
    onboarding: data("onboarding.json").text,
    designTokens: data("design-tokens.json"),
    brandKit: data("brand-kit-v3.json"),
    rolePaths: data("role-paths.json"),
    stewardPath: data("steward-path.json"),
  };

  test("each component becomes the Markdown of the data it draws", () => {
    const twin = (tag, options) => markdownTwin(`# T\n\n${tag}\n`, "T", options);
    const tokens = twin("<DesignTokens />", {
      designTokens: {
        colors: {amber: "#D97706"},
        typography: {"body-md": {fontFamily: "Inter", fontSize: "16px", fontWeight: 400, lineHeight: 1.5}},
        rounded: {lg: "16px"},
        spacing: {sm: "8px"},
      },
    });
    assert.ok(tokens.includes("#### Colors\n\n| Token | Value |\n|---|---|\n| `amber` | `#D97706` |"), tokens);
    assert.ok(tokens.includes("| `body-md` | Inter | 16px | 400 | 1.5 |"));
    assert.ok(tokens.includes("#### Radii") && tokens.includes("| `sm` | `8px` |"));

    const brand = markdownTwin("<BrandAssets />\n\n## Usage\n", "Brand kit", {
      brandKit: {
        version: 3,
        canonicalColor: "dark-green",
        wholeKit: {url: "/brand/kit.zip"},
        bundles: [{label: "Logos", url: "/brand/logos.zip"}],
        palette: [{id: "dark-green", name: "Dark green", hex: "#367D44", role: "Canonical brand color", status: "canonical"}],
        typography: [{name: "Inter", role: "Body copy", source: "https://example.org/inter", sourceLabel: "Inter source"}],
        graphics: [{title: "Symbol repeat", description: "1600 × 900 px"}],
        templates: [{title: "Social card", description: "1200 × 630 px"}],
        files: [{file: "primary/a.svg", format: "svg"}, {file: "primary/a.png", format: "png"}, {file: "palette/p.json", format: "json"}],
      },
    });
    assert.ok(brand.startsWith("# Brand kit\n\nKit v3. Dark green `#367D44` is the canonical brand color."), brand);
    assert.ok(brand.includes("- [Download the whole kit (ZIP)](/brand/kit.zip)\n- [Logos bundle (ZIP)](/brand/logos.zip)"));
    assert.ok(brand.includes("| `primary` | 2 | svg, png |") && brand.includes("| `palette` | 1 | json |"));
    assert.ok(brand.includes("| Inter | Body copy | [Inter source](https://example.org/inter) |"));
    assert.ok(brand.trimEnd().endsWith("## Usage"), "the page's own prose still follows the inventory");

    const roles = twin("<Hero />", {rolePaths: [{title: "Gardener", href: "/g/", audience: "Field workers", time: "5 min", description: "Document work."}]});
    assert.ok(roles.includes("- [Gardener](/g/) (Field workers, 5 min): Document work."), roles);
    const path = twin("<StewardPathNav />", {stewardPath: [{label: "Create a Garden", href: "/a"}, {label: "Review Work", href: "/b"}]});
    assert.ok(path.includes("Steward path:\n\n1. [Create a Garden](/a)\n2. [Review Work](/b)"), path);
  });

  test("no page's twin is left with a bare component tag where content should be", () => {
    // A tag with no props and no children carries nothing in the page source, so a twin that kept
    // it would have a hole where the site shows content. Every such component needs a fallback
    // in llms.mjs; this walks the real pages with the real data so a new one cannot slip in.
    const BARE_TAG = /^[ \t]*<[A-Z][A-Za-z]*\s*\/>[ \t]*$/gm;
    const FENCE = /^(```|~~~)[^\n]*\n[\s\S]*?^\1[ \t]*$/gm;
    const pages = [];
    const walk = (directory) => {
      for (const entry of readdirSync(directory, {withFileTypes: true})) {
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.mdx?$/.test(entry.name)) pages.push(full);
      }
    };
    walk(path.join(docsRoot, "docs"));
    assert.ok(pages.length > 50, "the walk found the docs pages");
    const holes = [];
    for (const page of pages) {
      const twin = markdownTwin(readFileSync(page, "utf8"), "T", siteData).replace(FENCE, "");
      for (const [tag] of twin.matchAll(BARE_TAG)) holes.push(`${path.relative(docsRoot, page)}: ${tag.trim()}`);
    }
    assert.deepEqual(holes, []);
    // The four named components really are in use, so the walk above exercised their fallbacks.
    const real = (page) => markdownTwin(readFileSync(path.join(docsRoot, "docs", page), "utf8"), "T", siteData);
    assert.match(real("reference/brand.mdx"), /^- \[Download the whole kit \(ZIP\)\]\(\/brand\//m);
    assert.match(real("builders/architecture/design.mdx"), /^\| `tertiary-action` \| `#[0-9A-F]{6}` \|$/m);
    assert.match(real("community/welcome.mdx"), /^- \[Gardener\]\(\/community\/gardener-guide\/\)/m);
    assert.match(real("community/steward-guide/reviewing-work.mdx"), /^3\. \[Review and Approve Work\]/m);
  });
});
