import { GardenChip } from "@green-goods/shared/components/Canvas/GardenChip";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { getDefaultChain } from "@green-goods/shared/config/blockchain";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { useArrivalState } from "@green-goods/shared/hooks/app/useArrivalState";
import { useBrowserNavigation } from "@green-goods/shared/hooks/app/useBrowserNavigation";
import { useAuthState } from "@green-goods/shared/hooks/auth/useAuth";
import { usePrimaryAddress } from "@green-goods/shared/hooks/auth/usePrimaryAddress";
import { useGardens } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { useDashboardNavigation } from "@green-goods/shared/hooks/client-ui/useDashboardNavigation";
import { useActiveGarden } from "@green-goods/shared/hooks/garden/useActiveGarden";
import { useAwaitingJoinRequests } from "@green-goods/shared/hooks/garden/useGardenJoinRequests";
import { useExitPresence } from "@green-goods/shared/hooks/utils/useExitPresence";
import { useTimeout } from "@green-goods/shared/hooks/utils/useTimeout";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";
import { compareAddresses } from "@green-goods/shared/utils/blockchain/address";
import {
  type ComponentType,
  lazy,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useIntl } from "react-intl";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { getPwaSheetExitMs } from "@/components/Pwa/sheetStyles";
import { APP_ROUTES } from "@/config/pwaRouting";
import {
  type ArrivalActionKind,
  arrivalToastSpec,
  hasArrivalPassed,
  markArrivalPassed,
} from "./arrivalToast";
import { CommitmentsSheetIcon } from "./CommitmentsSheet/Icon";
import { chooserScope, hasOfferedChooser, markChooserOffered } from "./chooserOffer";
import type { GardenVisitState } from "./Garden";
import { GardenSwitcherSheet } from "./GardenSwitcher";
import { HomeHeader } from "./HomeHeader";
import { HomeChoosePrompt, HomeError, HomeFindGarden, HomeLoading } from "./HomeStates";
import { awaitingGardens, switcherRows } from "./homeGardens";
import { HomeJournal } from "./Journal";
import { WalletSheetIcon } from "./WalletSheet/Icon";
import { WorkDashboardIcon } from "./WorkDashboard/Icon";

const CommitmentsSheet = lazy(() =>
  import("./CommitmentsSheet").then(({ CommitmentsSheet }) => ({ default: CommitmentsSheet }))
);
const CommitmentsSheetLauncher = lazy(
  (): Promise<{ default: ComponentType<{ onClick: () => void }> }> =>
    import("./CommitmentsSheet/Launcher")
      .then(({ CommitmentsSheetLauncher }) => ({
        default: CommitmentsSheetLauncher,
      }))
      // Ambient adjunct: if the launcher chunk cannot load (offline dev serving),
      // hide it rather than failing the whole Home route.
      .catch(() => ({ default: () => null }))
);
const WalletSheet = lazy(() =>
  import("./WalletSheet").then(({ WalletSheet }) => ({ default: WalletSheet }))
);

