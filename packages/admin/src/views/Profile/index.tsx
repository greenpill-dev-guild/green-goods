import { useEffect, useMemo } from "react";
import { useIntl } from "react-intl";
import { useSearchParams } from "react-router-dom";
import { AccountTabList, AccountTabPanels } from "@/components/Layout/AccountSurface";
import { CanvasRouteFrame, CanvasRouteHeader } from "@/components/Layout/CanvasRouteFrame";
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

    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete(ACCOUNT_TAB_SEARCH_PARAM);
        return next;
      },
      { replace: true }
    );
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
    <CanvasRouteFrame>
      <CanvasRouteHeader
        title={formatMessage({ id: "cockpit.nav.account", defaultMessage: "Account" })}
        description={description}
        variant="canvas"
        sticky
      >
        <AccountTabList activeTab={activeTab} onTabChange={handleTabChange} />
      </CanvasRouteHeader>
      <AccountTabPanels activeTab={activeTab} className="px-4 py-4 sm:px-5" />
    </CanvasRouteFrame>
  );
}
