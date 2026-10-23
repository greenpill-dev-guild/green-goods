import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { FIXES, INPUTS, LINK, LINK_TARGET, PAGE, scanRepository } from "./check-brand-voice-parity.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const key = ({ pair, message }) => `${pair}: ${message}`;

/** A copy of every file the check reads; each case plants one difference in it. */
function copyOfRepository() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-brand-voice-parity-"));
  for (const file of INPUTS) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (file === LINK) fs.symlinkSync(LINK_TARGET, target);
    else fs.copyFileSync(path.join(repoRoot, file), target);
  }
  const edit = (file, from, to) => {
    const target = path.join(root, file);
    const text = fs.readFileSync(target, "utf8");
    assert.ok(text.includes(from), `${file} no longer contains the text a case edits: ${from}`);
    fs.writeFileSync(target, text.replaceAll(from, to));
  };
  return { root, edit };
}

let baseline;

/** The failures a planted edit adds to whatever the repository already reports. */
function plantedFailures(plant) {
  baseline ??= new Set(scanRepository(repoRoot).failures.map(key));
  const fixture = copyOfRepository();
  try {
    plant(fixture);
    return scanRepository(fixture.root).failures.filter((failure) => !baseline.has(key(failure)));
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
}

const README = "README.md";
const APP_CONFIG = "packages/shared/src/config/app.ts";
const DOCS_CONFIG = "docs/docusaurus.config.ts";
const WELCOME = "docs/docs/community/welcome.mdx";
const WHY = "docs/docs/community/why-we-build.mdx";
const HTML = "packages/client/index.html";
const PREVIEWS = "packages/client/src/content/publicSocialPreviews.ts";
const EN = "packages/shared/src/i18n/en.json";
const ADMIN = ".claude/skills/design/prompt-contract.md";
const CLIENT = ".claude/skills/design/client-prompt-contract.md";

// [the difference, file, text it replaces, replacement, pair, what the message names]
const DIFFERENCES = [
  ["APP_DESCRIPTION", APP_CONFIG, "into support.\";", "into funding.\";", "descriptor", /APP_DESCRIPTION/],
  ["the docs descriptor constant", DOCS_CONFIG, "'Green Goods helps", "'Green Goods lets", "descriptor", /docusaurus\.config\.ts descriptor/],
  ["the docs tagline", DOCS_CONFIG, "tagline: descriptor,", "tagline: 'Docs',", "descriptor", /tagline/],
  ["the docs footer", DOCS_CONFIG, "copyright: `${descriptor}", "copyright: `Green Goods", "descriptor", /footer/],
  ["the README lead line", README, "**Green Goods helps communities", "**Green Goods helps people", "descriptor", /README\.md lead line/],
  ["the root package description", "package.json", "\"Green Goods helps communities", "\"Green Goods helps groups", "descriptor", /package\.json/],
  ["the Welcome opening line", WELCOME, "**Green Goods helps communities", "**Green Goods helps neighbors", "descriptor", /opening line/],
  ["the Welcome description", WELCOME, "description: \"Green Goods helps", "description: \"Green Goods aids", "descriptor", /frontmatter/],
  ["the meta description", HTML, "into support.\"\n    />", "into support!\"\n    />", "descriptor", /meta description/],
  ["og:description", HTML, "og:description\" content=\"Green Goods helps", "og:description\" content=\"It helps", "descriptor", /og:description/],
  ["twitter:description", HTML, "twitter:description\" content=\"Green Goods helps", "twitter:description\" content=\"It helps", "descriptor", /twitter:description/],
  ["the home social description", PREVIEWS, "\"Green Goods helps communities", "\"Green Goods helps towns", "descriptor", /home description/],
  ["the home hero subtitle", EN, "lede\": \"Green Goods helps", "lede\": \"Green Goods guides", "descriptor", /hero\.lede/],
  ["the app's help answer", EN, "answer\": \"Green Goods helps communities name", "answer\": \"Green Goods helps communities list", "descriptor", /whatIsGreenGoods/],
  ["the hero tagline", EN, "tagline\": \"From good intentions to green", "tagline\": \"From good intentions to great", "brand line", /hero\.tagline/],
  ["the hero title", EN, "<accent>green</accent> outcomes", "<accent>great</accent> outcomes", "brand line", /hero\.title/],
  ["the social card title", PREVIEWS, "cardTitle: \"From good intentions", "cardTitle: \"From good intent", "brand line", /cardTitle/],
  ["a Why We Build cause", WHY, "costs more than doing it.**", "costs more than it should.**", "problem statement", /sentence 2/],
  ["DESIGN.md's voice sentence", "DESIGN.md", "Warm but not gushing", "Kind but not gushing", "voice core", /core voice/],
  ["a dropped \"we are not\" word", PAGE, "Jargon-heavy, academic, blockchain-first", "Jargon-heavy, academic", "voice core", /Grounded pillar\) "We are not"/],
  ["a pillar DESIGN.md lacks", PAGE, "| Active |", "| Playful | Light | Silly |\n| Active |", "voice core", /Playful pillar/],
  ["a changed DESIGN.md tone", "DESIGN.md", "| **Errors** | Calm, constructive |", "| **Errors** | Calm, kind |", "voice core", /Errors tone/],
  ["a lengthened word in a tone", PAGE, "| Calm, constructive; never", "| Calm, constructively; never", "voice core", /Errors tone/],
  ["a changed tone example", PAGE, "patient | \"Start by describing", "patient | \"Start by telling us", "voice core", /Onboarding model line/],
  ["a dropped term to avoid", PAGE, "| steward | admin, manager, operator |", "| steward | admin, operator |", "voice core", /avoid manager/],
  ["an example the contract lacks", PAGE, "\"Approve\", \"Request Changes\"", "\"Approve\", \"Ask for Changes\"", "examples", /quotes "Ask for Changes"/],
  ["a contract example renamed", CLIENT, "\"Fund this garden\" not", "\"Back this garden\" not", "examples", /quotes "Fund this garden"/],
  ["a model line's source changed", WHY, "who are seen for it.**", "who get seen for it.**", "model lines", /from Why We Build/],
  ["an unknown model line source", PAGE, "trace.\" | How It Works |", "trace.\" | How It Works page |", "model lines", /"How It Works page"/],
  ["an uncited decision id", PAGE, "DL-087, DL-090 to DL-094", "DL-087, DL-097, DL-090 to DL-094", "decision ids", /DL-097/],
  ["a term the vocabulary check adds", "scripts/data/banned-vocabulary.json", "\"retention hook\"", "\"retention hook\", \"daily goal\"", "banned list", /leaves out daily goal/],
  ["a term the page adds", PAGE, "re-engagement, retention hook.", "re-engagement, retention hook, daily goal.", "banned list", /names daily goal/],
  ["a heading the check reads", PAGE, "### We are / we are not", "### Pillars", "layout", /"We are \/ we are not" table/],
];

