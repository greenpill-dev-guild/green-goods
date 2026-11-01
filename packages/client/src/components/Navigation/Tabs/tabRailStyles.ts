/** A tab rail measures itself, so its tabs answer the width they actually have. */
export const TAB_RAIL = "@container";

/**
 * A tab's glyph, which gives way on a rail narrower than 360px, on every tab at once, so each
 * label and its count keep one line in every language (DL-158). Both of the app's rails use it:
 * `StandardTabs` and the sheet rail in `AppSheet`.
 */
export const TAB_ICON =
  "flex h-4 w-4 flex-shrink-0 items-center justify-center text-sm [&>i]:text-base [&>svg]:h-4 [&>svg]:w-4 @max-[22.5rem]:hidden";
