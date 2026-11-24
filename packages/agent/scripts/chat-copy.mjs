// The agent's chat copy, as the copy checks read it: each block of source that holds words a
// person reads in a chat reply, the Telegram command menu, or the browser signing and review
// pages. The agent's copy tests (src/__tests__/i18n.test.ts and locale-terms.test.ts) hold these
// strings to scripts/data/banned-vocabulary.json, and scripts/design/check-em-dashes.mjs keeps em
// dashes out of them, so a new copy module is listed here once and every check reads it. Plain
// JavaScript, so the repository script can import it under Node; chat-copy.d.mts types it.
import fs from "node:fs";
import path from "node:path";

/**
 * Each block: a repo-relative file, the source text that opens the block, and the first source
 * text after it that closes the block. `least` is the fewest strings the block holds; reading
 * fewer means the markers or the reader no longer match the file.
 */
export const CHAT_COPY = [
  ...["en", "es", "pt"].map((locale) => ({
    file: "packages/agent/src/i18n.ts",
    locale,
    opening: locale === "en" ? "const enMessages = {" : `  ${locale}: {`,
    closing: locale === "en" ? "} as const" : "\n  },",
    least: 50,
  })),
  ...["en", "es", "pt"].map((locale) => ({
    file: `packages/agent/src/services/reporting/copy/${locale}.ts`,
    locale,
    opening: `export const ${locale.toUpperCase()}_REPORTING_COPY`,
    closing: locale === "en" ? "} as const" : "\n};",
    least: 50,
  })),
  // The Telegram command menu's descriptions, which reporting mode publishes to every chat. The
  // command names are the table's keys, so they are code, not copy.
  ...["en", "es", "pt"].map((locale) => ({
    file: "packages/agent/src/platforms/telegram-commands.ts",
    locale,
    opening: `  ${locale}: {`,
    closing: "  },",
    least: 15,
  })),
  // The labels the browser signing and review pages show, which views.ts builds.
  {
    file: "packages/agent/src/services/reporting/views.ts",
    locale: "en",
    opening: "const VIEW_COPY = {",
    closing: "} as const",
    least: 15,
  },
];

