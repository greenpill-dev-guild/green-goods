import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { CHAT_COPY, readChatCopy } from "../../packages/agent/scripts/chat-copy.mjs";
import { CATALOGS, DESIGN_SKILL, DOCS_ROOT, catalogHits, chatCopyHits, docsHits, scanRepository } from "./check-em-dashes.mjs";

function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-em-dashes-"));
  const write = (relativePath, text) => {
    fs.mkdirSync(path.dirname(path.join(root, relativePath)), { recursive: true });
    fs.writeFileSync(path.join(root, relativePath), text);
  };
  return { root, write };
}

/** Clean copy for every chat copy block; `extra` puts source lines first in the named block. */
function writeChatCopy(write, extra = {}) {
  const files = new Map();
  for (const { file, locale, opening, closing, least } of CHAT_COPY) {
    const clean = Array.from({ length: least }, (_, index) => `  "key.${index}": "Clean copy ${index}",`);
    const block = [opening, ...(extra[`${file} ${locale}`] ?? []), ...clean, closing].join("\n");
    files.set(file, `${files.get(file) ?? ""}${block}\n`);
  }
  for (const [file, text] of files) write(file, text);
}

test("a catalog value with an em dash fails under its key; keys and clean values pass", () => {
  const catalog = JSON.stringify({
    "app.balance.offlineNote": "You're offline — balances can't refresh right now.",
    "app.members.solo": "{name} is open — gardeners appear as they sign up.",
    "app.dash—key": "Plain value",
    "app.clean": "You're offline, so balances can't refresh right now.",
  });
  const hits = catalogHits("en.json", catalog);
  assert.equal(hits.length, 2);
  assert.match(hits[0], /^en\.json: app\.balance\.offlineNote: /);
  assert.match(hits[1], /^en\.json: app\.members\.solo: /);
});

test("a chat copy string with an em dash fails at its line, escaped or not; comments and keys pass", () => {
  const { root, write } = tempRoot();
  try {
    const escaped = "\\" + "u2014";
    writeChatCopy(write, {
      "packages/agent/src/i18n.ts en": [
        "  // A comment — is code.",
        '  "dash—key": "Clean value",',
        '  "help.basic": "Post in the topic — the team reads it.",',
        `  "help.footer": "An escaped ${escaped} renders as one.",`,
      ],
    });
    const hits = chatCopyHits(readChatCopy(root));
    assert.deepEqual(
      hits.map((hit) => hit.split(": ")[0]),
      ["packages/agent/src/i18n.ts:4", "packages/agent/src/i18n.ts:5"],
    );
    assert.match(hits[1], /An escaped — renders/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("docs prose fails on the literal em dash, its entities, and the frontmatter title", () => {
  const page = [
    "---",
    "title: Test Cases — every surface",
    "---",
    "",
    "Clean prose, with a comma.",
    "Walk first — then the rest.",
    "An entity &mdash; still renders as one.",
    "So does &#8212; and &#x2014;.",
  ].join("\n");
  const lines = docsHits("page.mdx", page).map((hit) => Number(hit.split(":")[1]));
  assert.deepEqual(lines, [2, 6, 7, 8]);
});

test("docs code is not copy: fenced blocks and inline code spans pass", () => {
  const page = [
    "Run `node check.mjs — dry` before pushing, or ``the — span``.",
    "````markdown",
    "- P0: <walked>/<total> — <pass> pass",
    "```",
    "a shorter run inside the block does not close it — still code",
    "````",
    "~~~text",
    "Layer 3 — Glass Controls",
    "~~~",
    "Prose after the blocks — fails.",
    "```js",
    "```still-code — a fence line with an info string does not close the block",
    "const dash = '—';",
    "```",
    "Prose after the fake fence — fails.",
  ].join("\n");
  const lines = docsHits("page.mdx", page).map((hit) => Number(hit.split(":")[1]));
  assert.deepEqual(lines, [10, 15]);
});

test("the scan reads the chat copy and every authored page and design guide, and skips generated pages and other markdown", () => {
  const { root, write } = tempRoot();
  try {
    for (const catalog of CATALOGS) write(catalog, JSON.stringify({ "app.clean": "No dashes here." }));
    writeChatCopy(write, { "packages/agent/src/services/reporting/views.ts en": ['  timeSpent: "Time — spent",'] });
    const generated = (source) => `---\ngenerated: true\ngenerated_from:\n  - ${source}\n---\n\nA row — from the source.\n`;
    write(`${DOCS_ROOT}/reference/glossary.generated.mdx`, "Ontology text — kept.\n");
    // A Windows checkout writes CRLF; the ontology projection must still be recognized.
    write(`${DOCS_ROOT}/builders/data-model.mdx`, generated("packages/shared/src/ontology/green-goods-ontology.json").replace(/\n/g, "\r\n"));
    write(`${DOCS_ROOT}/builders/test-cases.mdx`, generated("scripts/data/qa-test-catalog.json"));
    write(`${DOCS_ROOT}/guide/authored.md`, "Authored prose — fails.\n");
    write(`${DOCS_ROOT}/guide/clean.mdx`, "Authored prose, clean.\n");
    write("DESIGN.md", "# Root guide, clean\n");
    write("docs/DESIGN.md", "# Docs — Design Brief\n");
    write("packages/client/DESIGN.browser.md", "Guide prose — fails.\n");
    write(`${DESIGN_SKILL}/surfaces.md`, "```\ncode — kept\n```\nSkill prose — fails.\n");
    write(`${DESIGN_SKILL}/patterns/example.md`, "Nested guide prose — fails.\n");
    write("packages/client/README.md", "Not a design guide — ignored.\n");
    write(".claude/rules/frontend-design.md", "Rules, not a design guide — ignored.\n");

    const { failures, chatFiles, pages, skipped, guides } = scanRepository(root);
    assert.deepEqual(
      failures.map((failure) => failure.split(": ")[0]),
      [
        "packages/agent/src/services/reporting/views.ts:2",
        `${DOCS_ROOT}/builders/test-cases.mdx:7`,
        `${DOCS_ROOT}/guide/authored.md:1`,
        `${DESIGN_SKILL}/patterns/example.md:1`,
        `${DESIGN_SKILL}/surfaces.md:4`,
        "docs/DESIGN.md:1",
        "packages/client/DESIGN.browser.md:1",
      ],
    );
    assert.equal(chatFiles, new Set(CHAT_COPY.map(({ file }) => file)).size);
    assert.equal(pages, 3);
    assert.equal(skipped, 2);
    assert.equal(guides, 5);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
