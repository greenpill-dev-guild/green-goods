import { Button } from "@green-goods/shared/components/Button";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { useBrowserNavigation } from "@green-goods/shared/hooks/app/useBrowserNavigation";
import { useScrollToTop } from "@green-goods/shared/hooks/app/useScrollToTop";
import { useGardens } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { RiErrorWarningLine, RiLoader4Line, RiMapPin2Fill } from "@remixicon/react";
import type React from "react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { Outlet, useLocation, useNavigate, useNavigationType, useParams } from "react-router-dom";
import { AppErrorBoundary } from "@/components/Errors/AppErrorBoundary";
import { TopNav } from "@/components/Navigation";
import { APP_ROUTES } from "@/config/pwaRouting";
import { GardenPage } from "./GardenPage";

/** Where a visit returns to: the list it came from (Explore), else Home. */
export interface GardenVisitState {
  returnTo?: string;
}

const RETURN_ROUTES: ReadonlySet<string> = new Set([APP_ROUTES.home, APP_ROUTES.explore]);

/**
 * What this visit remembers from the entry that opened it: which garden, where Back returns
 * to, the entry's key, and whether the entry before it is where the visit came from (it was
 * pushed, so Back can step back to it).
 */
interface Visit {
  gardenId: string | undefined;
  returnTo: string;
  key: string;
  cameFromPrevious: boolean;
}

export const Garden: React.FC = () => {
  const intl = useIntl();

  // Ensure proper re-rendering on browser navigation
  useBrowserNavigation();

  // Reset scroll position before paint — prevents flash from stale scroll state
  useScrollToTop();

  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const { id: gardenIdParam } = useParams<{ id: string }>();
  const { pathname, state, key } = useLocation();

  // A visit from Explore goes back there; any other visit, a link included, goes Home. The
  // target is kept from the entry that opened the garden: its child pages (a work, a promise)
  // push `/home/:id` again on their own Back, without Explore's state, and a garden that stays
  // mounted while its id changes is a new visit.
  const capture = (): Visit => {
    const returnTo = (state as GardenVisitState | null)?.returnTo;
    return {
      gardenId: gardenIdParam,
      returnTo: returnTo && RETURN_ROUTES.has(returnTo) ? returnTo : APP_ROUTES.home,
      key,
      cameFromPrevious: navigationType === "PUSH",
    };
  };
  const [visit, setVisit] = useState(capture);
  if (visit.gardenId !== gardenIdParam) setVisit(capture());

  // Back steps back to where the visit came from when that is the entry before this one, and
  // otherwise replaces this entry with it, so pressing Back never grows the history.
  const back = () => {
    if (visit.key === key && visit.cameFromPrevious) {
      void navigate(-1);
      return;
    }
    void navigate(visit.returnTo, { replace: true, viewTransition: true });
  };
  const {
    data: allGardens = [],
    isLoading: gardensInitialLoading,
    isError: gardensError,
    refetch: refetchGardens,
  } = useGardens(DEFAULT_CHAIN_ID);
  // Addresses arrive in either case: the list is checksummed, the indexer's
  // pool and work rows are lowercase, and a link may be typed. One garden.
  const garden = allGardens.find((g) => g.id.toLowerCase() === gardenIdParam?.toLowerCase());

  if (!garden) {
    // With no garden to draw, the page is the state block under the back bar.
    let pageState: React.ReactNode;
    if (gardensInitialLoading) {
      pageState = (
        <EmptyState
          busy
          icon={<RiLoader4Line className="animate-spin motion-reduce:animate-none" />}
          title={intl.formatMessage({
            id: "app.garden.loading",
            defaultMessage: "Loading garden...",
          })}
        />
      );
    } else if (gardensError) {
      pageState = (
        <EmptyState
          tone="error"
          icon={<RiErrorWarningLine />}
          title={intl.formatMessage({
            id: "app.garden.loadError.title",
            defaultMessage: "Couldn't load this garden",
          })}
          description={intl.formatMessage({
            id: "app.garden.loadError.description",
            defaultMessage: "Check your connection and try again.",
          })}
          action={
            <Button type="button" onClick={() => refetchGardens()}>
              {intl.formatMessage({
                id: "app.garden.loadRetry",
                defaultMessage: "Try Again",
              })}
            </Button>
          }
        />
      );
    } else {
      pageState = (
        <EmptyState
          icon={<RiMapPin2Fill />}
          title={intl.formatMessage({
            id: "app.garden.notFound",
            defaultMessage: "Garden not found",
          })}
        />
      );
    }
    return (
      <div className="h-full flex flex-col items-center justify-center p-6">
        <TopNav onBackClick={back} />
        {pageState}
      </div>
    );
  }

  const isChildPage =
    pathname.includes("work") ||
    pathname.includes("assessments") ||
    pathname.includes("commitments");

  return (
    // A garden's page hides the bottom bar, so a failure inside it is the screen state with Back.
    // It stays mounted across its child pages, so the path tells the boundary when to let go.
    <AppErrorBoundary view="screen" name="GardenErrorBoundary" resetKey={pathname}>
      {/* Keyed by the garden, so another garden's page starts afresh: its open tab included. */}
      <GardenPage key={garden.id} garden={garden} onBack={back} showHeader={!isChildPage}>
        <Outlet context={{ gardenId: garden.id }} />
      </GardenPage>
    </AppErrorBoundary>
  );
};
