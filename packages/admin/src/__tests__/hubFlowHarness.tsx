import {
  buildHubViewActions,
  resolvePipelineStageFromPath,
} from "@green-goods/shared/hooks/admin-ui/hub/hub.utils";
import { useLocation, useNavigate } from "react-router-dom";
import { AdminViewActions } from "@/components/AdminViewActions";
import { HubFlowDialogs } from "@/views/Hub/components/HubFlowDialogs";

/** The Hub's header actions and its create flows on the real URL, without the rest of the view. */
export function HubFlowHarness() {
  const navigate = useNavigate();
  const location = useLocation();
  const search = new URLSearchParams(location.search);
  const actions = buildHubViewActions(
    resolvePipelineStageFromPath(location.pathname),
    true,
    true,
    navigate,
    { gardenId: search.get("gardenId") ?? undefined }
  );
  return (
    <>
      <AdminViewActions items={actions} />
      <HubFlowDialogs item={search.get("item") ?? undefined} />
    </>
  );
}