function DeferredCommitmentsSheetLauncher({ onClick }: { onClick: () => void }) {
  const [loadCounts, setLoadCounts] = useState(false);

  useEffect(() => {
    const idleCallback =
      window.requestIdleCallback ??
      ((callback: IdleRequestCallback) => window.setTimeout(callback, 1_000));
    const handle = idleCallback(() => setLoadCounts(true));
    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, []);

  if (!loadCounts) return <CommitmentsSheetIcon onClick={onClick} actCount={0} />;
  return (
    <Suspense fallback={<CommitmentsSheetIcon onClick={onClick} actCount={0} />}>
      <CommitmentsSheetLauncher onClick={onClick} />
    </Suspense>
  );
}

type SwitcherMode = "switch" | "choose";

/**
 * Home in the member's active garden (DL-123 to DL-125). The header carries the garden chip and
 * the launchers; the body follows `useActiveGarden`: a remembered garden goes straight in while
 * the account's gardens load, a failed read keeps the state block, no garden finds one,
 * several with none remembered offer the chooser once, and a chosen garden opens its journal.
 * Only a pick in the switcher changes the active garden: Explore, a row or a link visits.
 */
const Home: React.FC = () => {
  const routerNavigate = useNavigate();
  const navigate = useCallback(
    (path: string, state?: GardenVisitState) =>
      routerNavigate(path, { viewTransition: true, state }),
    [routerNavigate]
  );
  const location = useLocation();
  const intl = useIntl();
  const isHomeRoute = location.pathname.replace(/\/$/, "") === APP_ROUTES.home;

  const { status, gardenId, garden, myGardens, selectGarden } = useActiveGarden();
  const primaryAddress = usePrimaryAddress();
  const normalizedAddress = primaryAddress?.toLowerCase() ?? null;

  // The gardens the app lists: where a request waits, and the Community Garden's door.
  const { data: listed = [] } = useGardens();
  const listedIds = useMemo(() => listed.map(({ id }) => id), [listed]);
  const awaitingIds = useAwaitingJoinRequests(listedIds);
  const { rows, awaiting, communityGarden, activeMembership } = useMemo(() => {
    const myGardenIds = new Set(myGardens.gardens.map(({ garden: g }) => g.id.toLowerCase()));
    const awaitingList = awaitingGardens(listed, awaitingIds, myGardenIds);
    const rootGarden = getDefaultChain().rootGarden?.address;
    const community = listed.find(
      (g) =>
        compareAddresses(g.id, rootGarden) && g.openJoining && !myGardenIds.has(g.id.toLowerCase())
    );
    return {
      rows: switcherRows(myGardens.gardens, awaitingList, gardenId),
      awaiting: awaitingList,
      communityGarden: community ?? null,
      activeMembership:
        myGardens.gardens.find(({ garden: g }) => compareAddresses(g.id, gardenId))?.membership ??
        null,
    };
  }, [awaitingIds, gardenId, listed, myGardens.gardens]);

  // The arrival toast: uploads still on this phone, and where they are listed (PWA Home step 12).
  const arrival = useArrivalState();
  const dashboardNavigation = useDashboardNavigation();

  // UI state from store
  const openWorkDashboard = useUIStore((s) => s.openWorkDashboard);
  const isWalletSheetOpen = useUIStore((s) => s.isWalletSheetOpen);
  const openWalletSheet = useUIStore((s) => s.openWalletSheet);
  const closeWalletSheet = useUIStore((s) => s.closeWalletSheet);
  const isCommitmentsSheetOpen = useUIStore((s) => s.isCommitmentsSheetOpen);
  const openCommitmentsSheet = useUIStore((s) => s.openCommitmentsSheet);
  const closeCommitmentsSheet = useUIStore((s) => s.closeCommitmentsSheet);
  const closeGardenSheet = useUIStore((s) => s.closeGardenSheet);
  const gardenSwitcherRequested = useUIStore((s) => s.gardenSwitcherRequested);
  const clearGardenSwitcherRequest = useUIStore((s) => s.clearGardenSwitcherRequest);

  // The switcher keeps its mode while it slides out, so its title never flips mid-exit.
  const [switcher, setSwitcher] = useState<{ open: boolean; mode: SwitcherMode }>({
    open: false,
    mode: "switch",
  });
  const openSwitcher = useCallback(() => setSwitcher({ open: true, mode: "switch" }), []);
  const closeSwitcher = useCallback(() => setSwitcher((s) => ({ ...s, open: false })), []);

  // Each sheet stays mounted until its exit has played; unmounting it on close
  // removed it before the slide-out could run.
  const isSwitcherPresent = useExitPresence(switcher.open, getPwaSheetExitMs);
  const isWalletSheetPresent = useExitPresence(isWalletSheetOpen, getPwaSheetExitMs);
  const isCommitmentsSheetPresent = useExitPresence(isCommitmentsSheetOpen, getPwaSheetExitMs);

  // Ensure proper re-rendering on browser navigation
  useBrowserNavigation();

  // A toast asked for the switcher, about an upload waiting in another garden: it opens once
  // Home shows, never over a garden page Home holds open, and the member picks there.
  useEffect(() => {
    if (!gardenSwitcherRequested || !isHomeRoute) return;
    clearGardenSwitcherRequest();
    openSwitcher();
  }, [clearGardenSwitcherRequest, gardenSwitcherRequested, isHomeRoute, openSwitcher]);

  // Several gardens and none remembered: the switcher opens once as the chooser. Dismissing
  // it leaves the prompt; only a pick writes.
  const offerScope = chooserScope(DEFAULT_CHAIN_ID, primaryAddress);
  useEffect(() => {
    if (status !== "choose" || !isHomeRoute || !offerScope || hasOfferedChooser(offerScope)) {
      return;
    }
    markChooserOffered(offerScope);
    setSwitcher({ open: true, mode: "choose" });
  }, [isHomeRoute, offerScope, status]);

  // Auth state for welcome message
  const { isAuthenticated } = useAuthState();
  const hasShownArrivalRef = useRef(false);
  const { set: scheduleArrival, clear: cancelArrival } = useTimeout();

  // Close home drawers when navigating away. The journal's section sheet (DL-128) closes with
  // them: a work opened from the Work sheet returns to Home itself, not to the sheet.
  useEffect(() => {
    if (!isHomeRoute) {
      closeWalletSheet();
      closeSwitcher();
      closeGardenSheet();
    }
  }, [closeGardenSheet, closeSwitcher, closeWalletSheet, isHomeRoute]);

  // Home names itself as where the visit came from, so the garden's Back steps back here.
  const visitGarden = useCallback(
    (id: string) => {
      closeSwitcher();
      navigate(`${APP_ROUTES.home}/${id}`, { returnTo: APP_ROUTES.home });
    },
    [closeSwitcher, navigate]
  );
  const openExplore = useCallback(() => {
    closeSwitcher();
    navigate(APP_ROUTES.explore);
  }, [closeSwitcher, navigate]);
  const pickGarden = useCallback(
    (id: string) => {
      selectGarden(id);
      closeSwitcher();
    },
    [closeSwitcher, selectGarden]
  );

  // Resolve an arrival action to its concrete client side effect.
  const runArrivalAction = useCallback(
    (action: ArrivalActionKind) => {
      switch (action) {
        case "openWorkDashboardPending":
          openWorkDashboard("pending");
          return;
        case "openGardenSwitcher":
          // The switcher opens on Home, wherever the member has gone since; it switches nothing.
          dashboardNavigation.openGardenSwitcher();
          return;
      }
    },
    [dashboardNavigation, openWorkDashboard]
  );

  // A child screen (Explore, a garden) opens under Home, so Home stays mounted and a toast
  // still waiting on its delay would land on that screen. Leaving Home cancels it; the
  // arrival stays passed.
  useLayoutEffect(() => {
    if (!isHomeRoute) cancelArrival();
  }, [cancelArrival, isHomeRoute]);

  // The toast reads the arrival as it shows: a garden switch during its delay moves where the
  // uploads are listed, and uploads sent meanwhile leave nothing to say.
  const latestArrival = useRef(arrival);
  useEffect(() => {
    latestArrival.current = arrival;
  }, [arrival]);

  // Show the arrival toast once per browser session, scoped to the signed-in address, and only
  // while the session is still on the Home it opened on: AppShell marks the arrival passed as
  // soon as the session is on any other screen. useArrivalState stays pending until it knows,
  // and an arrival with nothing waiting passes quietly, so work queued later raises no toast.
  useEffect(() => {
    if (!isAuthenticated || hasShownArrivalRef.current) return;
    if (!isHomeRoute) return;
    if (!normalizedAddress || arrival.kind === "pending") return;

    if (hasArrivalPassed(normalizedAddress)) {
      hasShownArrivalRef.current = true;
      return;
    }

    // Mark it passed BEFORE scheduling so re-renders / remounts this session don't re-fire.
    markArrivalPassed(normalizedAddress);
    hasShownArrivalRef.current = true;
    if (arrival.kind === "none") return;

    // Small delay to let the page render first.
    scheduleArrival(() => {
      const shown = latestArrival.current;
      if (shown.kind !== "queue") return;
      const spec = arrivalToastSpec(shown.orientation);
      toastService.info({
        title: intl.formatMessage({ id: spec.titleId }),
        message: intl.formatMessage({ id: spec.messageId }, spec.values),
        duration: 6000,
        action: {
          label: intl.formatMessage({ id: spec.actionLabelId }),
          onClick: () => runArrivalAction(spec.action),
          dismissOnClick: true,
        },
        suppressLogging: true,
      });
    }, 700);
  }, [
    arrival.kind,
    intl,
    isAuthenticated,
    isHomeRoute,
    normalizedAddress,
    runArrivalAction,
    scheduleArrival,
  ]);

  // The header's lead: Home's title with no garden, else the chip, which opens the switcher.
  let lead: ReactNode;
  if (status === "none" || status === "error") {
    lead = (
      <h1 className="truncate type-title-md text-text-strong">
        {intl.formatMessage({ id: "app.home" })}
      </h1>
    );
  } else if (status === "loading") {
    // The garden's name arrives with the list; the chip's place holds still meanwhile.
    lead = (
      <span
        aria-hidden="true"
        data-skeleton="garden-chip"
        className="h-8 w-36 max-w-full rounded-full bg-bg-soft-200"
      />
    );
  } else {
    lead = (
      <GardenChip
        gardens={myGardens.gardens.map(({ garden: g }) => ({ id: g.id, name: g.name }))}
        selectedGarden={
          garden
            ? { id: garden.id, name: garden.name, bannerImage: garden.bannerImage ?? "" }
            : null
        }
        onSelectGarden={(chosen) => chosen && pickGarden(chosen.id)}
        onOpen={openSwitcher}
        emptyLabel={intl.formatMessage({ id: "app.home.chooser.title" })}
      />
    );
  }

  let body: ReactNode;
  switch (status) {
    case "loading":
      body = <HomeLoading remembered={Boolean(gardenId)} />;
      break;
    case "error":
      body = <HomeError onRetry={myGardens.refetch} />;
      break;
    case "none":
      body = (
        <HomeFindGarden
          awaiting={awaiting}
          communityGarden={communityGarden}
          onExplore={openExplore}
          onVisit={visitGarden}
        />
      );
      break;
    case "choose":
      body = <HomeChoosePrompt onChoose={() => setSwitcher({ open: true, mode: "choose" })} />;
      break;
    case "ready":
      // The journal leaves while a child route shows: a garden page there renders its own
      // sheets, and the Endowment sheet opens from one app-wide flag.
      body =
        isHomeRoute && garden && activeMembership ? (
          <HomeJournal garden={garden} membership={activeMembership} />
        ) : null;
      break;
  }

  return (
    <article className="mb-6">
      <div hidden={!isHomeRoute}>
        <HomeHeader
          lead={lead}
          launchers={
            <>
              <WalletSheetIcon onClick={openWalletSheet} />
              <DeferredCommitmentsSheetLauncher onClick={openCommitmentsSheet} />
              <WorkDashboardIcon />
            </>
          }
        />
        <div className={status === "ready" ? "pt-2" : "padded pt-2"}>{body}</div>
      </div>
      <Outlet />
      {isSwitcherPresent ? (
        <GardenSwitcherSheet
          isOpen={switcher.open}
          onClose={closeSwitcher}
          mode={switcher.mode}
          rows={rows}
          onPick={pickGarden}
          onVisit={visitGarden}
          onExplore={openExplore}
        />
      ) : null}
      {isWalletSheetPresent ? (
        <Suspense fallback={null}>
          <WalletSheet isOpen={isWalletSheetOpen} onClose={closeWalletSheet} />
        </Suspense>
      ) : null}
      {isCommitmentsSheetPresent ? (
        <Suspense fallback={null}>
          <CommitmentsSheet isOpen={isCommitmentsSheetOpen} onClose={closeCommitmentsSheet} />
        </Suspense>
      ) : null}
    </article>
  );
};

export default Home;
