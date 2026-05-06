import { AdminViewActions } from "@/components/AdminViewActions";
import { CanvasRouteFrame, CanvasRouteHeader } from "@/components/Layout/CanvasRouteFrame";
import { CampaignCookieJarPanel } from "./components/CampaignCookieJarPanel";
import { adminRoutes, useMediaQuery, useViewActions, type ViewAction } from "@green-goods/shared";
import { RiAddLine } from "@remixicon/react";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { useLocation, useNavigate } from "react-router-dom";

export default function CookiesView() {
  const { formatMessage } = useIntl();
  const location = useLocation();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const shouldOpenCreateDialog = location.pathname.endsWith("/deploy");

  const viewActions = useMemo<ViewAction[]>(
    () => [
      {
        id: "deploy-cookie-jar",
        label: "Deploy cookie jar",
        labelId: "cockpit.cookies.action.deploy",
        icon: RiAddLine,
        onClick: () => navigate(adminRoutes.cookiesDeploy()),
        variant: "primary",
        primary: true,
      },
    ],
    [navigate]
  );
  const { desktopActions } = useViewActions({ actions: viewActions, isDesktop });

  return (
    <CanvasRouteFrame data-component="CampaignCookieJarsWorkspace" data-region="workspace-cookies">
      <CanvasRouteHeader
        title={formatMessage({
          id: "cockpit.community.cookies.title",
          defaultMessage: "Campaign cookie jars",
        })}
        description={formatMessage({
          id: "cockpit.community.cookies.description",
          defaultMessage:
            "Create one shared Cookie Jar for a campaign and allow selected garden operators to claim from it.",
        })}
        actions={
          isDesktop && desktopActions.length > 0 ? (
            <AdminViewActions items={desktopActions} />
          ) : undefined
        }
        variant="canvas"
        sticky
      />
      <div className="mt-4">
        <CampaignCookieJarPanel initialCreateOpen={shouldOpenCreateDialog} />
      </div>
    </CanvasRouteFrame>
  );
}
