export const APP_NAME = "Green Goods";
export const APP_DEFAULT_TITLE = "Green Goods";
export const APP_TITLE_TEMPLATE = "%s - Green Goods";
export const APP_DESCRIPTION = "Start Bringing Your Impact Onchain";
export const APP_URL = "https://greengoods.app";
export const APP_ICON = "https://greengoods.app/icon.png";

export const ONBOARDED_STORAGE_KEY = "greengoods_user_onboarded";

/**
 * Where people are sent for help with chat reporting: the Green Goods site, named in the chat's
 * replies and linked from the browser ceremony pages. A site, never a person's own address.
 *
 * It is defined here, and the reporting module re-exports it, so this file imports nothing: every
 * light page reads the app's name from it, and an import here would ride along with each of them.
 */
export const REPORTING_SUPPORT_CONTACT = "greengoods.app";

// PRD-917: re-enable only after an approved, verified governance rollout.
export const GOVERNANCE_ENABLED = false;
