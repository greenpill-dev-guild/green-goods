import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const AUDIT = path.resolve(import.meta.dirname, "docs-audit.mjs");
const VERCEL_CONFIG = path.resolve(import.meta.dirname, "../vercel.json");

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "green-goods-docs-audit-"));
  mkdirSync(path.join(root, "docs/docs/builders"), { recursive: true });
  mkdirSync(path.join(root, "docs/docs/reference"), { recursive: true });
  mkdirSync(path.join(root, "packages/shared/src/ontology"), { recursive: true });
  writeFileSync(
    path.join(root, "packages/shared/src/ontology/green-goods-ontology.json"),
    JSON.stringify({
      personas: [{id: "gardener"}, {id: "steward"}, {id: "evaluator"}, {id: "funder"}, {id: "community-member"}],
      enums: [{members: ["None", "Cancelled"]}],
    }),
  );
  mkdirSync(path.join(root, "scripts/data"), { recursive: true });
  writeFileSync(
    path.join(root, "scripts/data/banned-vocabulary.json"),
    JSON.stringify({
      us_spelling: {terms: {cancelled: "canceled", grey: "gray", favourite: "favorite"}, exempt_phrases: ["Grey Matter Fund"]},
    }),
  );
  writeFileSync(path.join(root, "authority.ts"), "export const authority = true;\n");
  writeFileSync(
    path.join(root, "docs/docs/builders/test.mdx"),
    `---
audience: developer
owner: engineering
last_verified: 2026-08-30
feature_status: Live
slug: /builders/test
source_of_truth:
  - authority.ts
---
# Test
`,
  );
  writeFileSync(
    path.join(root, "docs/docs/reference/product-history.mdx"),
    `---
audience: developer
owner: engineering
last_verified: 2026-08-30
feature_status: Complete
slug: /reference/product-history
---
# Product history

## Version 1.0 {#version-1-0}
`,
  );
  writeFileSync(path.join(root, "docs/sidebars.ts"), "export default ['builders/test'];\n");
  writeFileSync(
    path.join(root, "docs/docusaurus.config.ts"),
    "export default { redirects: [{ from: '/old', to: '/reference/product-history#version-1-0' }] };\n",
  );
  return root;
}

function runAudit(root) {
  return spawnSync(process.execPath, [AUDIT, "--ci", "--root", root], { encoding: "utf8" });
}

