/** A tab rail measures itself, so its tabs answer the width they actually have. */
export const TAB_RAIL = "@container";

/**
 * A tab's width and side padding, for both of the app's rails. Tabs share the rail evenly on a
 * 360px phone and wider, where a sheet's side hairlines leave its rail 358px (DL-165). Only a rail
 * under 352px, a 320px phone's, sizes its tabs to what they hold, so a long label keeps its line
 * beside a count as wide as 99+ (DL-158). Under 360px of rail the side padding tightens as the
 * glyphs give way.
 */
export const TAB_SIZING = "px-1.5 @max-[22.5rem]:px-1 @max-[22rem]:flex-auto";

/**
 * A tab's glyph, which gives way on a rail narrower than 360px, on every tab at once, so each
 * label and its count keep one line in every language (DL-158). Both of the app's rails use it:
 * `StandardTabs` and the sheet rail in `AppSheet`.
 */
export const TAB_ICON =
  "flex h-4 w-4 flex-shrink-0 items-center justify-center text-sm [&>i]:text-base [&>svg]:h-4 [&>svg]:w-4 @max-[22.5rem]:hidden";
