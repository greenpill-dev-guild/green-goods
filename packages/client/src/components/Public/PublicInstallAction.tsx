import { getDocumentScrollPosition } from "@green-goods/shared/hooks/ui/useDocumentScrollLock";
import {
  type InstallAction,
  useInstallGuidance,
} from "@green-goods/shared/hooks/app/useInstallGuidance";
import {
  createAndroidAppLaunchUrl,
  getOpenInBrowserUrl,
} from "@green-goods/shared/utils/app/browser";
import { useApp } from "@green-goods/shared/providers/App";
import { useIsBraveBrowser } from "@green-goods/shared/hooks/app/useIsBraveBrowser";
import { usePublicInstallHandler } from "@green-goods/shared/hooks/app/usePublicInstallHandler";
import { useTunnelUrl } from "@green-goods/shared/hooks/app/useTunnelUrl";
import {
  type MouseEventHandler,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useIntl } from "react-intl";
import { useLocation } from "react-router-dom";
import { PUBLIC_PWA_ORIGIN } from "@/config/pwaRouting";
import {
  createSharedLinkLaunchUrl,
  getSharedLinkLaunchPath,
  rememberSharedLink,
} from "@/config/sharedLink";
import { PublicInstallDialog, type PublicInstallDialogMode } from "./PublicInstallDialog";

export interface PublicInstallActionRenderProps {
  label: string;
  href: string;
  isOpenApp: boolean;
  disabled: boolean;
  dataInstallAction: InstallAction["type"];
  onClick: MouseEventHandler<HTMLElement>;
  hasInstallFallback: boolean;
  fallbackLabel: string;
  onInstallFallbackClick: MouseEventHandler<HTMLElement>;
}

export interface PublicInstallActionProps {
  children: (props: PublicInstallActionRenderProps) => ReactNode;
  /** Used only by receipt surfaces that know the intended CTA is app-open. */
  forceOpenApp?: boolean;
  destination?: string;
  /**
   * Takes keyboard focus when the install sheet closes and the control that opened it can no
   * longer hold it. The site header's drawer closes itself before the sheet opens, so the
   * header names its menu button here.
   */
  focusFallbackRef?: RefObject<HTMLElement | null>;
}

