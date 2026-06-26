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
import { APP_ROUTES, PUBLIC_PWA_LAUNCH_URL } from "@/config/pwa-routing";
import { PublicInstallDialog, type PublicInstallDialogMode } from "./PublicInstallDialog";

export interface PublicInstallActionRenderProps {
  label: string;
  href: string;
  isOpenApp: boolean;
  dataInstallAction: InstallAction["type"];
  onClick: MouseEventHandler<HTMLElement>;
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
    if (import.meta.env.MODE !== "development") return PUBLIC_PWA_LAUNCH_URL;
    const origin = tunnelUrl ?? window.location.origin;
    return new URL(APP_ROUTES.home, origin).toString();
  }, [tunnelUrl]);
  const { isMobile, platform, isInstalled, wasInstalled, deferredPrompt, promptInstall } = useApp();
  const guidance = useInstallGuidance(
    platform,
    isInstalled,
    wasInstalled,
    deferredPrompt,
    isMobile
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
  const isOpenApp =
    forceOpenApp || (isMobile && (isInstalled || guidance.primaryAction.type === "open-app"));
  const dataInstallAction = isOpenApp ? "open-app" : guidance.primaryAction.type;
  const label = formatMessage({
    id: isOpenApp ? "public.nav.openApp" : "public.nav.installApp",
    defaultMessage: isOpenApp ? "Open App" : "Install App",
  });

  const handleClick = useCallback<MouseEventHandler<HTMLElement>>(
    async (event) => {
      event.preventDefault();

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
      isMobile,
      isOpenApp,
      launchUrl,
      platform,
    ]
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
        href: isOpenApp ? launchUrl : "#install",
        isOpenApp,
        dataInstallAction,
        onClick: handleClick,
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
