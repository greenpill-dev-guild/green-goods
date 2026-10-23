#!/usr/bin/env node
// check-brand-voice-parity.mjs
// Fails when the brand voice page and a place that restates it say different things.
//
// The page (docs/docs/reference/brand-voice.mdx) restates rules that other files own, and its
// own opening sentences are copied into the product. Its section 15 says who owns what, and each
// comparison follows it:
// - the descriptor and the brand line (section 1) appear word for word wherever a surface
//   describes the whole product, and the problem statement (section 1) reads the same on Why We
//   Build, where its three causes are a list;
// - DESIGN.md § Voice & Copy owns the voice core: the page's voice sentence, pillars, tone rows,
//   and terminology rows start with DESIGN.md's words and may add after them;
// - the prompt contracts own the dialect examples that section 5 quotes;
// - each section 10 model line is found word for word in the source it names, unless the source
//   says the line was adapted;
// - every decision id the page cites has a row in the decision log (the rule
//   check-guidance-links.mjs applies to the design skill);
// - section 6.4 names exactly the terms the vocabulary check rejects;
// - .claude/brand-voice-guidelines.md stays a symbolic link to the page, never a copy.
//
// Matching ignores markdown emphasis, list bullets, curly quotes, and runs of whitespace.
// Runs as `bun run check --only brand-voice-parity` from the repo root.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// Node built-ins and repository files only: CI Gate imports this check before installing packages.
import { checkDecisionLogCitations } from "../quality/check-guidance-links.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "../..");

export const PAGE = "docs/docs/reference/brand-voice.mdx";
export const LINK = ".claude/brand-voice-guidelines.md";
export const LINK_TARGET = "../docs/docs/reference/brand-voice.mdx";
const DESIGN = "DESIGN.md";
const ADMIN_CONTRACT = ".claude/skills/design/prompt-contract.md";
const CLIENT_CONTRACT = ".claude/skills/design/client-prompt-contract.md";
const LEDGER = ".claude/skills/design/decision-log.md";
const VOCABULARY = "scripts/data/banned-vocabulary.json";
const WHY_WE_BUILD = "docs/docs/community/why-we-build.mdx";
const WELCOME = "docs/docs/community/welcome.mdx";
const EN = "packages/shared/src/i18n/en.json";
const APP_CONFIG = "packages/shared/src/config/app.ts";
const DOCS_CONFIG = "docs/docusaurus.config.ts";
const CLIENT_HTML = "packages/client/index.html";
const SOCIAL_PREVIEWS = "packages/client/src/content/publicSocialPreviews.ts";

/** Section 10's source names and the file each one means. */
const MODEL_LINE_SOURCES = {
  "2.0 announcement": "docs/releases/2.0.0/announcement.md",
  "2.0 release notes": "docs/releases/2.0.0/release-notes.md",
  "Admin copy voice": ADMIN_CONTRACT,
  "Browser design guide": "packages/client/DESIGN.browser.md",
  "Client prompt contract": CLIENT_CONTRACT,
  "DESIGN.md tone spectrum": DESIGN,
  "How It Works": "docs/docs/community/how-it-works.mdx",
  "Public fund page, endowments view": EN,
  "Why We Build": WHY_WE_BUILD,
  "es.json, page error": "packages/shared/src/i18n/es.json",
  "pt.json, page error": "packages/shared/src/i18n/pt.json",
};

/** Every path the check reads or inspects; the validation policy and Design CI start it when one changes. */
export const INPUTS = [
  ...new Set([
    PAGE,
    LINK,
    DESIGN,
    ADMIN_CONTRACT,
    CLIENT_CONTRACT,
    LEDGER,
    VOCABULARY,
    WHY_WE_BUILD,
    WELCOME,
    EN,
    APP_CONFIG,
    DOCS_CONFIG,
    CLIENT_HTML,
    SOCIAL_PREVIEWS,
    "README.md",
    "package.json",
    ...Object.values(MODEL_LINE_SOURCES),
  ]),
].sort();