// Single-character escapes; \u, \x and line continuations are read separately.
const ESCAPES = { b: "\b", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v", 0: "\0" };

/** The text a literal renders: each escape sequence becomes the character it stands for. */
function unescape(raw) {
  return raw.replace(
    /\\(?:u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|(\r\n|[\s\S]))/g,
    (_, braced, unicode, hex, other) => {
      const code = braced ?? unicode ?? hex;
      if (code) return String.fromCodePoint(Number.parseInt(code, 16));
      // A backslash before a line break continues the literal on the next line.
      if (/^(?:\r\n|[\n\r])$/.test(other)) return "";
      return ESCAPES[other] ?? other;
    }
  );
}

/** A literal compared against, such as the "done" in `state === "done"`, is a wire value. */
function compared(code, { index, end }) {
  return (
    /[=!]==?\s*$/.test(code.slice(Math.max(0, index - 40), index)) ||
    /^\s*[=!]==?/.test(code.slice(end, end + 40))
  );
}

const COLON_AHEAD = /\s*:/y;

/** A literal that starts an object member and is followed by a colon is a key. */
function isKey(code, { index, end }) {
  COLON_AHEAD.lastIndex = end;
  if (!COLON_AHEAD.test(code)) return false;
  let before = index - 1;
  while (before >= 0 && /\s/.test(code[before])) before -= 1;
  return before < 0 || code[before] === "{" || code[before] === ",";
}

/**
 * Lexes source from `at`, in order: comments, and each string literal or template with its
 * offsets and the strings it holds. A template holds its text and, recursively, the literals
 * inside its interpolations that are not compared against, nested templates included. Called for
 * an interpolation, it stops at the brace that closes it.
 */
function lex(source, at = 0, closesOnBrace = false) {
  const literals = [];
  const comments = [];
  for (let depth = 0; at < source.length; ) {
    const character = source[at];
    if (source.startsWith("//", at) || source.startsWith("/*", at)) {
      const line = source[at + 1] === "/";
      const close = line ? source.indexOf("\n", at) : source.indexOf("*/", at + 2);
      const end = close === -1 ? source.length : line ? close : close + 2;
      comments.push([at, end]);
      at = end;
    } else if (character === '"' || character === "'") {
      let end = at + 1;
      while (end < source.length && source[end] !== character && source[end] !== "\n") {
        end += source[end] === "\\" ? 2 : 1;
      }
      const text = unescape(source.slice(at + 1, end));
      literals.push({ index: at, end: end + 1, strings: [{ text, index: at }] });
      at = end + 1;
    } else if (character === "`") {
      let text = "";
      const inner = [];
      let end = at + 1;
      while (end < source.length && source[end] !== "`") {
        if (source[end] === "\\") {
          text += source.slice(end, end + 2);
          end += 2;
        } else if (source.startsWith("${", end)) {
          const interpolation = lex(source, end + 2, true);
          for (const literal of interpolation.literals) {
            if (!compared(source, literal)) inner.push(...literal.strings);
          }
          text += " ";
          end = interpolation.end;
        } else {
          text += source[end];
          end += 1;
        }
      }
      const strings = [{ text: unescape(text), index: at }, ...inner];
      literals.push({ index: at, end: end + 1, strings });
      at = end + 1;
    } else {
      if (closesOnBrace && character === "}" && depth === 0) {
        return { literals, comments, end: at + 1 };
      }
      if (character === "{") depth += 1;
      if (character === "}") depth -= 1;
      at += 1;
    }
  }
  return { literals, comments, end: at };
}

/**
 * The copy in a block of TypeScript source, in source order: each string literal and each
 * template's text, escapes resolved, with the offset in the block where its literal starts.
 * Comments are skipped. A key and a literal compared against are names, not copy; every other
 * literal is copy, a ternary's first branch included.
 */
export function copyLiterals(block) {
  const { literals, comments } = lex(block);
  // With comments blanked, a key that follows one still starts its member.
  let code = block;
  for (const [from, to] of comments) {
    code = code.slice(0, from) + " ".repeat(to - from) + code.slice(to);
  }
  return literals
    .filter((literal) => !isKey(code, literal) && !compared(code, literal))
    .flatMap((literal) => literal.strings);
}

function lineAt(source, offset) {
  let line = 1;
  let at = source.indexOf("\n");
  while (at !== -1 && at < offset) {
    line += 1;
    at = source.indexOf("\n", at + 1);
  }
  return line;
}

/**
 * Every chat copy block under `root`, each with its strings and the line where each one's
 * literal starts. Throws when a block's markers no longer match its file or it reads fewer
 * strings than `least`, so a renamed table fails the checks instead of leaving them nothing.
 */
export function readChatCopy(root) {
  const sources = new Map();
  return CHAT_COPY.map((block) => {
    const { file, locale, opening, closing, least } = block;
    if (!sources.has(file)) sources.set(file, fs.readFileSync(path.join(root, file), "utf8"));
    const source = sources.get(file);
    const fix = "update CHAT_COPY in packages/agent/scripts/chat-copy.mjs";
    const start = source.indexOf(opening);
    if (start === -1) {
      throw new Error(`${file} no longer contains ${JSON.stringify(opening)}; ${fix}`);
    }
    const end = source.indexOf(closing, start + opening.length);
    if (end === -1) {
      const marker = JSON.stringify(closing);
      throw new Error(`${file}: the ${locale} block no longer ends at ${marker}; ${fix}`);
    }
    const strings = copyLiterals(source.slice(start, end)).map(({ text, index }) => ({
      text,
      line: lineAt(source, start + index),
    }));
    if (strings.length < least) {
      throw new Error(
        `${file}: the ${locale} block has ${strings.length} strings, fewer than ${least}; ${fix}`
      );
    }
    return { ...block, strings };
  });
}
