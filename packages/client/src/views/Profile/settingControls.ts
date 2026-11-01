/**
 * One width for every control in the settings column. 120px fits the busiest
 * button label with its spinner; the subtitle beside it gives up every pixel
 * this grows by.
 */
export const SETTING_CONTROL_WIDTH = "w-[120px] sm:w-[140px]";

/**
 * An act in the Account tab's right slot (DL-152), for words the settings' controls never
 * have to fit: at least the settings column's width, so the sections' acts line up, and on a
 * phone at most a little more, which still leaves a usual name its one line. A longer label
 * wraps there, as a name in a label may, rather than pushing the row's own words aside.
 */
export const SETTING_ACT_WIDTH =
  "min-w-[120px] max-w-[140px] whitespace-normal [overflow-wrap:anywhere] sm:min-w-[140px] sm:max-w-none";
