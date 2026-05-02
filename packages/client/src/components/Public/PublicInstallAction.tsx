import {
  type InstallAction,
  useApp,
  useInstallGuidance,
  usePublicInstallHandler,
} from "@green-goods/shared";
import type { MouseEventHandler, ReactNode } from "react";
import { useCallback, useState } from "react";
import { useIntl } from "react-intl";
import {
  PUBLIC_PWA_LAUNCH_URL,
  PublicInstallDialog,
  type PublicInstallDialogMode,
} from "./PublicInstallDialog";

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

function launchInstalledApp() {
  if (typeof window === "undefined") return;
  window.location.assign(PUBLIC_PWA_LAUNCH_URL);
}

export function PublicInstallAction({ children, forceOpenApp = false }: PublicInstallActionProps) {
  const { formatMessage } = useIntl();
  const { isMobile, platform, isInstalled, wasInstalled, deferredPrompt, promptInstall } = useApp();
  const guidance = useInstallGuidance(
    platform,
    isInstalled,
    wasInstalled,
    deferredPrompt,
    isMobile
  );
  const dispatchInstallAction = usePublicInstallHandler(guidance, promptInstall);
  const [dialogMode, setDialogMode] = useState<PublicInstallDialogMode | null>(null);

  // Gate "open-app" affordance on mobile: desktop users can't usefully launch
  // the installed PWA from a desktop browser even if `getInstalledRelatedApps`
  // reports it as installed. Always show "Install App" + QR dialog on desktop.
  const isOpenApp =
    forceOpenApp ||
    (isMobile && (isInstalled || wasInstalled || guidance.primaryAction.type === "open-app"));
  const dataInstallAction = isOpenApp ? "open-app" : guidance.primaryAction.type;
  const label = formatMessage({
    id: isOpenApp ? "public.nav.openApp" : "public.nav.installApp",
    defaultMessage: isOpenApp ? "Open App" : "Install App",
  });

  const handleClick = useCallback<MouseEventHandler<HTMLElement>>(
    async (event) => {
      event.preventDefault();

      if (isOpenApp) {
        launchInstalledApp();
        return;
      }

      if (!isMobile) {
        setDialogMode("desktopQr");
        return;
      }

      if (guidance.primaryAction.type === "native-install") {
        await dispatchInstallAction(event);
        return;
      }

      setDialogMode("mobileSteps");
    },
    [dispatchInstallAction, guidance.primaryAction.type, isMobile, isOpenApp]
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
        href: isOpenApp ? PUBLIC_PWA_LAUNCH_URL : "#install",
        isOpenApp,
        dataInstallAction,
        onClick: handleClick,
      })}
      <PublicInstallDialog
        open={dialogMode !== null}
        mode={dialogMode ?? "desktopQr"}
        guidance={guidance}
        onOpenChange={(open) => {
          if (!open) setDialogMode(null);
        }}
        onPrimaryAction={handleDialogPrimaryAction}
      />
    </>
  );
}
