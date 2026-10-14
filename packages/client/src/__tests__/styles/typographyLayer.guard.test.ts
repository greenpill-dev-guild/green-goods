/**
 * Guard: the client's element defaults never restyle the shared controls, and
 * no heading depends on element defaults for its type.
 *
 * typography.css sits in Tailwind's utilities layer, which outranks the shared
 * controls' components layer whatever the specificity. A bare `a { color }` made
 * every Button rendered as a link link-green, and a bare `* { font-family }` took
 * the serif off the editorial field; both reached the pre-merge screenshots.
 * Its `h1`–`h6` size rules inflated the shared sheet header, and removing them
 * (DL-028) shrank every heading that had leaned on them, so each heading now
 * names its own size and weight.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../../styles/typography.css"), "utf-8").replace(
  /\/\*[\s\S]*?\*\//g,
  ""
);
const rules = Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g), ([, selector, body]) => ({
  selector: selector.trim().replace(/\s+/g, " "),
  body,
}));
const declares = (body: string, property: string) =>
  new RegExp(`(?:^|[;\\s])${property}\\s*:`).test(body);

const SOURCE_ROOT = resolve(__dirname, "../..");
const SIZE_CLASS = /(?:^|[\s"'`:])!?text-(?:xs|sm|base|lg|xl|[2-9]xl|\[[^\]\s]+\])(?=[\s"'`]|$)/;
// Theme type utilities carry a size and a weight together.
const TYPE_UTILITY = /(?:^|[\s"'`:])!?text-(?:title|label|paragraph)-[a-z0-9]+(?=[\s"'`]|$)/;
const WEIGHT_CLASS =
  /(?:^|[\s"'`:])!?font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)(?=[\s"'`]|$)/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" ? [] : sourceFiles(path);
    return /\.tsx$/.test(name) && !/\.(test|stories)\.tsx$/.test(name) ? [path] : [];
  });
}

/** Opening tags of every `h1`–`h6` in a TSX source, comments removed. */
function headingTags(source: string): { tag: string; line: number; text: string }[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));
  const found: { tag: string; line: number; text: string }[] = [];
  for (const match of code.matchAll(/<(h[1-6])(?=[\s>])/g)) {
    let depth = 0;
    let quote: string | null = null;
    let end = match.index + match[0].length;
    for (; end < code.length; end++) {
      const char = code[end];
      if (quote) {
        if (char === quote && code[end - 1] !== "\\") quote = null;
      } else if (char === '"' || char === "'" || char === "`") quote = char;
      else if (char === "{") depth++;
      else if (char === "}") depth--;
      else if (char === ">" && depth === 0) break;
    }
    found.push({
      tag: match[1],
      line: code.slice(0, match.index).split("\n").length,
      text: code.slice(match.index, end + 1),
    });
  }
  return found;
}

describe("client typography layer", () => {
  it("colours links but not links rendered as shared buttons", () => {
    const linkColour = rules.filter(
      (rule) => /(?:^|,\s*)a(?=[\s,:]|$)/.test(rule.selector) && declares(rule.body, "color")
    );
    expect(linkColour.map((rule) => rule.selector)).toEqual([
      "a:where(:not(.gg-button, .gg-icon-button, .gg-chip))",
    ]);
  });

  it("sets the sans face everywhere except the editorial field", () => {
    const universal = rules.filter(
      (rule) => rule.selector.startsWith("*") && declares(rule.body, "font-family")
    );
    expect(universal.map((rule) => rule.selector)).toEqual([
      '*:where(:not(.gg-control[data-surface="editorial"]))',
    ]);
  });

  it("sets no type size or weight on headings or paragraphs", () => {
    const elementType = rules.filter(
      (rule) =>
        /(?:^|,\s*)(?:h[1-6]|p)(?=[\s,:]|$)/.test(rule.selector) &&
        (declares(rule.body, "font-size") || declares(rule.body, "font-weight"))
    );
    expect(elementType.map((rule) => rule.selector)).toEqual([]);
  });

  it("gives every heading in client source its own size and weight", () => {
    const missing = sourceFiles(SOURCE_ROOT).flatMap((file) =>
      headingTags(readFileSync(file, "utf-8"))
        .filter(({ text }) => {
          if (TYPE_UTILITY.test(text)) return false;
          return !SIZE_CLASS.test(text) || !WEIGHT_CLASS.test(text);
        })
        .map(({ tag, line }) => `${relative(SOURCE_ROOT, file)}:${line} <${tag}>`)
    );
    expect(missing).toEqual([]);
  });
});
