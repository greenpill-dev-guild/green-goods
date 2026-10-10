import assert from "node:assert/strict";
import {describe, test} from "node:test";

import {inlineCopyCommands, leadSentence, markdownTwin, projectionMarkdown, renderLlmsIndex, twinPath} from "./llms.mjs";

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
