import { CanvasRouteFrame, CanvasRouteHeader } from "@/components/Layout/CanvasRouteFrame";
import { CampaignCookieJarPanel } from "./components/CampaignCookieJarPanel";
import { useIntl } from "react-intl";
import { useLocation } from "react-router-dom";

export default function CookiesView() {
  const { formatMessage } = useIntl();
  const location = useLocation();
  const shouldOpenCreateDialog = location.pathname.endsWith("/deploy");

  return (
    <CanvasRouteFrame data-component="CampaignCookieJarsWorkspace" data-region="workspace-cookies">
      <CanvasRouteHeader
        maxWidthClassName="max-w-[1400px]"
        title={formatMessage({
          id: "cockpit.community.cookies.title",
          defaultMessage: "Campaign cookie jars",
        })}
        description={formatMessage({
          id: "cockpit.community.cookies.description",
          defaultMessage:
            "Create one shared Cookie Jar for a campaign and allow selected garden operators to claim from it.",
        })}
        variant="canvas"
        sticky
      />
      <div className="mt-4 px-4 sm:px-6">
        <div className="mx-auto w-full max-w-[1400px]">
          <CampaignCookieJarPanel initialCreateOpen={shouldOpenCreateDialog} />
        </div>
      </div>
    </CanvasRouteFrame>
  );
}
