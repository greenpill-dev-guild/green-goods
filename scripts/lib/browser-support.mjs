/**
 * The oldest browsers the installed app, the public website and the steward
 * dashboard support: Chrome and Edge 111, Firefox 128, and Safari 16.4 on macOS
 * and iOS. Tailwind CSS v4 builds its CSS for the same line.
 *
 * The client and admin Vite configs pass this list as `build.target`; the CSS
 * target follows it, and so does the client's service worker build. Naming it
 * here keeps a toolchain upgrade from moving the line without a change in review.
 */
export const SUPPORTED_BROWSER_TARGETS = Object.freeze([
  "chrome111",
  "edge111",
  "firefox128",
  "safari16.4",
  "ios16.4",
]);
