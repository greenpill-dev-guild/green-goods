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
    // literal followed by a colon is a key such as "submit.cancelled", and every other one is copy.
    const token =
      /\/\/[^\n]*|\/\*[\s\S]*?\*\/|"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g;
    const valuesOf = (source: string, opening: string, closing = "} as const") => {
      const start = source.indexOf(opening);
      expect(start, `the catalog no longer declares ${opening}`).toBeGreaterThanOrEqual(0);
      const end = source.indexOf(closing, start);
      expect(end, `${opening} no longer ends with ${closing}`).toBeGreaterThan(start);
      const block = source.slice(start, end);
      return [...block.matchAll(token)]
        .filter(([lexeme]) => !lexeme.startsWith("/"))
        .filter((match) => !/^\s*:/.test(block.slice((match.index ?? 0) + match[0].length)))
        .map(([, double, single, template]) =>
          (double ?? single ?? template ?? "").replace(/\$\{[^}]*\}/g, " ")
        );
    };
    const sample = [
      "const sample = {",
      `  // don't read "this comment"`,
      '  "review.cancelled": `Review cancelled for ${name}`,',
      "  joined: \"one \" + 'two',",
      "} as const;",
    ].join("\n");
    expect(valuesOf(sample, "const sample = {").map((value) => value.trim())).toEqual([
      "Review cancelled for",
      "one",
      "two",
    ]);
    const catalogs = [
      { file: "../i18n.ts", opening: "const enMessages = {", least: 50 },
      {
        file: "../services/reporting/copy/en.ts",
        opening: "export const EN_REPORTING_COPY = {",
        least: 50,
      },
      // The Telegram command menu, which reporting mode publishes to every chat.
      { file: "../platforms/telegram-commands.ts", opening: "  en: [", closing: "  ],", least: 6 },
    ];

    const hits = catalogs.flatMap(({ file, opening, closing, least }) => {
      const values = valuesOf(
        readFileSync(new URL(file, import.meta.url), "utf8"),
        opening,
        closing
      );
      expect(values.length, file).toBeGreaterThanOrEqual(least);
      return values.flatMap((value) => {
        let prose = value.replace(/\{\w+\}|`[^`]*`/g, " ");
        for (const phrase of usSpelling.exempt_phrases ?? []) prose = prose.split(phrase).join(" ");
        return [...prose.matchAll(ukForm)].map(
          ([word]) =>
            `${file}: "${word}" should be "${usSpelling.terms[word.toLowerCase()]}" in ${value}`
        );
      });
    });

    expect(hits).toEqual([]);
  });
});
