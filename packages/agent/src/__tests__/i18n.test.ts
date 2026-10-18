import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  agentMessage,
  agentRateLimitMessage,
  formatAgentWaitTime,
  normalizeAgentLocale,
} from "../i18n";

describe("agent i18n", () => {
  it("normalizes regional Spanish and Portuguese locales", () => {
    expect(normalizeAgentLocale("es-MX")).toBe("es");
    expect(normalizeAgentLocale("pt-BR")).toBe("pt");
    expect(normalizeAgentLocale("fr-FR")).toBe("en");
  });

  it("keeps default English copy stable", () => {
    expect(agentMessage(undefined, "common.startFirst")).toBe(
      "Please run /start first to create your wallet."
    );
  });

  it("returns localized handler and rate-limit copy", () => {
    expect(agentMessage("es", "common.startFirst")).toContain("Ejecuta /start");
    expect(agentMessage("pt-BR", "common.startFirst")).toContain("Execute /start");
    expect(agentRateLimitMessage("es", "wallet")).toContain("billetera");
    expect(agentRateLimitMessage("pt", "wallet")).toContain("carteira");
  });

  it("formats localized wait times", () => {
    expect(formatAgentWaitTime("es", 1000)).toBe("1 segundo");
    expect(formatAgentWaitTime("pt", 120000)).toBe("2 minutos");
  });

  it("writes the English chat copy in US spelling", () => {
    // The UK forms come from the vocabulary sidecar that also guards the app catalog and the docs.
    const { us_spelling: usSpelling } = JSON.parse(
      readFileSync(
        new URL("../../../../scripts/data/banned-vocabulary.json", import.meta.url),
        "utf8"
      )
    ) as { us_spelling: { terms: Record<string, string>; exempt_phrases?: string[] } };
    const ukForm = new RegExp(`\\b(${Object.keys(usSpelling.terms).join("|")})\\b`, "gi");
    // A small lexer for the catalogs, in source order. Comments are skipped and each string literal
    // keeps its position. A template yields its text and, recursively, the literals inside its
    // interpolations, nested templates included. A literal that starts an object member and is
    // followed by a colon is a key such as "submit.cancelled", and one that is compared against is a
    // wire value; every other one is copy, a ternary's first branch included.
    type Literal = { index: number; end: number; values: string[] };
    type Lexed = { literals: Literal[]; comments: Array<[number, number]>; end: number };
    const compared = (code: string, { index, end }: Literal) =>
      /[=!]==?\s*$/.test(code.slice(Math.max(0, index - 40), index)) ||
      /^\s*[=!]==?/.test(code.slice(end, end + 40));
    const lex = (source: string, at = 0, closesOnBrace = false): Lexed => {
      const literals: Literal[] = [];
      const comments: Array<[number, number]> = [];
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
          literals.push({ index: at, end: end + 1, values: [source.slice(at + 1, end)] });
          at = end + 1;
        } else if (character === "`") {
          let text = "";
          const inner: string[] = [];
          let end = at + 1;
          while (end < source.length && source[end] !== "`") {
            if (source[end] === "\\") {
              text += source.slice(end, end + 2);
              end += 2;
            } else if (source.startsWith("${", end)) {
              const interpolation = lex(source, end + 2, true);
              for (const literal of interpolation.literals) {
                if (!compared(source, literal)) inner.push(...literal.values);
              }
              text += " ";
              end = interpolation.end;
            } else {
              text += source[end];
              end += 1;
            }
          }
          literals.push({ index: at, end: end + 1, values: [text, ...inner] });
          at = end + 1;
        } else {
          if (closesOnBrace && character === "}" && depth === 0)
            return { literals, comments, end: at + 1 };
          if (character === "{") depth += 1;
          if (character === "}") depth -= 1;
          at += 1;
        }
      }
      return { literals, comments, end: at };
    };
    const valuesOf = (source: string, opening: string, closing = "} as const") => {
      const start = source.indexOf(opening);
      expect(start, `the catalog no longer declares ${opening}`).toBeGreaterThanOrEqual(0);
      const end = source.indexOf(closing, start);
      expect(end, `${opening} no longer ends with ${closing}`).toBeGreaterThan(start);
      const block = source.slice(start, end);
      const { literals, comments } = lex(block);
      // With comments blanked, a key that follows one still starts its member.
      let code = block;
      for (const [from, to] of comments)
        code = code.slice(0, from) + " ".repeat(to - from) + code.slice(to);
      return literals
        .filter((literal) => {
          const key =
            /^\s*:/.test(code.slice(literal.end)) &&
            /(?:^|[{,])$/.test(code.slice(0, literal.index).trimEnd());
          return !key && !compared(code, literal);
        })
        .flatMap((literal) => literal.values);
    };
    const sample = [
      "const sample = {",
      `  // don't read "this comment"`,
      '  "review.cancelled": `Review cancelled for ${name}`,',
      "  joined: \"one \" + 'two',",
      '  plural: (n: number) => (n === 1 ? "item" : "items"),',
      '  status: `Review ${state === "done" ? "finished" : "open"}`,',
      '  nested: `Review ${done ? `Finished for ${name}` : "Open"}`,',
      "} as const;",
    ].join("\n");
    expect(valuesOf(sample, "const sample = {").map((value) => value.trim())).toEqual([
      "Review cancelled for",
      "one",
      "two",
      "item",
      "items",
      "Review",
      "finished",
      "open",
      "Review",
      "Finished for",
      "Open",
    ]);
    // Placeholders, inline code and URLs are names, not copy.
    const proseOf = (value: string) => {
      let prose = value.replace(/\{\w+\}|`[^`]*`|https?:\/\/\S+/g, " ");
      for (const phrase of usSpelling.exempt_phrases ?? []) prose = prose.split(phrase).join(" ");
      return prose;
    };
    expect(proseOf("Open https://grey.example/help, `grey` or {grey}").match(ukForm)).toBeNull();
    const catalogs = [
      { file: "../i18n.ts", opening: "const enMessages = {", least: 50 },
      {
        file: "../services/reporting/copy/en.ts",
        opening: "export const EN_REPORTING_COPY = {",
        least: 50,
      },
      // The Telegram command menu, which reporting mode publishes to every chat.
      { file: "../platforms/telegram-commands.ts", opening: "  en: [", closing: "  ],", least: 6 },
      // The labels the browser signing and review pages show, which views.ts builds.
      { file: "../services/reporting/views.ts", opening: "const VIEW_COPY = {", least: 15 },
    ];

    const hits = catalogs.flatMap(({ file, opening, closing, least }) => {
      const values = valuesOf(
        readFileSync(new URL(file, import.meta.url), "utf8"),
        opening,
        closing
      );
      expect(values.length, file).toBeGreaterThanOrEqual(least);
      return values.flatMap((value) =>
        [...proseOf(value).matchAll(ukForm)].map(
          ([word]) =>
            `${file}: "${word}" should be "${usSpelling.terms[word.toLowerCase()]}" in ${value}`
        )
      );
    });

    expect(hits).toEqual([]);
  });
});
