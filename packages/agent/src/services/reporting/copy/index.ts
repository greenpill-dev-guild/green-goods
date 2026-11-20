import enCatalog from "@green-goods/shared/i18n/en.json";
import esCatalog from "@green-goods/shared/i18n/es.json";
import ptCatalog from "@green-goods/shared/i18n/pt.json";
import { SEND_STAGE_WORDS } from "@green-goods/shared/modules/transactions/send-stage";
import { type AgentLocale, normalizeAgentLocale } from "../../../i18n";
import { EN_REPORTING_COPY, type ReportingCopyKey } from "./en";
import { ES_REPORTING_COPY } from "./es";
import { PT_REPORTING_COPY } from "./pt";

export type { ReportingCopyKey } from "./en";

const CATALOGS: Record<AgentLocale, Record<ReportingCopyKey, string>> = {
  en: EN_REPORTING_COPY,
  es: ES_REPORTING_COPY,
  pt: PT_REPORTING_COPY,
};

export type CopyValues = Record<string, string | number>;

/**
 * The shared send stage words a template names, in each language: the bot says still confirming
 * (PRD-1552) and waiting for the Safe's signers (PRD-1568) in the words the App and the Hub use,
 * from the same Shared catalog entries.
 */
function stageWords(catalog: unknown): CopyValues {
  const say = (word: { id: string; defaultMessage: string }) =>
    (catalog as Record<string, string>)[word.id] ?? word.defaultMessage;
  return {
    stillConfirming: say(SEND_STAGE_WORDS["still-confirming"].detail),
    safeSigners: say(SEND_STAGE_WORDS["safe-signers"].label),
    safeSignersDetail: say(SEND_STAGE_WORDS["safe-signers"].detail),
  };
}
const STAGE_WORDS: Record<AgentLocale, CopyValues> = {
  en: stageWords(enCatalog),
  es: stageWords(esCatalog),
  pt: stageWords(ptCatalog),
};

/** Fills a localized template. Unknown placeholders stay visible so a missing value is noticed. */
export function reportingText(
  locale: string | null | undefined,
  key: ReportingCopyKey,
  values: CopyValues = {}
): string {
  const language = normalizeAgentLocale(locale ?? undefined);
  const filled = { ...STAGE_WORDS[language], ...values };
  return CATALOGS[language][key].replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(filled, name) ? String(filled[name]) : match
  );
}