test("accepts existing authority and redirect-fragment targets", () => {
  const root = fixture();
  try {
    const result = runAudit(root);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Vercel serves Docusaurus HTML at extensionless routes", () => {
  const config = JSON.parse(readFileSync(VERCEL_CONFIG, "utf8"));
  assert.equal(config.cleanUrls, true);
  assert.equal(config.outputDirectory, "build");
});

test("ignores unterminated MDX tags when deriving heading anchors", () => {
  const root = fixture();
  try {
    const file = path.join(root, "docs/docs/reference/product-history.mdx");
    writeFileSync(
      file,
      readFileSync(file, "utf8").replace("## Version 1.0 {#version-1-0}", "## Version 1-0 <script"),
    );
    const result = runAudit(root);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("broken authored authority exits nonzero", () => {
  const root = fixture();
  try {
    writeFileSync(
      path.join(root, "docs/docs/builders/test.mdx"),
      `---
audience: developer
owner: engineering
last_verified: 2026-08-30
feature_status: Live
slug: /builders/test
source_of_truth:
  - missing.ts
---
# Test
`,
    );
    const result = runAudit(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /source_of_truth path not found: missing\.ts/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("unlisted and unreachable public pages exit nonzero", () => {
  const root = fixture();
  try {
    writeFileSync(
      path.join(root, "docs/docs/builders/hidden.mdx"),
      `---
audience: developer
owner: engineering
last_verified: 2026-08-30
feature_status: Live
slug: /builders/hidden
unlisted: true
source_of_truth:
  - authority.ts
---
# Hidden
`,
    );
    const result = runAudit(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /must not set unlisted: true/);
    assert.match(result.stderr, /unreachable from navigation: builders\/hidden/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("invalid ontology audience exits nonzero", () => {
  const root = fixture();
  try {
    const file = path.join(root, "docs/docs/builders/test.mdx");
    writeFileSync(file, readFileSync(file, "utf8").replace("audience: developer", "audience: deployer"));
    const result = runAudit(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Invalid audience identifier: deployer/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("broken markdown fragment exits nonzero", () => {
  const root = fixture();
  try {
    const file = path.join(root, "docs/docs/builders/test.mdx");
    writeFileSync(file, `${readFileSync(file, "utf8")}\n[History](/reference/product-history#missing)\n`);
    const result = runAudit(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Markdown link fragment not found/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a hand-written page that names a repository path that is not there exits nonzero", () => {
  const root = fixture();
  try {
    mkdirSync(path.join(root, "packages/client/src/views"), { recursive: true });
    mkdirSync(path.join(root, "docs/docs/builders/packages"), { recursive: true });
    writeFileSync(path.join(root, "packages/client/src/main.tsx"), "");
    writeFileSync(path.join(root, "docs/sidebars.ts"), "export default ['builders/test', 'builders/packages/client'];\n");
    const file = path.join(root, "docs/docs/builders/packages/client.mdx");
    const page = (entry, rows) => `---
audience: developer
owner: engineering
last_verified: 2026-08-30
feature_status: Live
slug: /builders/packages/client
source_of_truth:
  - authority.ts
---
# Client

The entry is \`${entry}\`, and a glob such as \`packages/client/src/**\` is not one path.

| Directory | What lives there |
|---|---|
${rows}

\`\`\`bash
cat packages/client/src/an-example-that-need-not-exist.ts
\`\`\`
`;
    writeFileSync(file, page("packages/client/src/main.tsx", "| `src/views/` | Screens |"));
    const clean = runAudit(root);
    assert.equal(clean.status, 0, clean.stderr);
    // A renamed entry file and a directory row that no longer exists are both named.
    writeFileSync(file, page("packages/client/src/index.tsx", "| `src/views/` | Screens |\n| `src/routes/` | Gone |"));
    const result = runAudit(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /client\.mdx: Repository path not found: packages\/client\/src\/index\.tsx/);
    assert.match(result.stderr, /client\.mdx: Repository path not found: src\/routes\//);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("UK spelling in docs prose or design guidance exits nonzero, while names stay free", () => {
  const root = fixture();
  try {
    const file = path.join(root, "docs/docs/builders/test.mdx");
    const names = [
      "",
      "## Approve stays gray {#approve-stays-grey}",
      "",
      "The `cancelled` state, [the guide](https://example.com/grey-area) and https://example.com/grey stay as written.",
      '<img src="/img/grey.png" alt="Approve looks gray" />',
      "The Grey Matter Fund keeps its own name.",
      'A ``cancelled`` span keeps its name, as does <Status state={CycleState.Cancelled} style={{color: "grey"}} />.',
      "A bare prop is a name too: <Status cancelled />.",
      "A code span can wrap: `the",
      "cancelled state` stays code.",
      '<Status>{state === CycleState.Cancelled ? "Closed" : "Open"}</Status>',
      '{state === "cancelled" ? "Stopped" : "Open"}',
      "<Status>",
      "  {state === CycleState.Cancelled",
      '    ? "Closed"',
      '    : "Open"}',
      "</Status>",
      "{/* An MDX comment is cancelled from the page. */}",
      "{/*",
      "So is one that spans lines, cancelled or not.",
      "*/}",
      "<Status",
      "  cancelled",
      '  state="grey"',
      "/>",
      "<!--",
      "A comment is cancelled from the page, across lines.",
      "-->",
      "<code>",
      "cancelled",
      "</code>",
      "",
      "```text",
      "cancelled",
      "```",
      "",
      "````markdown",
      "```js",
      "cancelled",
      "```",
      "````",
      "",
      // MDX reads an import or export to a blank line where its code is complete.
      "import {",
      "  Cancelled,",
      '} from "@site/src/components/docs";',
      "",
      "export const states = [",
      "",
      '  "cancelled",',
      "];",
      "",
      "",
    ].join("\n");
    writeFileSync(file, readFileSync(file, "utf8") + names);
    // A generated page prints the ontology's enum members as plain text: in a cell of members and
    // inside a sentence they are names too.
    const generated = path.join(root, "docs/docs/reference/generated.mdx");
    writeFileSync(
      generated,
      `---
audience: developer
owner: engineering
feature_status: Live
slug: /reference/generated
generated: true
generator: authority.ts
source_digest: "sha256:${"0".repeat(64)}"
generated_from:
  - authority.ts
source_of_truth:
  - authority.ts
---
# Generated

| State | Where |
|---|---|
| Cancelled | on-chain |

Requests stop at pre-disbursement Cancelled.
`,
    );
    // DESIGN.md is CommonMark, so an indented block after a blank line is code there.
    const design = path.join(root, "DESIGN.md");
    const indentedCode = "# Design\n\n    cancelled is a status name in this code block\n";
    // A link loses its destination whatever form its title takes.
    const designLinks = "\n[One](./grey 'Garden guide'), [two](./grey (Garden guide)) and [three](<./grey area>) lose their destinations.\n";
    writeFileSync(design, indentedCode + designLinks);
    const clean = runAudit(root);
    assert.equal(clean.status, 0, clean.stderr);

    // A folded frontmatter value is rendered page metadata, read whole across its lines.
    const dirty = `${readFileSync(file, "utf8")}The row reads cancelled.\n\n    MDX reads this indented line as text, so cancelled counts.\n\nSee [the garden](https://example.com/g "The favourite garden") and <span aria-label="A grey icon">x</span>.\n\nAn escaped \\\`grey\\\` mark is text.\n\n<img\n  src="/img/x.png"\n  alt="A grey mark"\n/>\n\nSee [the guide](https://example.com/guide 'The favourite guide').\n\nA lone \`tick stops at a blank line,\n\nso cancelled here counts.\n\n- A \`list item\n- cancelled in the next one counts.\n\n<Status>{done ? "The cycle was cancelled." : "Open"}</Status>\n\nAn escaped \\{cancelled} brace is text.\n`.replace(
      "slug: /builders/test\n",
      "slug: /builders/test\ndescription: >-\n  How the field\n  turns grey.\n",
    );
    writeFileSync(file, dirty);
    const lineOf = (text) => dirty.split("\n").indexOf(text) + 1;
    // In CommonMark an indented line that continues a list item is prose, not code.
    writeFileSync(design, `${indentedCode}${designLinks}\nA grey border marks the field.\n\n- A list item\n    keeps a grey continuation.\n`);
    // Starting a sentence, a member is copy.
    const generatedDirty = `${readFileSync(generated, "utf8")}\nThe cycle was cancelled.\nCancelled requests remain visible.\n`;
    writeFileSync(generated, generatedDirty);
    const generatedLineOf = (text) => generatedDirty.split("\n").indexOf(text) + 1;
    const result = runAudit(root);
    assert.equal(result.status, 1);
    assert.ok(
      result.stderr.includes(
        `builders/test.mdx: UK spelling on line ${lineOf("The row reads cancelled.")}: "cancelled"; English copy uses US spelling ("canceled")`,
      ),
      result.stderr,
    );
    assert.ok(result.stderr.includes(`builders/test.mdx: UK spelling on line ${lineOf("description: >-")}: "grey"`), result.stderr);
    const linkLine = lineOf('See [the garden](https://example.com/g "The favourite garden") and <span aria-label="A grey icon">x</span>.');
    assert.ok(result.stderr.includes(`builders/test.mdx: UK spelling on line ${linkLine}: "favourite"`), result.stderr);
    assert.ok(result.stderr.includes(`builders/test.mdx: UK spelling on line ${linkLine}: "grey"`), result.stderr);
    assert.ok(result.stderr.includes(`builders/test.mdx: UK spelling on line ${lineOf("An escaped \\`grey\\` mark is text.")}: "grey"`), result.stderr);
    // A tag that spans lines keeps a readable value on its own line.
    assert.ok(result.stderr.includes(`builders/test.mdx: UK spelling on line ${lineOf('  alt="A grey mark"')}: "grey"`), result.stderr);
    // A code span stops at a blank line and at a new list item.
    assert.ok(result.stderr.includes(`builders/test.mdx: UK spelling on line ${lineOf("so cancelled here counts.")}: "cancelled"`), result.stderr);
    assert.ok(result.stderr.includes(`builders/test.mdx: UK spelling on line ${lineOf("- cancelled in the next one counts.")}: "cancelled"`), result.stderr);
    // A string an MDX expression renders is copy, and an escaped brace is text.
    assert.ok(result.stderr.includes(`builders/test.mdx: UK spelling on line ${lineOf('<Status>{done ? "The cycle was cancelled." : "Open"}</Status>')}: "cancelled"`), result.stderr);
    assert.ok(result.stderr.includes(`builders/test.mdx: UK spelling on line ${lineOf("An escaped \\{cancelled} brace is text.")}: "cancelled"`), result.stderr);
    // A single-quoted link title is copy too.
    assert.ok(result.stderr.includes(`builders/test.mdx: UK spelling on line ${lineOf("See [the guide](https://example.com/guide 'The favourite guide').")}: "favourite"`), result.stderr);
    assert.ok(
      result.stderr.includes(
        `builders/test.mdx: UK spelling on line ${lineOf("    MDX reads this indented line as text, so cancelled counts.")}: "cancelled"`,
      ),
      result.stderr,
    );
    assert.match(result.stderr, /DESIGN\.md: UK spelling on line 7: "grey"/);
    assert.match(result.stderr, /DESIGN\.md: UK spelling on line 10: "grey"/);
    assert.doesNotMatch(result.stderr, /DESIGN\.md: UK spelling on line 3:/);
    const cancelledLine = generatedLineOf("The cycle was cancelled.");
    assert.match(result.stderr, new RegExp(`reference/generated\\.mdx: UK spelling on line ${cancelledLine}: "cancelled".* Fix it in the source this page is generated from\\.`));
    const sentenceStart = generatedLineOf("Cancelled requests remain visible.");
    assert.ok(result.stderr.includes(`reference/generated.mdx: UK spelling on line ${sentenceStart}: "Cancelled"`), result.stderr);
    assert.equal(result.stderr.match(/UK spelling/g)?.length, 16, result.stderr);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("orphaned public asset exits nonzero", () => {
  const root = fixture();
  try {
    mkdirSync(path.join(root, "docs/static/img"), { recursive: true });
    writeFileSync(path.join(root, "docs/static/img/orphan.svg"), "<svg />\n");
    const result = runAudit(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Public asset has no source consumer/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("downstream public-doc authority exits nonzero", () => {
  const root = fixture();
  try {
    writeFileSync(
      path.join(root, "AGENTS.md"),
      "`docs/docs/builders/test.mdx` is the active UI contract.\n",
    );
    const result = runAudit(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Implementation authority points downstream into public docs/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a Steward guide page without the guide frontmatter exits nonzero", () => {
  const root = fixture();
  try {
    mkdirSync(path.join(root, "docs/docs/community/steward-guide"), { recursive: true });
    writeFileSync(
      path.join(root, "docs/docs/community/steward-guide/reviewing-work.mdx"),
      `---
audience: steward
owner: engineering
last_verified: 2026-08-30
feature_status: Live
slug: /community/steward-guide/reviewing-work
source_of_truth:
  - authority.ts
---
# Reviewing work
`,
    );
    writeFileSync(
      path.join(root, "docs/sidebars.ts"),
      "export default ['builders/test', 'community/steward-guide/reviewing-work'];\n",
    );
    const result = runAudit(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /steward-guide\/reviewing-work\.mdx.*Missing required frontmatter field: goal/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("broken redirect fragment exits nonzero", () => {
  const root = fixture();
  try {
    writeFileSync(
      path.join(root, "docs/docusaurus.config.ts"),
      "export default { redirects: [{ from: '/old', to: '/reference/product-history#missing' }] };\n",
    );
    const result = runAudit(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Redirect fragment not found/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
