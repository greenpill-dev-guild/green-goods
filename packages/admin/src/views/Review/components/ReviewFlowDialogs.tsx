import {
  type AdminReviewFlowItem,
  CREATE_ASSESSMENT_ROUTE_ITEM,
  CREATE_HYPERCERT_ROUTE_ITEM,
  SUBMIT_WORK_ROUTE_ITEM,
} from "@green-goods/shared/utils/navigation/admin-routes";
import { type ComponentType, lazy, Suspense } from "react";
import { useIntl } from "react-intl";

// Each flow keeps its own chunk, so Review opens without them.
const SubmitWork = lazy(() => import("@/views/Garden/SubmitWork"));
const CreateAssessment = lazy(() => import("../CreateAssessment"));
const CreateHypercert = lazy(() => import("../CreateHypercert"));

const FLOWS: Record<AdminReviewFlowItem, ComponentType> = {
  [SUBMIT_WORK_ROUTE_ITEM]: SubmitWork,
  [CREATE_ASSESSMENT_ROUTE_ITEM]: CreateAssessment,
  [CREATE_HYPERCERT_ROUTE_ITEM]: CreateHypercert,
};

/** Holds the page while a flow's chunk loads, so no other action takes a press meanwhile. */
function FlowLoading() {
  const { formatMessage } = useIntl();
  return (
    <div role="status" className="fixed inset-0 z-overlay cursor-progress">
      <span className="sr-only">
        {formatMessage({ id: "app.common.loading", defaultMessage: "Loading..." })}
      </span>
    </div>
  );
}

/**
 * Review's create flows, opened from their route items over whichever stage the
 * URL is on (DL-140). A flow mounts only while its item is in the URL, so its
 * close guard is the newest on the page and it starts clean each time.
 */
export function ReviewFlowDialogs({ item }: { item: AdminReviewFlowItem | undefined }) {
  if (!item) return null;
  const Flow = FLOWS[item];
  return (
    <Suspense fallback={<FlowLoading />}>
      <Flow />
    </Suspense>
  );
}
