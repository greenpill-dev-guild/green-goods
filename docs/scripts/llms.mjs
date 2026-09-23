// Text transforms behind llms.txt and the per-page Markdown twins. The build plugin in
// plugins/llms-twins.mjs does the file work; these stay pure so they can be tested directly.

/** Where a page's Markdown twin is served: its URL plus `.md`, with the home page at `/index.md`. */
export function twinPath(permalink) {
  const clean = permalink.replace(/\/+$/, "");
  return `${clean || "/index"}.md`;
}

const FENCED_CODE = /^(```|~~~)[^\n]*\n[\s\S]*?^\1[ \t]*$/gm;
// Top-level ES imports only: named, default, namespace, and side-effect forms. Named imports may
// span several lines inside their braces.
const IMPORT_STATEMENT =
  /^import\s+(?:(?:\{[^}]*\}|[\w$]+(?:\s*,\s*\{[^}]*\})?|\*\s+as\s+[\w$]+)\s+from\s+)?(["'])[^"'\n]+\1;?[ \t]*\n?/gm;

function outsideFencedCode(text, transform) {
  let result = "";
  let last = 0;
  for (const match of text.matchAll(FENCED_CODE)) {
    result += transform(text.slice(last, match.index)) + match[0];
    last = match.index + match[0].length;
  }
  return result + transform(text.slice(last));
}

/**
 * A page's source as plain Markdown for agents: no frontmatter and no MDX import lines (code
 * examples keep theirs). Components stay as written, so a reader can tell where the site renders
 * something interactive. Pages without their own H1 get one from the title.
 */
export function markdownTwin(source, title) {
  const withoutFrontmatter = source.replace(/^---\n[\s\S]*?\n---\n/, "");
  const body = outsideFencedCode(withoutFrontmatter, (text) => text.replace(IMPORT_STATEMENT, ""))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return `${/^#\s/m.test(body) ? "" : `# ${title}\n\n`}${body}\n`;
}

/**
 * The first real sentence of a twin, for the index: skips headings, comments, components, lists,
 * tables, callouts, and code, so generated banners never become a page's description.
 */
export function leadSentence(markdown) {
  const withoutCode = markdown.replace(FENCED_CODE, "").replace(/<!--[\s\S]*?-->/g, "");
  for (const block of withoutCode.split(/\n\s*\n/)) {
    const text = block.trim();
    if (!text || /^(#|<|\||[-*+]\s|\d+\.\s|:::|>|!\[)/.test(text)) continue;
    const flat = text.replace(/\s+/g, " ").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
    const sentence = flat.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? flat;
    return sentence.length > 220 ? `${sentence.slice(0, 217).trimEnd()}...` : sentence;
  }
  return "";
}

const SECTIONS = [
  { title: "Builders", matches: (permalink) => permalink.startsWith("/builders") },
  { title: "Community", matches: (permalink) => permalink.startsWith("/community") },
  { title: "Reference", matches: () => true },
];

const oneLine = (text) => String(text ?? "").replace(/\s+/g, " ").trim();

/**
 * The llms.txt index: the hand-written site guidance, then every page grouped by section, each
 * linking its Markdown twin with the page's own description.
 */
export function renderLlmsIndex({ header, siteUrl, pages }) {
  const lines = [
    header.trim(),
    "",
    "Every page below is also published as Markdown: add `.md` to its URL, as these links do.",
  ];
  const remaining = [...pages].sort((a, b) => a.permalink.localeCompare(b.permalink));
  for (const section of SECTIONS) {
    const inSection = remaining.filter((page) => section.matches(page.permalink));
    if (!inSection.length) continue;
    for (const page of inSection) remaining.splice(remaining.indexOf(page), 1);
    lines.push("", `## ${section.title}`, "");
    for (const page of inSection) {
      const description = oneLine(page.description);
      lines.push(`- [${oneLine(page.title)}](${siteUrl}${twinPath(page.permalink)})${description ? `: ${description}` : ""}`);
    }
  }
  return `${lines.join("\n")}\n`;
}
