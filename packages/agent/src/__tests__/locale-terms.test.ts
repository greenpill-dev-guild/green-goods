import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type AgentLocale, type AgentMessageKey, agentMessage } from "../i18n";
import { ES_REPORTING_COPY } from "../services/reporting/copy/es";
import { PT_REPORTING_COPY } from "../services/reporting/copy/pt";
import { parseCommand } from "../services/reporting/coordinator/commands";

type Locale = Exclude<AgentLocale, "en">;

// The chat copy bans the same words as the app catalogs: scripts/design/check-vocab.sh reads this
// file for packages/shared, and this test reads it for the bot (es responsable and jardín, pt
// responsável and jardim).
const vocabulary = JSON.parse(
  readFileSync(new URL("../../../../scripts/data/banned-vocabulary.json", import.meta.url), "utf8")
) as { renamed_terms: { locale_terms: Record<string, string[]> } };

// The older bot keeps its message tables private, so its keys come from the English table.
const i18nSource = readFileSync(new URL("../i18n.ts", import.meta.url), "utf8");
const englishTable = i18nSource.slice(
  i18nSource.indexOf("const enMessages = {"),
  i18nSource.indexOf("} as const;")
);
const botKeys = [...englishTable.matchAll(/^ {2}"([\w.]+)":/gm)].map(
  (match) => match[1] as AgentMessageKey
);

const reportingCopy: Record<Locale, Record<string, string>> = {
  es: ES_REPORTING_COPY,
  pt: PT_REPORTING_COPY,
};

const drifted: Record<Locale, string[]> = {
  es: ["Únete al Huerto Comunitario o pide a un steward que te agregue.", "(STEWARDS) Aprobar"],
  pt: ["Entre em outra horta ou peça a um steward para adicionar você.", "Ver minhas HORTAS"],
};

// A typed command is its own English name (GARDEN reads as garden). HORTAS also reads as garden,
// but it is an alias, not the name, so a shouted drifted word is still checked.
function withoutTypedCommands(message: string): string {
  return message.replace(/\b[A-Z]{2,}\b/g, (word) =>
    parseCommand(word)?.kind === word.toLowerCase() ? " " : word
  );
}

/** Messages that use an off-glossary word. Placeholders and typed command words are code. */
function strays(locale: Locale, messages: string[]): string[] {
  const terms = vocabulary.renamed_terms.locale_terms[`packages/shared/src/i18n/${locale}.json`];
  const pattern = new RegExp(`\\b(${terms.join("|")})\\b`, "i");
  return messages.filter((message) =>
    pattern.test(withoutTypedCommands(message.replace(/\{\w+\}/g, " ")))
  );
}

describe.each(["es", "pt"] as const)("%s chat copy uses the locked terms", (locale) => {
  it("flags a drifted word, even shouted, but not a typed command word", () => {
    expect(strays(locale, [...drifted[locale], "Envía GARDEN"])).toEqual(drifted[locale]);
  });

  it("keeps the reporting copy on the locked terms", () => {
    expect(strays(locale, Object.values(reportingCopy[locale]))).toEqual([]);
  });

  it("keeps the older bot's messages on the locked terms", () => {
    expect(botKeys.length).toBeGreaterThan(50);
    expect(
      strays(
        locale,
        botKeys.map((key) => agentMessage(locale, key))
      )
    ).toEqual([]);
  });
});
