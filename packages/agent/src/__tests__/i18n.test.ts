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
    // Comments and the three kinds of string literal, in source order. A comment is skipped, a
    // literal that starts an object member and is followed by a colon is a key such as
    // "submit.cancelled", and every other one is copy, a ternary's first branch included.
    const token =
      /\/\/[^\n]*|\/\*[\s\S]*?\*\/|"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g;
    // A template's text is copy, and so is each string literal inside its interpolations, such as
    // either branch of `${done ? "Done" : "Open"}`; one that is compared against is a wire value.
    const quoted = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/y;
    const templateValues = (body: string): string[] => {
      let text = "";
      const inner: string[] = [];
      let at = 0;
      for (let open = body.indexOf("${"); open !== -1; open = body.indexOf("${", at)) {
        text += `${body.slice(at, open)} `;
        let close = open + 2;
        for (let depth = 1; close < body.length && depth > 0; ) {
          quoted.lastIndex = close;
          const literal = quoted.exec(body);
          if (literal) {
            close += literal[0].length;
            continue;
          }
          if (body[close] === "{") depth += 1;
          if (body[close] === "}") depth -= 1;
          close += 1;
        }
        const expression = body.slice(open + 2, close - 1);
        for (const { 0: literal, index = 0 } of expression.matchAll(
          new RegExp(quoted.source, "g")
        )) {
          const compared =
            /[=!]==?\s*$/.test(expression.slice(0, index)) ||
            /^\s*[=!]==?/.test(expression.slice(index + literal.length));
          if (!compared) inner.push(literal.slice(1, -1));
        }
        at = close;
      }
      return [text + body.slice(at), ...inner];
    };
    const valuesOf = (source: string, opening: string, closing = "} as const") => {
      const start = source.indexOf(opening);
      expect(start, `the catalog no longer declares ${opening}`).toBeGreaterThanOrEqual(0);
      const end = source.indexOf(closing, start);
      expect(end, `${opening} no longer ends with ${closing}`).toBeGreaterThan(start);
      const block = source.slice(start, end);
      const lexemes = [...block.matchAll(token)];
      // With comments blanked, a key that follows one still starts its member.
      let code = block;
      for (const { 0: lexeme, index = 0 } of lexemes.filter(([lexeme]) => lexeme.startsWith("/"))) {
        code = code.slice(0, index) + " ".repeat(lexeme.length) + code.slice(index + lexeme.length);
      }
      return lexemes
        .filter(([lexeme]) => !lexeme.startsWith("/"))
        .filter(({ 0: lexeme, index = 0 }) => {
          const followedByColon = /^\s*:/.test(code.slice(index + lexeme.length));
          const startsMember = /(?:^|[{,])$/.test(code.slice(0, index).trimEnd());
          return !(followedByColon && startsMember);
        })
        .flatMap(([, double, single, template]) =>
          template === undefined ? [double ?? single ?? ""] : templateValues(template)
        );
    };
    const sample = [
      "const sample = {",
      `  // don't read "this comment"`,
      '  "review.cancelled": `Review cancelled for ${name}`,',
      "  joined: \"one \" + 'two',",
      '  plural: (n: number) => (n === 1 ? "item" : "items"),',
      '  status: `Review ${state === "done" ? "finished" : "open"}`,',
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
