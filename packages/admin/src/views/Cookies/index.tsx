import { AdminViewActions } from "@/components/AdminViewActions";
import { CanvasRouteFrame, CanvasRouteHeader } from "@/components/Layout/CanvasRouteFrame";
import {
  CampaignCookieJarCreateWorkspace,
  CampaignCookieJarPanel,
} from "./components/CampaignCookieJarPanel";
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
  const isDeployRoute = location.pathname.endsWith("/deploy");

  const viewActions = useMemo<ViewAction[]>(
    () =>
      isDeployRoute
        ? []
        : [
            {
              id: "create-cookie-jar",
              label: "Create cookie jar",
              labelId: "cockpit.community.cookies.create",
              icon: RiAddLine,
              onClick: () => navigate(adminRoutes.cookiesDeploy()),
              variant: "primary",
              primary: true,
            },
          ],
    [isDeployRoute, navigate]
  );
  const { desktopActions } = useViewActions({ actions: viewActions, isDesktop });

  if (isDeployRoute) {
    return (
      <CanvasRouteFrame
        data-component="CampaignCookieJarDeployWorkspace"
        data-region="workspace-cookies-deploy"
      >
        <CanvasRouteHeader
          title={formatMessage({
            id: "cockpit.community.cookies.dialogTitle",
            defaultMessage: "Create cookie jar",
          })}
          description={formatMessage({
            id: "cockpit.community.cookies.deployDescription",
            defaultMessage:
              "Configure the campaign, payout asset, eligible gardens, and review the jar before submitting.",
          })}
          backLink={{
            to: adminRoutes.cookies(),
            label: formatMessage({
              id: "cockpit.community.cookies.title",
              defaultMessage: "Campaign cookie jars",
            }),
          }}
          variant="canvas"
          sticky
        />
        <div className="mt-4">
          <CampaignCookieJarCreateWorkspace onCancel={() => navigate(adminRoutes.cookies())} />
        </div>
      </CanvasRouteFrame>
    );
  }

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
        <CampaignCookieJarPanel />
      </div>
    </CanvasRouteFrame>
  );
}
