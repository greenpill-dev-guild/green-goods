import {
  CREATE_ASSESSMENT_ROUTE_ITEM,
  CREATE_HYPERCERT_ROUTE_ITEM,
  SUBMIT_WORK_ROUTE_ITEM,
} from "@green-goods/shared/utils/navigation/admin-routes";
import { type ComponentType, lazy, Suspense } from "react";
import { useIntl } from "react-intl";

// Each flow keeps its own chunk, so the Hub opens without them.
const SubmitWork = lazy(() => import("@/views/Garden/SubmitWork"));
const CreateAssessment = lazy(() => import("../CreateAssessment"));
const CreateHypercert = lazy(() => import("../CreateHypercert"));

function flowForItem(item: string | undefined): ComponentType | null {
  if (item === SUBMIT_WORK_ROUTE_ITEM) return SubmitWork;
  if (item === CREATE_ASSESSMENT_ROUTE_ITEM) return CreateAssessment;
  if (item === CREATE_HYPERCERT_ROUTE_ITEM) return CreateHypercert;
  return null;
}

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
 * The Hub's create flows, opened from their route items over whichever stage the
 * URL is on (DL-140). A flow mounts only while its item is in the URL, so its
 * close guard is the newest on the page and it starts clean each time.
 */
export function HubFlowDialogs({ item }: { item: string | undefined }) {
  const Flow = flowForItem(item);
  if (!Flow) return null;
  return (
    <Suspense fallback={<FlowLoading />}>
      <Flow />
    </Suspense>
  );
}