test("the repository's own files agree with the brand voice page, and every pair is compared", () => {
  const { failures, compared } = scanRepository(repoRoot);
  assert.deepEqual(failures.map(key), []);
  for (const pair of Object.keys(FIXES).filter((pair) => pair !== "layout")) {
    assert.ok(compared[pair] > 0, `compared no ${pair}`);
  }
});

test("a difference planted in any restatement fails under its pair, naming where it is", () => {
  for (const [difference, file, from, to, pair, names] of DIFFERENCES) {
    const failures = plantedFailures(({ edit }) => edit(file, from, to));
    assert.equal(failures.length, 1, `${difference}: ${failures.map(key).join(" | ") || "nothing failed"}`);
    assert.equal(failures[0].pair, pair, difference);
    assert.match(failures[0].message, names, difference);
    assert.ok(FIXES[pair], `${difference}: no fix text for ${pair}`);
  }
});

test("formatting the comparison ignores, and an adapted model line, still pass", () => {
  const prose =
    "Proving the work costs more than doing it. The tools for proving it were built for the office and the grant report, not for the field. And the record ends up on platforms the community does not own, so it cannot follow them to the next funder, partner, or tool.";
  for (const [change, plant] of [
    [
      "Why We Build's causes written as prose",
      ({ edit }) => {
        edit(WHY, "- **Proving the work costs more than doing it.**\n", "");
        edit(WHY, "- **The tools for proving it were built for the office** and the grant report, not for the field.\n", "");
        edit(WHY, "- **The record ends up on platforms the community does not own,** so it cannot follow them to the next funder, partner, or tool.", prose);
      },
    ],
    ["curly quotes in a contract", ({ edit }) => edit(ADMIN, "\"Approve\"", "“Approve”")],
    ["a reworded line marked adapted", ({ edit }) => edit(PAGE, "no trace.\" | How It Works |", "no trace at all.\" | How It Works (adapted) |")],
  ]) {
    assert.deepEqual(plantedFailures(plant).map(key), [], change);
  }
});

test("the guidelines path must stay a symbolic link to the page", () => {
  const replaced = (relink) => plantedFailures(({ root }) => {
    fs.rmSync(path.join(root, LINK));
    relink(path.join(root, LINK));
  });
  const copy = replaced((link) => fs.copyFileSync(path.join(repoRoot, PAGE), link));
  assert.deepEqual(copy.map(key), [`symlink: ${LINK} is a regular file, not a symbolic link to ${PAGE}`]);
  const elsewhere = replaced((link) => fs.symlinkSync("../DESIGN.md", link));
  assert.deepEqual(elsewhere.map(key), [`symlink: ${LINK} points at ../DESIGN.md, not ${LINK_TARGET}`]);
  assert.match(FIXES.symlink, /ln -sfn \.\.\/docs\/docs\/reference\/brand-voice\.mdx \.claude\/brand-voice-guidelines\.md/);
});
