export const APP_NAME = "Green Goods";
export const APP_DEFAULT_TITLE = "Green Goods";
export const APP_TITLE_TEMPLATE = "%s - Green Goods";
export const APP_DESCRIPTION =
  "Green Goods helps communities name their needs, make promises, document and review regenerative work, and turn the record into support.";
export const APP_URL = "https://greengoods.app";
export const APP_ICON = "https://greengoods.app/icon.png";

/**
 * The Green Goods Hub's canonical address, for links and metadata that name one Hub origin.
 * hub.greengoods.app serves the Hub beside admin.greengoods.app (PRD-1485); this stays on admin
 * until the new host is confirmed live, and then this line is the switch.
 */
export const HUB_URL = "https://admin.greengoods.app";
/** The production hosts that serve the Hub. A prefixed host (`beta.hub`) pairs with its root. */
export const HUB_HOSTS = ["admin.greengoods.app", "hub.greengoods.app"] as const;

export const ONBOARDED_STORAGE_KEY = "greengoods_user_onboarded";

/**
 * The shared support mailbox named in chat replies and linked from browser reporting pages.
 *
 * It is defined here, and the reporting module re-exports it, so this file imports nothing: every
 * light page reads the app's name from it, and an import here would ride along with each of them.
 */
export const REPORTING_SUPPORT_CONTACT = "contact@greengoods.app";

// PRD-917: re-enable only after an approved, verified governance rollout.
export const GOVERNANCE_ENABLED = false;

// G$ settlement: stewards can add G$ rewards and send payouts. Set false to block every
// settlement write and new G$ reward before signing, without touching the live contracts.
export const SETTLEMENT_ENABLED = true;

// Reopen new endowments after the vault rollout has been verified.
export const ENDOWMENT_DEPOSITS_ENABLED = false;
