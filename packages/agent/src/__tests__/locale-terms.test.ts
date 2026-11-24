import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readChatCopy } from "../../scripts/chat-copy.mjs";
import { parseCommand } from "../services/reporting/coordinator/commands";

type Locale = "es" | "pt";

// The chat copy bans the same words as the app catalogs: scripts/design/check-vocab.sh reads this
// file for packages/shared, and this test reads it for the bot (es responsable and jardín, pt
// responsável and jardim).
const vocabulary = JSON.parse(
  readFileSync(new URL("../../../../scripts/data/banned-vocabulary.json", import.meta.url), "utf8")
) as { renamed_terms: { locale_terms: Record<string, string[]> } };

// Every block the copy checks read: the older bot's messages, the reporting copy and the Telegram
// command menu.
const chatCopy = readChatCopy(fileURLToPath(new URL("../../../../", import.meta.url)));

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

  it("keeps every chat copy block on the locked terms", () => {
    const hits = chatCopy
      .filter((block) => block.locale === locale)
      .flatMap(({ file, strings }) =>
        strings
          .filter(({ text }) => strays(locale, [text]).length > 0)
          .map(({ text, line }) => `${file}:${line}: ${text}`)
      );
    expect(hits).toEqual([]);
  });
});
