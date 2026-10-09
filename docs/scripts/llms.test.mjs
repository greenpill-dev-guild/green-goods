import assert from "node:assert/strict";
import {describe, test} from "node:test";

import {leadSentence, markdownTwin, renderLlmsIndex, twinPath} from "./llms.mjs";

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
