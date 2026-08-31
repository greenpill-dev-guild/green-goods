import { RiUserLine } from "@remixicon/react";
import { useCanvasChromeProbe } from "@green-goods/shared/hooks/admin-ui/useCanvasChromeProbe";
import { useResolvedProfileAvatar } from "@green-goods/shared/profile-avatar";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ACCOUNT_TAB_SEARCH_PARAM,
  OPEN_ACCOUNT_SHEET_EVENT,
  parseAccountSheetTab,
  type AccountSheetTab,
  type OpenAccountSheetEventDetail,
} from "./accountSheet.events";
import { ADMIN_WORKSPACE_VIEWS } from "../navigation/workspaceViews";
import {
  NOTIFICATIONS_SHEET_CONTENT_ID,
  PROFILE_SHEET_CONTENT_ID,
  SETTINGS_SHEET_CONTENT_ID,
  type AdminRightSheetContentId,
} from "../navigation/sheetRegistry";
import {
  adminRoutes,
  getAdminWorkspaceForPath,
  getAdminWorkspaceRoot,
} from "../../../utils/navigation/admin-routes";
import type { ToolbarSlot } from "../../../components/Canvas/NavigationBar";
import { compareAddresses } from "../../../utils/blockchain/address";
import { useAuth } from "../../auth/useAuth";
import { useAdminGardenWorkspaceSelection } from "../../garden/useAdminGardenWorkspaceSelection";
import { useEligibleAdminGardens } from "../../garden/useEligibleAdminGardens";
import { useGardenUrlSync } from "../../navigation/useGardenUrlSync";
import { useSheetOrchestrator } from "../../navigation/useSheetOrchestrator";
import { useEffectiveToolbarPermissions } from "../../roles/useEffectiveToolbarPermissions";
import { useMediaQuery } from "../../ui/useMediaQuery";
import { useDocumentEvent } from "../../utils/useEventListener";
import {
  toAccountSheetContentId,
  useAdminRightSheetDescriptor,
} from "./useAdminRightSheetDescriptor";

export interface CanvasRouteChromeState {
  activePath: string;
  leftDialogTone: "hub" | "garden" | "community" | "actions";
  rawWorkspaceId: ReturnType<typeof getAdminWorkspaceForPath>;
  workspaceId: ReturnType<typeof getAdminWorkspaceForPath>;
}

export function selectCanvasRouteChrome(
  pathname: string,
  isDesktop: boolean
): CanvasRouteChromeState {
  const rawActivePath = getAdminWorkspaceRoot(pathname);
  const rawWorkspaceId = getAdminWorkspaceForPath(pathname);
  const normalizeProfile = isDesktop && rawWorkspaceId === "profile";
  const workspaceId = normalizeProfile ? "hub" : rawWorkspaceId;
  const leftDialogTone =
    workspaceId === "garden"
      ? "garden"
      : workspaceId === "community"
        ? "community"
        : workspaceId === "actions"
          ? "actions"
          : "hub";

  return {
    activePath: normalizeProfile ? adminRoutes.hub() : rawActivePath,
    leftDialogTone,
    rawWorkspaceId,
    workspaceId,
  };
}

interface CanvasShellControllerOptions {
  releaseDialogArtifacts: (document: Document) => void;
  renderAccountProfile: () => ReactNode;
  renderAccountSettings: () => ReactNode;
  renderNotifications: (closeSheet: () => void) => ReactNode;
}