/** What a writer does about each kind of difference; section 15 of the page names the owners. */
export const FIXES = {
  descriptor:
    "The page's section 1 owns the descriptor. Copy it word for word, or change section 1 and every place that carries it in the same change.",
  "brand line":
    "The page's section 1 owns the brand line. Copy it word for word, or change section 1, the hero strings, and the home social card together.",
  "problem statement":
    "The page's section 1 owns the problem statement. Why We Build carries the same sentences, with the three causes as a list.",
  "voice core":
    "DESIGN.md § Voice & Copy owns the voice sentence, pillars, tone rows, and terminology. Start the page's cell with DESIGN.md's words and add anything after them, or change DESIGN.md first.",
  examples:
    "The prompt contracts own the dialect examples. Quote the contract exactly, or change the contract first.",
  "model lines":
    "A section 10 line quotes shipped copy. Copy it from the source it names, write (adapted) after the source when it was reworded on purpose, or add a new source to MODEL_LINE_SOURCES in scripts/design/check-brand-voice-parity.mjs.",
  "decision ids": `Cite an id that has a row in ${LEDGER}, or add the decision row first.`,
  "banned list": `${VOCABULARY} owns the list. Section 6.4 names exactly its linter_enforced terms.`,
  symlink: `Restore the link with \`ln -sfn ${LINK_TARGET} ${LINK}\`. Edit the docs page, never the link.`,
  layout:
    "The check finds each restatement by its heading or label. Keep it, or move the anchor in scripts/design/check-brand-voice-parity.mjs in the same change.",
};

