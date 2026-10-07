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

/** Fills a localized template. Unknown placeholders stay visible so a missing value is noticed. */
export function reportingText(
  locale: string | null | undefined,
  key: ReportingCopyKey,
  values: CopyValues = {}
): string {
  const template = CATALOGS[normalizeAgentLocale(locale ?? undefined)][key];
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : match
  );
}
