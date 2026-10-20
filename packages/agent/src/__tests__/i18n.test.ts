import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { copyLiterals, readChatCopy } from "../../scripts/chat-copy.mjs";
import {
  agentMessage,
  agentRateLimitMessage,
  formatAgentWaitTime,
  normalizeAgentLocale,
} from "../i18n";

// The word lists come from the vocabulary sidecar that also guards the app catalogs and the docs,
// and the chat copy is read in the same blocks the em dash check reads.
const vocabulary = JSON.parse(
  readFileSync(new URL("../../../../scripts/data/banned-vocabulary.json", import.meta.url), "utf8")
) as {
  linter_enforced: { terms: string[] };
  renamed_terms: { terms: string[] };
  us_spelling: { terms: Record<string, string>; exempt_phrases?: string[] };
};
const chatCopy = readChatCopy(fileURLToPath(new URL("../../../../", import.meta.url)));

/** Placeholders, inline code and URLs are names, not copy. */
function withoutNames(value: string): string {
  return value.replace(/\{\w+\}|`[^`]*`|https?:\/\/\S+/g, " ");
}

function wordPattern(words: string[]): RegExp {
  const escaped = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");
}

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

  it("reads the copy in a block of source, not its keys, comments or compared values", () => {
    const sample = [
      "const sample = {",
      `  // don't read "this comment"`,
      '  "review.cancelled": `Review cancelled for ${name}`,',
      "  joined: \"one \" + 'two',",
      '  plural: (n: number) => (n === 1 ? "item" : "items"),',
      '  status: `Review ${state === "done" ? "finished" : "open"}`,',
      '  nested: `Review ${done ? `Finished for ${name}` : "Open"}`,',
      // An escape renders as its character, so a line break still ends the word before it.
      `  escaped: "Line one\\nColour \\"two\\"\\x21 ${"\\"}u{2014}",`,
      "} as const;",
    ].join("\n");
    expect(copyLiterals(sample).map(({ text }) => text.trim())).toEqual([
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
      'Line one\nColour "two"! —',
    ]);
  });

  it("writes the English chat copy in US spelling", () => {
    const { terms, exempt_phrases: exemptPhrases = [] } = vocabulary.us_spelling;
    const ukForm = wordPattern(Object.keys(terms));
    const proseOf = (value: string) => {
      let prose = withoutNames(value);
      for (const phrase of exemptPhrases) prose = prose.split(phrase).join(" ");
      return prose;
    };
    expect(proseOf("Open https://grey.example/help, `grey` or {grey}").match(ukForm)).toBeNull();

    const hits = chatCopy
      .filter(({ locale }) => locale === "en")
      .flatMap(({ file, strings }) =>
        strings.flatMap(({ text, line }) =>
          [...proseOf(text).matchAll(ukForm)].map(
            ([word]) => `${file}:${line}: "${word}" should be "${terms[word.toLowerCase()]}"`
          )
        )
      );
    expect(hits).toEqual([]);
  });

  it("keeps banned and retired words out of the chat copy in every language", () => {
    // The app catalogs' lists: growth-hacking words, and Operator, the steward's old name.
    const banned = wordPattern([
      ...vocabulary.linter_enforced.terms,
      ...vocabulary.renamed_terms.terms,
    ]);
    expect(
      withoutNames("Keep your streak for a limited time, says the Operador. {operator}").match(
        banned
      )
    ).toEqual(["streak", "limited time", "Operador"]);

    const hits = chatCopy.flatMap(({ file, locale, strings }) =>
      strings.flatMap(({ text, line }) =>
        [...withoutNames(text).matchAll(banned)].map(
          ([word]) => `${file}:${line} (${locale}): "${word}" in ${text}`
        )
      )
    );
    expect(hits).toEqual([]);
  });
});