/** Text as a reader sees it: straight quotes, no emphasis markers, single spaces. */
function plain(text) {
  return String(text)
    .normalize("NFC")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\*\*|__/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const loose = (text) => plain(text).toLowerCase();

/** True when `text` starts with every word of `prefix`; whatever follows may add, not change, a word. */
function startsWithWords(text, prefix) {
  return text.startsWith(prefix) && !/[\p{L}\p{N}]/u.test(text.charAt(prefix.length));
}

/** The sentences of a passage, without list bullets or the "And" the prose form adds before a last cause. */
function sentences(text) {
  return plain(String(text).replace(/^\s*[-*]\s+/gm, "").replace(/^>\s?/gm, ""))
    .split(/(?<=[.?!])\s+/)
    .filter(Boolean)
    .map((sentence) => sentence.replace(/^And\s+(\S)/, (_, first) => first.toUpperCase()));
}

/** Every double-quoted phrase, without a closing period, so "Contribute now." matches "Contribute now". */
function quotedPhrases(text) {
  return [...plain(text).matchAll(/"([^"]+)"/g)].map((match) => match[1].trim().replace(/\.$/, ""));
}

/** The text under the first heading of `level` whose title (after any section number) starts with `title`. */
function section(text, level, title) {
  if (text === undefined) return undefined;
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const heading = new RegExp(`^#{${level}}\\s+(?:[\\d.]+\\s+)?${escaped}`, "i");
  const lines = text.split("\n");
  let start = -1;
  let fenced = false;
  for (const [index, line] of lines.entries()) {
    if (/^\s*(`{3,}|~{3,})/.test(line)) fenced = !fenced;
    if (fenced) continue;
    if (start < 0) {
      if (heading.test(line)) start = index;
    } else if ((line.match(/^(#{1,6})\s/)?.[1].length ?? 7) <= level) {
      return lines.slice(start + 1, index).join("\n");
    }
  }
  return start < 0 ? undefined : lines.slice(start + 1).join("\n");
}

/** The rows of the first markdown table in `text`, header and divider dropped, cells in plain text. */
function tableRows(text) {
  if (text === undefined) return undefined;
  const lines = text.split("\n");
  const first = lines.findIndex((line) => line.trim().startsWith("|"));
  if (first < 0) return undefined;
  const end = lines.findIndex((line, index) => index > first && !line.trim().startsWith("|"));
  return lines
    .slice(first + 2, end < 0 ? undefined : end)
    .map((row) => row.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map(plain));
}

/** The blockquote under a bold label line such as "**Descriptor:**", as one plain paragraph. */
function quoteUnder(text, label) {
  const lines = (text ?? "").split("\n");
  const at = lines.findIndex((line) => plain(line) === label);
  if (at < 0) return undefined;
  const quote = [];
  for (const line of lines.slice(at + 1)) {
    if (line.startsWith(">")) quote.push(line.replace(/^>\s?/, ""));
    else if (quote.length > 0 || line.trim() !== "") break;
  }
  return quote.length > 0 ? plain(quote.join(" ")) : undefined;
}

function stringConstant(source, name) {
  const match = source.match(new RegExp(`\\bconst\\s+${name}\\s*=\\s*(["'\`])([\\s\\S]*?)\\1\\s*;`));
  return match ? plain(match[2]) : undefined;
}

/** The first paragraph after a README's title and badges. */
function leadParagraph(markdown) {
  const lines = markdown.split("\n");
  const paragraph = [];
  for (const line of lines.slice(lines.findIndex((entry) => entry.startsWith("# ")) + 1)) {
    if (line.trim() === "" || line.startsWith("[![")) {
      if (paragraph.length > 0) break;
      continue;
    }
    paragraph.push(line);
  }
  return paragraph.length > 0 ? plain(paragraph.join(" ")) : undefined;
}

/** The frontmatter's one-line description, plain or quoted. */
function frontmatterDescription(markdown) {
  const block = markdown.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? "";
  const value = block.match(/^description:[ \t]*(.+)$/m)?.[1].trim();
  if (!value) return undefined;
  if (/^".*"$/.test(value)) return value.slice(1, -1).replace(/\\(["\\])/g, "$1");
  if (/^'.*'$/.test(value)) return value.slice(1, -1).replace(/''/g, "'");
  return value;
}

/** The first paragraph of a page's body, after its frontmatter, imports, and headings. */
function firstBodyParagraph(markdown) {
  const paragraph = [];
  for (const line of markdown.replace(/^---\n[\s\S]*?\n---\n/, "").split("\n")) {
    if (line.trim() === "" || line.startsWith("import ") || line.startsWith("#")) {
      if (paragraph.length > 0) break;
      continue;
    }
    paragraph.push(line);
  }
  return paragraph.length > 0 ? plain(paragraph.join(" ")) : undefined;
}

/** A rich-text message's words without its tags: "<accent>good</accent>" reads "good". */
function textOutsideTags(message) {
  let text = "";
  let inTag = false;
  for (const character of message) {
    if (character === "<") inTag = true;
    else if (character === ">") inTag = false;
    else if (!inTag) text += character;
  }
  return text;
}

function metaContent(html, attribute, value) {
  for (const tag of html.match(/<meta\b[^>]*>/g) ?? []) {
    const attributes = Object.fromEntries(
      [...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((match) => [match[1], match[2]]),
    );
    if (attributes[attribute] === value) return plain(attributes.content ?? "");
  }
  return undefined;
}

/** One string field of a social preview, such as the home preview's description. */
function previewField(source, key, field) {
  const start = source.indexOf(`${key}: definePreview(`);
  if (start < 0) return undefined;
  const next = source.indexOf("definePreview(", start + key.length + 15);
  const block = source.slice(start, next < 0 ? undefined : next);
  const match = block.match(new RegExp(`\\b${field}:\\s*(["'\`])([\\s\\S]*?)\\1`));
  return match ? plain(match[2]) : undefined;
}

function catalogText(catalog) {
  return Object.values(catalog)
    .flatMap((value) => {
      if (typeof value === "string") return [plain(value)];
      return value && typeof value === "object" ? [catalogText(value)] : [];
    })
    .join("\n");
}

// Normalizing a catalog or guide is the slow step, so each file's plain text is kept by content.
const sourceTexts = new Map();

/** A model line source as plain text: a catalog's values one per line, any other file whole. */
function sourceText(file, text) {
  const byContent = sourceTexts.get(file) ?? new Map();
  sourceTexts.set(file, byContent);
  if (!byContent.has(text)) {
    byContent.set(text, file.endsWith(".json") ? catalogText(JSON.parse(text)) : plain(text));
  }
  return byContent.get(text);
}

/** Short excerpts of two texts around the first place they differ, as `fold` sees them. */
function divergence(expected, actual, fold = (text) => text) {
  const [left, right] = [fold(expected), fold(actual)];
  let at = 0;
  while (at < left.length && at < right.length && left[at] === right[at]) at += 1;
  const clip = (text) => {
    const start = at > 30 ? text.lastIndexOf(" ", at - 30) + 1 : 0;
    const end = Math.min(text.length, at + 50);
    return `"${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}"`;
  };
  return [clip(expected), clip(actual)];
}

function reader(root) {
  const cache = new Map();
  return (relativePath) => {
    if (!INPUTS.includes(relativePath) || relativePath === LINK) {
      throw new Error(`reads ${relativePath}, which INPUTS does not list as a file it reads`);
    }
    if (!cache.has(relativePath)) {
      const text = fs.readFileSync(path.join(root, relativePath), "utf8");
      cache.set(relativePath, text.replace(/\r\n?/g, "\n"));
    }
    return cache.get(relativePath);
  };
}

/** One scan's reads, counts, and failures, and the helpers every comparison shares. */
function scanContext(root) {
  const read = reader(root);
  const failures = [];
  const compared = {};
  const fail = (pair, message) => failures.push({ pair, message });
  const count = (pair) => {
    compared[pair] = (compared[pair] ?? 0) + 1;
  };
  /** Records a missing anchor and returns undefined, so each comparison can stop on its own. */
  const need = (value, file, what) => {
    if (value === undefined || value === "") fail("layout", `${file} has no ${what}`);
    return value || undefined;
  };
  /** Compares a restatement with the owner's words; `opens` lets the restatement add after them. */
  const agree = (pair, owner, ownerWhere, restated, where, { opens = false, caseless = false } = {}) => {
    count(pair);
    if (!restated) return fail("layout", `${where} could not be read`);
    const fold = (text) => (caseless ? text.toLowerCase() : text);
    if (fold(restated) === fold(owner) || (opens && startsWithWords(fold(restated), fold(owner)))) return;
    const [expected, actual] = divergence(owner, restated, fold);
    fail(pair, `${where} reads ${actual}, where ${ownerWhere} reads ${expected}`);
  };
  const page = read(PAGE);
  return {
    root,
    read,
    failures,
    compared,
    fail,
    count,
    need,
    agree,
    page,
    positioning: need(section(page, 2, "What Green Goods is"), PAGE, 'a "What Green Goods is" section'),
    voiceCopy: need(section(read(DESIGN), 2, "Voice & Copy"), DESIGN, 'a "Voice & Copy" section'),
    en: JSON.parse(read(EN)),
  };
}

function compareDescriptor({ read, positioning, en, fail, count, need, agree }) {
  const descriptor = need(quoteUnder(positioning, "Descriptor:"), PAGE, "quote under **Descriptor:**");
  if (!descriptor) return;
  const owner = `${PAGE} section 1`;
  const docsConfig = read(DOCS_CONFIG);
  const welcome = read(WELCOME);
  const html = read(CLIENT_HTML);
  const faq = "app.profile.help.faq.whatIsGreenGoods.answer";
  for (const [restated, where, options] of [
    [stringConstant(read(APP_CONFIG), "APP_DESCRIPTION"), `${APP_CONFIG} APP_DESCRIPTION`],
    [stringConstant(docsConfig, "descriptor"), `${DOCS_CONFIG} descriptor`],
    [leadParagraph(read("README.md")), "README.md lead line"],
    [plain(JSON.parse(read("package.json")).description ?? ""), "package.json description"],
    [firstBodyParagraph(welcome), `${WELCOME} opening line`],
    [plain(frontmatterDescription(welcome) ?? ""), `${WELCOME} frontmatter description`, { opens: true }],
    [metaContent(html, "name", "description"), `${CLIENT_HTML} meta description`],
    [metaContent(html, "property", "og:description"), `${CLIENT_HTML} og:description`],
    [metaContent(html, "name", "twitter:description"), `${CLIENT_HTML} twitter:description`],
    [previewField(read(SOCIAL_PREVIEWS), "home", "description"), `${SOCIAL_PREVIEWS} home description`],
    [plain(en["public.home.hero.lede"] ?? ""), `${EN} public.home.hero.lede`, { opens: true }],
    [plain(en[faq] ?? ""), `${EN} ${faq}`, { opens: true }],
  ]) {
    agree("descriptor", descriptor, owner, restated, where, options);
  }
  // The docs site's tagline and footer carry the sentence through one constant.
  for (const [usage, part] of [
    [/\btagline:\s*descriptor\b/, "tagline no longer uses"],
    [/\bcopyright:\s*`\$\{descriptor\}/, "footer no longer opens with"],
  ]) {
    count("descriptor");
    if (!usage.test(docsConfig)) fail("descriptor", `${DOCS_CONFIG}: the ${part} the descriptor constant`);
  }
}

function compareBrandLine({ read, positioning, en, need, agree }) {
  const brandLine = need(
    positioning?.match(/^\*\*Brand line\b[^\n]*?:\*\*\s*(.+)$/m)?.[1],
    PAGE,
    "**Brand line …:** line in section 1",
  );
  if (!brandLine) return;
  const line = plain(brandLine).replace(/\.$/, "");
  const owner = `${PAGE} section 1`;
  const title = plain(textOutsideTags(en["public.home.hero.title"] ?? ""));
  agree("brand line", line, owner, plain(en["public.home.hero.tagline"] ?? ""), `${EN} public.home.hero.tagline`);
  agree("brand line", line, owner, title, `${EN} public.home.hero.title`);
  agree("brand line", line, owner, previewField(read(SOCIAL_PREVIEWS), "home", "cardTitle"), `${SOCIAL_PREVIEWS} home cardTitle`);
}

function compareProblemStatement({ read, positioning, fail, count, need }) {
  const problem = need(quoteUnder(positioning, "Canonical problem statement:"), PAGE, "problem statement quote");
  const carried = need(section(read(WHY_WE_BUILD), 2, "The problem"), WHY_WE_BUILD, 'a "The problem" section');
  if (!problem || !carried) return;
  count("problem statement");
  const [owned, restated] = [sentences(problem), sentences(carried)];
  const differs = owned.findIndex((sentence, index) => sentence !== restated[index]);
  if (differs < 0 && restated.length === owned.length) return;
  const index = differs < 0 ? owned.length : differs;
  const [expected, actual] = divergence(owned[index] ?? "(nothing)", restated[index] ?? "(nothing)");
  fail(
    "problem statement",
    `${WHY_WE_BUILD} "The problem" sentence ${index + 1} reads ${actual}, where ${PAGE} section 1 reads ${expected}`,
  );
}

function compareVoiceSentence({ page, voiceCopy, need, agree }) {
  const voice = need(voiceCopy?.match(/^\*\*Voice:\*\*\s*(.+)$/m)?.[1], DESIGN, "**Voice:** sentence");
  const pageVoice = section(page, 2, "Voice");
  const coreVoice = need(pageVoice?.match(/^\*\*Core voice\.\*\*\s*(.+)$/m)?.[1], PAGE, "**Core voice.** sentence");
  if (voice && coreVoice) agree("voice core", plain(voice), `${DESIGN} § Voice & Copy`, plain(coreVoice), `${PAGE} core voice`);
}

function comparePillars({ page, voiceCopy, fail, count, need, agree }) {
  const owned = need(tableRows(section(voiceCopy, 3, "Voice Pillars")), DESIGN, "Voice Pillars table");
  const restated = need(
    tableRows(section(section(page, 2, "Voice"), 3, "We are / we are not")),
    PAGE,
    '"We are / we are not" table',
  );
  if (!owned || !restated) return;
  const options = { opens: true, caseless: true };
  for (const [pillar, means, doesNotMean] of owned) {
    const row = restated.find(([name]) => loose(name) === loose(pillar));
    if (!row) {
      count("voice core");
      fail("voice core", `${PAGE} has no ${pillar} pillar, which ${DESIGN} Voice Pillars lists`);
      continue;
    }
    const owner = `${DESIGN} (${pillar} pillar)`;
    const where = `${PAGE} (${pillar} pillar)`;
    agree("voice core", means, `${owner} "Means"`, row[1], `${where} "We are"`, options);
    agree("voice core", doesNotMean, `${owner} "Doesn't Mean"`, row[2], `${where} "We are not"`, options);
  }
  for (const [name] of restated) {
    if (!owned.some(([pillar]) => loose(pillar) === loose(name))) {
      fail("voice core", `${PAGE} lists a ${name} pillar, which ${DESIGN} Voice Pillars does not`);
    }
  }
}

function compareTones({ page, voiceCopy, fail, count, need, agree }) {
  const contextKey = (text) => loose(text).replace(/\s*\([^)]*\)/g, "").replace(/\s*\/\s*/g, " and ").trim();
  const owned = need(tableRows(section(voiceCopy, 3, "Tone Spectrum")), DESIGN, "Tone Spectrum table");
  const restated = need(tableRows(section(page, 2, "Tone by context")), PAGE, "Tone by context table");
  if (!owned || !restated) return;
  for (const [context, tone, example] of owned) {
    const row = restated.find(([name]) => startsWithWords(contextKey(name), contextKey(context)));
    if (!row) {
      count("voice core");
      fail("voice core", `${PAGE} has no ${context} tone row, which ${DESIGN} Tone Spectrum lists`);
      continue;
    }
    const owner = `${DESIGN} (${context} tone)`;
    agree("voice core", tone, owner, row[1], `${PAGE} (${context} tone)`, { opens: true, caseless: true });
    agree("voice core", example, `${owner} example`, row[2], `${PAGE} (${context} model line)`, { opens: true });
  }
}

function compareTerms({ page, voiceCopy, fail, count, need }) {
  const terms = (cell) =>
    loose(cell)
      .replace(/\([^)]*\)/g, "")
      .split(",")
      .map((term) => term.trim())
      .filter(Boolean);
  const owned = need(tableRows(section(voiceCopy, 3, "Terminology")), DESIGN, "Terminology table");
  const restated = need(tableRows(section(page, 3, "Use this, not that")), PAGE, '"Use this, not that" table');
  if (!owned || !restated) return;
  for (const [use, avoid] of owned) {
    count("voice core");
    const [term] = terms(use);
    const row = restated.find(([name]) => terms(name)[0] === term);
    if (!row) {
      fail("voice core", `${PAGE} "Use this, not that" has no ${term} row, which ${DESIGN} Terminology lists`);
      continue;
    }
    const dropped = terms(avoid).filter((word) => !terms(row[1]).includes(word));
    if (dropped.length > 0) {
      fail(
        "voice core",
        `${PAGE} ${term} row does not say to avoid ${dropped.join(", ")}, which ${DESIGN} Terminology does`,
      );
    }
  }
}

function compareExamples({ read, page, fail, count, need }) {
  const examples = (contract) =>
    new Set(quotedPhrases(need(section(read(contract), 2, "Copy Voice"), contract, 'a "Copy Voice" section') ?? ""));
  const contracts = { [ADMIN_CONTRACT]: examples(ADMIN_CONTRACT), [CLIENT_CONTRACT]: examples(CLIENT_CONTRACT) };
  for (const [dialect, contract] of [
    ["Admin dashboard", ADMIN_CONTRACT],
    ["Editorial website", CLIENT_CONTRACT],
    ["PWA app", CLIENT_CONTRACT],
  ]) {
    for (const phrase of quotedPhrases(need(section(page, 3, dialect), PAGE, `"${dialect}" section`) ?? "")) {
      count("examples");
      if (!contracts[contract].has(phrase)) {
        fail("examples", `${PAGE} (${dialect}) quotes "${phrase}", which the Copy Voice section of ${contract} does not`);
      }
    }
  }
}

function compareModelLines({ read, page, fail, count, need }) {
  for (const [line, source] of need(tableRows(section(page, 2, "Model lines")), PAGE, "Model lines table") ?? []) {
    if (/\(adapted\)/i.test(source)) continue;
    count("model lines");
    const file = MODEL_LINE_SOURCES[source];
    if (!file) {
      fail("model lines", `${PAGE} (section 10) names the source "${source}", which the check does not know`);
      continue;
    }
    const quoted = plain(line).replace(/^"|"$/g, "").replace(/\.$/, "");
    if (!sourceText(file, read(file)).includes(quoted)) {
      fail("model lines", `${PAGE} (section 10) quotes "${quoted}" from ${source}, but ${file} does not say it`);
    }
  }
}

function compareDecisionIds({ read, page, compared, fail }) {
  compared["decision ids"] = [...page.matchAll(/\bDL-\d+\b/g)].length;
  for (const failure of checkDecisionLogCitations([{ path: PAGE, text: page }], read(LEDGER))) {
    fail("decision ids", failure);
  }
}

function compareBannedList({ read, page, fail, count, need }) {
  const line = need(
    section(page, 3, "Banned vocabulary")
      ?.split("\n")
      .find((entry) => /Rejected by the vocabulary check/i.test(entry)),
    PAGE,
    'section 6.4 line "Rejected by the vocabulary check …"',
  );
  if (!line) return;
  count("banned list");
  const listed = plain(line)
    .split(":")
    .slice(1)
    .join(":")
    .split(".")[0]
    .split(",")
    .map((term) => term.trim().replace(/^and\s+/i, "").toLowerCase())
    .filter(Boolean);
  const enforced = (JSON.parse(read(VOCABULARY)).linter_enforced?.terms ?? []).map((term) => term.toLowerCase());
  const absent = enforced.filter((term) => !listed.includes(term));
  const extra = listed.filter((term) => !enforced.includes(term));
  const rule = `${VOCABULARY} linter_enforced`;
  if (absent.length > 0) fail("banned list", `${PAGE} section 6.4 leaves out ${absent.join(", ")}, which ${rule} rejects`);
  if (extra.length > 0) fail("banned list", `${PAGE} section 6.4 names ${extra.join(", ")}, which ${rule} does not reject`);
}

function compareSymlink({ root, fail, count }) {
  count("symlink");
  const link = path.join(root, LINK);
  const stat = fs.lstatSync(link, { throwIfNoEntry: false });
  if (!stat) return fail("symlink", `${LINK} is missing`);
  if (!stat.isSymbolicLink()) return fail("symlink", `${LINK} is a regular file, not a symbolic link to ${PAGE}`);
  const target = fs.readlinkSync(link);
  if (path.resolve(path.dirname(link), target) !== path.resolve(root, PAGE)) {
    fail("symlink", `${LINK} points at ${target}, not ${LINK_TARGET}`);
  }
}

const COMPARISONS = [
  compareDescriptor,
  compareBrandLine,
  compareProblemStatement,
  compareVoiceSentence,
  comparePillars,
  compareTones,
  compareTerms,
  compareExamples,
  compareModelLines,
  compareDecisionIds,
  compareBannedList,
  compareSymlink,
];

export function scanRepository(root) {
  const context = scanContext(root);
  for (const compare of COMPARISONS) compare(context);
  return { failures: context.failures, compared: context.compared };
}

function main() {
  try {
    if (process.argv.length > 2) throw new Error(`unknown argument: ${process.argv[2]}`);
    const { failures, compared } = scanRepository(repoRoot);
    if (failures.length > 0) {
      console.error(
        `check-brand-voice-parity: ${failures.length} difference(s) between the brand voice page and the places that restate it:`,
      );
      for (const { pair, message } of failures) console.error(`- [${pair}] ${message}`);
      console.error("To fix:");
      for (const pair of new Set(failures.map((failure) => failure.pair))) console.error(`- ${pair}: ${FIXES[pair]}`);
      console.error(`Section 15 of ${PAGE} lists which source owns what.`);
      process.exit(1);
    }
    const summary = Object.entries(compared)
      .map(([pair, total]) => `${pair} ${total}`)
      .join(", ");
    console.log(`check-brand-voice-parity: the brand voice page agrees with every restatement (${summary}).`);
  } catch (error) {
    console.error(`check-brand-voice-parity: ${error.message}`);
    process.exit(2);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) main();