export function useCanvasShellController({
  releaseDialogArtifacts,
  renderAccountProfile,
  renderAccountSettings,
  renderNotifications,
}: CanvasShellControllerOptions) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, eoaAddress, isReady, authMode } = useAuth();
  const { eligibleGardens, isLoaded: eligibleGardensLoaded } = useEligibleAdminGardens();
  const { selectedGarden } = useAdminGardenWorkspaceSelection();
  const { avatarUri: profileImageSrc } = useResolvedProfileAvatar();
  const [searchOpen, setSearchOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 600px)");
  const usesFloatingFabNavigation = useMediaQuery("(max-width: 1023px)");
  const permissions = useEffectiveToolbarPermissions();
  const { setGarden } = useGardenUrlSync();
  const { activeContentId, activeSheet, closeSheet, openSheet } = useSheetOrchestrator();
  const pendingDesktopAccountTabRef = useRef<AccountSheetTab | null>(null);

  const openRightSheetContent = useCallback(
    (contentId: AdminRightSheetContentId) => openSheet("right", contentId),
    [openSheet]
  );
  const toggleRightSheetContent = useCallback(
    (contentId: AdminRightSheetContentId) => {
      if (activeSheet === "right" && activeContentId === contentId) closeSheet();
      else openSheet("right", contentId);
    },
    [activeContentId, activeSheet, closeSheet, openSheet]
  );
  const renderNotificationPanel = useCallback(
    () => renderNotifications(closeSheet),
    [closeSheet, renderNotifications]
  );
  const rightSheetDescriptor = useAdminRightSheetDescriptor({
    contentId: activeContentId,
    renderAccountProfile,
    renderAccountSettings,
    renderNotifications: renderNotificationPanel,
  });

  useEffect(() => {
    if (activeSheet === "right" && rightSheetDescriptor === null) closeSheet();
  }, [activeSheet, closeSheet, rightSheetDescriptor]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<OpenAccountSheetEventDetail>).detail;
      openRightSheetContent(toAccountSheetContentId(detail?.tab ?? "profile"));
    };
    window.addEventListener(OPEN_ACCOUNT_SHEET_EVENT, handler as EventListener);
    return () => window.removeEventListener(OPEN_ACCOUNT_SHEET_EVENT, handler as EventListener);
  }, [openRightSheetContent]);

  useEffect(() => {
    if (typeof document !== "undefined") releaseDialogArtifacts(document);
  }, [location.pathname, releaseDialogArtifacts]);
  useDocumentEvent("visibilitychange", () => {
    if (document.visibilityState === "visible") releaseDialogArtifacts(document);
  });

  const toolbarVisibility = useMemo(
    () => ({
      showWork: permissions.showWork,
      showGarden: permissions.showGarden,
      showCommunity: permissions.showCommunity,
      showActions: permissions.showActions,
    }),
    [
      permissions.showActions,
      permissions.showCommunity,
      permissions.showGarden,
      permissions.showWork,
    ]
  );
  const slots = useMemo<ToolbarSlot[]>(
    () => [
      ...ADMIN_WORKSPACE_VIEWS.map((view) => ({
        id: view.id,
        label: view.label,
        labelId: view.labelId,
        icon: view.icon,
        path: view.rootPath,
        visible: toolbarVisibility[view.permission],
      })),
      {
        id: "profile",
        label: "Profile",
        labelId: "cockpit.nav.profile",
        icon: RiUserLine,
        path: adminRoutes.profile(),
        visible: true,
        mobileOnly: true,
      },
    ],
    [toolbarVisibility]
  );
  const routeChrome = useMemo(
    () => selectCanvasRouteChrome(location.pathname, isDesktop),
    [isDesktop, location.pathname]
  );
  const isCoreWorkspace = ["/hub", "/garden", "/community"].includes(routeChrome.activePath);
  const visibleSlotCount = useMemo(() => slots.filter((slot) => slot.visible).length, [slots]);
  const gardens = useMemo(
    () => eligibleGardens.map((garden) => ({ id: garden.id, name: garden.name })),
    [eligibleGardens]
  );
  const selectedGardenOption = useMemo(
    () => (selectedGarden ? { id: selectedGarden.id, name: selectedGarden.name } : null),
    [selectedGarden]
  );
  const selectGarden = useCallback(
    (garden: { id: string; name: string } | null) => {
      if (!garden) return setGarden(null);
      const fullGarden = eligibleGardens.find((candidate) =>
        compareAddresses(candidate.id, garden.id)
      );
      setGarden(fullGarden ?? null);
    },
    [eligibleGardens, setGarden]
  );

  useCanvasChromeProbe("CanvasLayout", {
    activePath: routeChrome.activePath,
    pathname: location.pathname,
    usesFloatingFabNavigation,
    visibleSlotCount,
    workspaceId: routeChrome.workspaceId,
  });

  useEffect(() => {
    if (!isDesktop || routeChrome.rawWorkspaceId !== "profile") return;
    pendingDesktopAccountTabRef.current = parseAccountSheetTab(
      new URLSearchParams(location.search).get(ACCOUNT_TAB_SEARCH_PARAM)
    );
    navigate(adminRoutes.hub(), { replace: true });
  }, [isDesktop, location.search, navigate, routeChrome.rawWorkspaceId]);

  useEffect(() => {
    if (!isDesktop || routeChrome.rawWorkspaceId === "profile") return;
    const pendingTab = pendingDesktopAccountTabRef.current;
    if (!pendingTab) return;
    openRightSheetContent(toAccountSheetContentId(pendingTab));
    pendingDesktopAccountTabRef.current = null;
  }, [isDesktop, openRightSheetContent, routeChrome.rawWorkspaceId]);

  useEffect(() => {
    if (!isReady || authMode === "embedded" || !isAuthenticated || !eoaAddress) return;
    if (!eligibleGardensLoaded) return;
    if (eligibleGardens.length === 0 && isCoreWorkspace) navigate("/", { replace: true });
  }, [
    authMode,
    eligibleGardens.length,
    eligibleGardensLoaded,
    eoaAddress,
    isAuthenticated,
    isCoreWorkspace,
    isReady,
    navigate,
  ]);

  const createGarden = useCallback(() => navigate(adminRoutes.gardenCreate()), [navigate]);
  const navigateTo = useCallback((path: string) => navigate(path), [navigate]);
  const openNotifications = useCallback(
    () => toggleRightSheetContent(NOTIFICATIONS_SHEET_CONTENT_ID),
    [toggleRightSheetContent]
  );
  const openProfile = useCallback(
    () => toggleRightSheetContent(PROFILE_SHEET_CONTENT_ID),
    [toggleRightSheetContent]
  );
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const openSettings = useCallback(
    () => toggleRightSheetContent(SETTINGS_SHEET_CONTENT_ID),
    [toggleRightSheetContent]
  );

  return {
    ...routeChrome,
    activeSheet,
    closeSheet,
    createGarden,
    gardens,
    isDesktop,
    isLoading: !isReady || (isAuthenticated && !eligibleGardensLoaded),
    navigate: navigateTo,
    openNotifications,
    openProfile,
    openSearch,
    openSettings,
    profileImageSrc,
    rightSheetDescriptor,
    searchOpen,
    selectGarden,
    selectedGarden: selectedGardenOption,
    setSearchOpen,
    slots,
    usesFloatingFabNavigation,
    visibleSlotCount,
  };
}
