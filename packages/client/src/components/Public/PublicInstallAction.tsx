import {
  type InstallAction,
  getOpenInBrowserUrl,
  useApp,
  useInstallGuidance,
  useIsBraveBrowser,
  usePublicInstallHandler,
  useTunnelUrl,
} from "@green-goods/shared";
import { type MouseEventHandler, type ReactNode, useCallback, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { PUBLIC_PWA_ORIGIN, createPwaLaunchUrl } from "@/config/pwa-routing";
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
}

export function PublicInstallAction({ children, forceOpenApp = false }: PublicInstallActionProps) {
  const { formatMessage } = useIntl();
  const tunnelUrl = useTunnelUrl();
  const launchUrl = useMemo(() => {
    if (typeof window === "undefined") return createPwaLaunchUrl(PUBLIC_PWA_ORIGIN);
    const origin =
      import.meta.env.MODE === "development"
        ? (tunnelUrl ?? window.location.origin)
        : window.location.origin;
    return createPwaLaunchUrl(origin);
  }, [tunnelUrl]);
  const {
    isMobile,
    platform,
    isInstalled,
    isInstalling,
    wasInstalled,
    deferredPrompt,
    promptInstall,
  } = useApp();
  const guidance = useInstallGuidance(
    platform,
    isInstalled,
    wasInstalled,
    deferredPrompt,
    isMobile,
    isInstalling
  );
  const dispatchInstallAction = usePublicInstallHandler(guidance, promptInstall);
  const isBrave = useIsBraveBrowser();
  // Android intent that reopens the current page in Chrome. Brave can't mint a
  // real WebAPK, so install-intent users are steered to Chrome (PRD-499).
  const openInChromeUrl = useMemo(
    () => (platform === "android" ? getOpenInBrowserUrl(platform, "chrome") : null),
    [platform]
  );
  const [dialogMode, setDialogMode] = useState<PublicInstallDialogMode | null>(null);

  // Gate "open-app" affordance on mobile: desktop users can't usefully launch
  // the installed PWA from a desktop browser even if `getInstalledRelatedApps`
  // reports it as installed. Always show "Install App" + QR dialog on desktop.
  const isInstallPending = guidance.primaryAction.type === "installing";
  const isOpenApp =
    !isInstallPending &&
    (forceOpenApp || (isMobile && (isInstalled || guidance.primaryAction.type === "open-app")));
  const hasInstallFallback =
    isOpenApp &&
    isMobile &&
    !isInstalled &&
    guidance.secondaryAction?.type === "show-manual-steps" &&
    Boolean(guidance.manualInstructions?.length);
  const fallbackLabel = formatMessage({
    id: "public.nav.installAgain",
    defaultMessage: "Install again",
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
      event.preventDefault();

      if (isInstallPending) return;

      if (isOpenApp) {
        // Brave does not mint a WebAPK on Android, so navigating to the scoped URL
        // stays in the browser tab instead of launching the installed app.
        if (isBrave) {
          setDialogMode("braveLaunch");
          return;
        }
        if (typeof window !== "undefined") {
          window.location.assign(launchUrl);
        }
        return;
      }

      if (!isMobile) {
        setDialogMode("desktopQr");
        return;
      }

      // Brave on Android omits the "Brave" UA token, so it is detected as Chrome
      // and offered a native install that silently creates a home-screen shortcut
      // instead of a real WebAPK. Warn and steer to Chrome first (PRD-499).
      if (isBrave && platform === "android") {
        setDialogMode("braveInstall");
        return;
      }

      if (guidance.primaryAction.type === "native-install") {
        await dispatchInstallAction(event);
        return;
      }

      setDialogMode("mobileSteps");
    },
    [
      dispatchInstallAction,
      guidance.primaryAction.type,
      isBrave,
      isInstallPending,
      isMobile,
      isOpenApp,
      launchUrl,
      platform,
    ]
  );

  const handleInstallFallbackClick = useCallback<MouseEventHandler<HTMLElement>>((event) => {
    event.preventDefault();
    setDialogMode("mobileSteps");
  }, []);

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
        href: isOpenApp ? launchUrl : "#install",
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
      />
    </>
  );
}
