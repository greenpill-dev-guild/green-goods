import {
  buildReviewViewActions,
  resolvePipelineStageFromPath,
} from "@green-goods/shared/hooks/admin-ui/review/review.utils";
import { parseReviewFlowItem } from "@green-goods/shared/utils/navigation/admin-routes";
import { useLocation, useNavigate } from "react-router-dom";
import { AdminViewActions } from "@/components/AdminViewActions";
import { ReviewFlowDialogs } from "@/views/Review/components/ReviewFlowDialogs";

/** Review's header actions and its create flows on the real URL, without the rest of the view. */
export function ReviewFlowHarness() {
  const navigate = useNavigate();
  const location = useLocation();
  const search = new URLSearchParams(location.search);
  const actions = buildReviewViewActions(
    resolvePipelineStageFromPath(location.pathname),
    true,
    true,
    navigate,
    { gardenId: search.get("gardenId") ?? undefined }
  );
  return (
    <>
      <AdminViewActions items={actions} />
      <ReviewFlowDialogs item={parseReviewFlowItem(search.get("item"))} />
    </>
  );
}
