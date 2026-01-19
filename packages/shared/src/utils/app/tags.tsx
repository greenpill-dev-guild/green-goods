import type { IntlShape } from "react-intl";

/** Resolves a localized tag label with sensible fallbacks when translations are missing. */
export function getTag(intl: IntlShape, tag: string): string {
  const tagName = tag.replace(" ", "_");
  return intl.formatMessage({
    id: `app.garden.tags.${tagName}`,
    description: `Tag ${tagName}`,
    defaultMessage: tag,
  });
}
