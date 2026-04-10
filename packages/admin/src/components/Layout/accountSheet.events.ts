export type AccountSheetTab = "profile" | "settings";

export const ACCOUNT_SHEET_CONTENT_ID = "account";
export const ACCOUNT_TAB_SEARCH_PARAM = "tab";
export const OPEN_ACCOUNT_SHEET_EVENT = "open-account-sheet";

export interface OpenAccountSheetEventDetail {
  tab: AccountSheetTab;
}

export function dispatchOpenAccountSheet(tab: AccountSheetTab) {
  window.dispatchEvent(
    new CustomEvent<OpenAccountSheetEventDetail>(OPEN_ACCOUNT_SHEET_EVENT, {
      detail: { tab },
    })
  );
}

export function parseAccountSheetTab(value: string | null | undefined): AccountSheetTab {
  return value === "settings" ? "settings" : "profile";
}
