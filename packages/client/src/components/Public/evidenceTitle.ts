import type { PublicImpactEvidenceRecord } from "@green-goods/shared/public-contracts/public-impact";
import { toWorkDisplayTitle } from "@green-goods/shared/utils/work/workTitles";
import type { IntlShape } from "react-intl";

/**
 * The title an evidence record shows (card tiles, source dialog). A work's stored title can end in
 * the timestamps older submissions appended, so work records read through the work display title,
 * untitled as a garden's field notes are when nothing real is left. Assessment and certificate
 * titles are their own and show as stored.
 */
export function evidenceRecordTitle(
  record: PublicImpactEvidenceRecord,
  formatMessage: IntlShape["formatMessage"]
): string {
  if (record.kind !== "work") return record.title;
  return toWorkDisplayTitle(
    record.title,
    formatMessage({ id: "public.gardenDetail.notes.untitled", defaultMessage: "Untitled entry" })
  );
}
