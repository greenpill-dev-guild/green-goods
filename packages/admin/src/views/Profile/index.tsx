import { useEffect, useMemo } from "react";
import { useIntl } from "react-intl";
import { useSearchParams } from "react-router-dom";
import { AccountTabList, AccountTabPanels } from "@/components/Layout/AccountSurface";
import { PageHeader } from "@/components/Layout/PageHeader";
import {
  ACCOUNT_TAB_SEARCH_PARAM,
  parseAccountSheetTab,
  type AccountSheetTab,
} from "@/components/Layout/accountSheet.events";

export default function ProfileView() {
  const { formatMessage } = useIntl();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get(ACCOUNT_TAB_SEARCH_PARAM);
  const activeTab = parseAccountSheetTab(requestedTab);
  const isDesktop =
    typeof window !== "undefined" && window.matchMedia("(min-width: 600px)").matches;

  useEffect(() => {
    if (requestedTab === null || requestedTab === "profile" || requestedTab === "settings") {
      return;
    }

    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete(ACCOUNT_TAB_SEARCH_PARAM);
      return next;
    }, { replace: true });
  }, [requestedTab, setSearchParams]);

  const handleTabChange = (tab: AccountSheetTab) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (tab === "settings") {
          next.set(ACCOUNT_TAB_SEARCH_PARAM, "settings");
        } else {
          next.delete(ACCOUNT_TAB_SEARCH_PARAM);
        }
        return next;
      },
      { replace: true }
    );
  };

  const description = useMemo(
    () =>
      formatMessage({
        id: "cockpit.profile.description",
        defaultMessage: "Manage your canvas identity, appearance, and operator preferences.",
      }),
    [formatMessage]
  );

  if (isDesktop) {
    return null;
  }

  return (
    <div className="pb-6">
      <PageHeader
        title={formatMessage({ id: "cockpit.profile.title", defaultMessage: "Profile" })}
        description={description}
        variant="canvas"
        sticky
      >
        <AccountTabList activeTab={activeTab} onTabChange={handleTabChange} />
      </PageHeader>
      <AccountTabPanels activeTab={activeTab} className="px-4 py-4 sm:px-5" />
    </div>
  );
}