export function PublicInstallAction({
  children,
  forceOpenApp = false,
  destination,
  focusFallbackRef,
}: PublicInstallActionProps) {
  const { formatMessage } = useIntl();
  const tunnelUrl = useTunnelUrl();
  // The route comes from the router, which says when it changes. The site header keeps this
  // component mounted from page to page, and a read of window.location while rendering names no
  // reactive value, so the compiled app kept the path of the page the header first mounted on.
  const { pathname: currentPath } = useLocation();
  const launchPath = getSharedLinkLaunchPath(destination ?? currentPath);
  const launchUrl = useMemo(() => {
    if (typeof window === "undefined") return new URL(launchPath, PUBLIC_PWA_ORIGIN).href;
    const origin =
      import.meta.env.MODE === "development"
        ? (tunnelUrl ?? window.location.origin)
        : window.location.origin;
    const source = new URL(window.location.href);
    const target = new URL(source.pathname + source.search + source.hash, origin);
    return createSharedLinkLaunchUrl(
      launchPath,
      target.href,
      import.meta.env.VITE_USE_HASH_ROUTER === "true"
    );
  }, [launchPath, tunnelUrl]);
  const {
    isMobile,
    platform,
    isInstalled,
    isInstalling,
    isStandalone,
    wasInstalled,
    installedAppEvidence,
    deferredPrompt,
    promptInstall,
  } = useApp();
  const baseGuidance = useInstallGuidance({
    platform,
    installedAppEvidence,
    wasInstalled,
    deferredPrompt,
    isMobile,
    isInstalling,
  });
  // Capture on this device before browser-menu installation, including QR arrivals.
  useEffect(() => {
    if (!isInstalled) rememberSharedLink(launchPath);
  }, [isInstalled, launchPath]);
  const guidance = useMemo(
    () => ({
      ...baseGuidance,
      openInBrowserUrl:
        baseGuidance.openInBrowserUrl && platform === "android"
          ? getOpenInBrowserUrl(platform, "chrome", launchUrl)
          : baseGuidance.openInBrowserUrl,
    }),
    [baseGuidance, platform, launchUrl]
  );
  const dispatchInstallAction = usePublicInstallHandler(guidance, promptInstall);
  const isBrave = useIsBraveBrowser();
  // Android intent that reopens the current page in Chrome. Brave can't mint a
  // real WebAPK, so install-intent users are steered to Chrome (PRD-499).
  const openInChromeUrl = useMemo(
    () => (platform === "android" ? getOpenInBrowserUrl(platform, "chrome", launchUrl) : null),
    [platform, launchUrl]
  );
  const [dialogMode, setDialogMode] = useState<PublicInstallDialogMode | null>(null);
  // The sheet is opened from state, not from a Radix trigger, so Radix has nothing to hand
  // focus back to when it closes. Remember the control that opened it.
  const openerRef = useRef<HTMLElement | null>(null);
  const openDialog = useCallback((mode: PublicInstallDialogMode, opener: HTMLElement) => {
    openerRef.current = opener;
    setDialogMode(mode);
  }, []);

  // Gate "open-app" affordance on mobile: desktop users can't usefully launch
  // the installed PWA from a desktop browser even if `getInstalledRelatedApps`
  // reports it as installed. Always show "Install App" + QR dialog on desktop.
  const isInstallPending = guidance.primaryAction.type === "installing";
  const isOpenApp =
    !isInstallPending &&
    (forceOpenApp || (isMobile && (isInstalled || guidance.primaryAction.type === "open-app")));
  const isAndroidLaunch =
    isOpenApp &&
    platform === "android" &&
    !isStandalone &&
    import.meta.env.VITE_USE_HASH_ROUTER !== "true";
  const appHref = isAndroidLaunch
    ? createAndroidAppLaunchUrl(launchUrl, window.location.href)
    : import.meta.env.VITE_USE_HASH_ROUTER === "true"
      ? launchUrl
      : launchPath;
  const hasInstallFallback =
    isOpenApp &&
    isMobile &&
    !isInstalled &&
    guidance.secondaryAction?.type === "show-manual-steps" &&
    Boolean(guidance.manualInstructions?.length);
  const fallbackLabel = formatMessage({
    id: "public.nav.installAgain",
    defaultMessage: "Install Again",
  });
  const dataInstallAction = isInstallPending
    ? "installing"
    : isOpenApp
      ? "open-app"
      : guidance.primaryAction.type;
  const label = formatMessage({
    id: isInstallPending
      ? "public.nav.installingApp"
      : isOpenApp
        ? "public.nav.openApp"
        : "public.nav.installApp",
    defaultMessage: isInstallPending ? "Installing..." : isOpenApp ? "Open App" : "Install App",
  });

  const handleClick = useCallback<MouseEventHandler<HTMLElement>>(
    async (event) => {
      if (isInstallPending) {
        event.preventDefault();
        return;
      }

      rememberSharedLink(launchPath);
      if (isOpenApp) {
        if (isAndroidLaunch) {
          // Keep the navigation directly attached to the tap. Capture the current
          // route and position now, not when a long-lived header last rendered.
          event.currentTarget.setAttribute(
            "href",
            createAndroidAppLaunchUrl(launchUrl, window.location.href, getDocumentScrollPosition())
          );
        }
        return;
      }

      event.preventDefault();

      if (!isMobile) {
        openDialog("desktopQr", event.currentTarget);
        return;
      }

      // Brave on Android omits the "Brave" UA token, so it is detected as Chrome
      // and offered a native install that silently creates a home-screen shortcut
      // instead of a real WebAPK. Warn and steer to Chrome first (PRD-499).
      if (isBrave && platform === "android") {
        openDialog("braveInstall", event.currentTarget);
        return;
      }

      if (guidance.primaryAction.type === "native-install") {
        await dispatchInstallAction(event);
        return;
      }

      openDialog("mobileSteps", event.currentTarget);
    },
    [
      dispatchInstallAction,
      guidance.primaryAction.type,
      isBrave,
      isAndroidLaunch,
      launchUrl,
      isInstallPending,
      isMobile,
      isOpenApp,
      openDialog,
      platform,
      launchPath,
    ]
  );

  const handleInstallFallbackClick = useCallback<MouseEventHandler<HTMLElement>>(
    (event) => {
      event.preventDefault();
      rememberSharedLink(launchPath);
      openDialog("mobileSteps", event.currentTarget);
    },
    [launchPath, openDialog]
  );

  const handleDialogCloseAutoFocus = useCallback(
    (event: Event) => {
      const candidates = [openerRef.current, focusFallbackRef?.current];
      openerRef.current = null;
      for (const element of candidates) {
        if (!element?.isConnected) continue;
        // The page is where the visitor left it, so do not let the browser scroll to the control.
        element.focus({ preventScroll: true });
        // A control that is hidden at this width stays connected but cannot take focus.
        if (document.activeElement !== element) continue;
        event.preventDefault();
        return;
      }
    },
    [focusFallbackRef]
  );

  const handleDialogPrimaryAction = useCallback<MouseEventHandler<HTMLButtonElement>>(
    async (event) => {
      await dispatchInstallAction(event);
      if (guidance.primaryAction.type !== "copy-url") {
        setDialogMode(null);
      }
    },
    [dispatchInstallAction, guidance.primaryAction.type]
  );

  return (
    <>
      {children({
        label,
        href: isOpenApp ? appHref : "#install",
        isOpenApp,
        disabled: isInstallPending,
        dataInstallAction,
        onClick: handleClick,
        hasInstallFallback,
        fallbackLabel,
        onInstallFallbackClick: handleInstallFallbackClick,
      })}
      <PublicInstallDialog
        open={dialogMode !== null}
        mode={dialogMode ?? "desktopQr"}
        launchUrl={launchUrl}
        chromeUrl={openInChromeUrl}
        guidance={guidance}
        onOpenChange={(open) => {
          if (!open) setDialogMode(null);
        }}
        onPrimaryAction={handleDialogPrimaryAction}
        onCloseAutoFocus={handleDialogCloseAutoFocus}
      />
    </>
  );
}
