import { toWorkDisplayTitle } from "@green-goods/shared/utils/work/workTitles";
import type { IntlShape } from "react-intl";
import { localizeCanonicalActionTitle } from "@/components/Action/actionDisplay";

/**
 * A work's title in the Hub queue, on the card and the phone's work row alike: its own
 * title, or its action's when its own is generated or missing, then "Untitled Work", in
 * the reader's language. Action titles can carry generated stamps too, so both pass
 * through the display title.
 */
export function hubWorkTitle(
  workTitle: string,
  actionTitle: string | undefined,
  formatMessage: IntlShape["formatMessage"]
): string {
  const actionDisplayTitle = toWorkDisplayTitle(actionTitle, "");
  return localizeCanonicalActionTitle(
    toWorkDisplayTitle(
      workTitle,
      actionDisplayTitle ||
        formatMessage({ id: "app.admin.work.untitledWork", defaultMessage: "Untitled Work" })
    ),
    formatMessage
  );
}
