import { Button } from "@green-goods/shared/components/Button";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { useInstallGuidance } from "@green-goods/shared/hooks/app/useInstallGuidance";
import { useApp } from "@green-goods/shared/providers/App";
import { copyToClipboard } from "@green-goods/shared/utils/app/clipboard";
import {
  RiAlertLine,
  RiDownloadLine,
  RiExternalLinkLine,
  RiFileCopyLine,
  RiSmartphoneLine,
} from "@remixicon/react";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { Card } from "@/components/Cards";
import { Avatar } from "@/components/Display";

export const InstallCta: React.FC = () => {
  const {
    isMobile,
    isInstalled,
    isInstalling,
    wasInstalled,
    installedAppEvidence,
    deferredPrompt,
    promptInstall,
    platform,
  } = useApp();
  const intl = useIntl();

  const guidance = useInstallGuidance({
    platform,
    installedAppEvidence,
    wasInstalled,
    deferredPrompt,
    isMobile,
    isInstalling,
  });

  const installDescription = useMemo(() => {
    if (guidance.scenario === "installing") {
      return intl.formatMessage({
        id: "app.profile.installDescriptionInstalling",
        defaultMessage: "Green Goods is finishing installation.",
      });
    }
    if (guidance.scenario === "native-prompt-available") {
      return intl.formatMessage({
        id: "app.profile.installDescriptionPrompt",
        defaultMessage: "Install for the best experience with offline support.",
      });
    }
    if (guidance.manualInstructions) {
      return guidance.manualInstructions
        .map((step) => step.description.replace(/\*\*/g, ""))
        .join(" → ");
    }
    if (platform === "ios") {
      return intl.formatMessage({
        id: "app.profile.installDescriptionIOS",
        defaultMessage: "Tap Share → Add to Home Screen in Safari.",
      });
    }
    return intl.formatMessage({
      id: "app.profile.installDescriptionAndroid",
      defaultMessage: "Open in Chrome → Menu → Install app.",
    });
  }, [guidance.scenario, guidance.manualInstructions, platform, intl]);

  // Hide only once the app is detected live. Android remembered installs keep
  // Open App primary on public CTAs, but the same remembered signal can be stale
  // after uninstall, so Profile should still offer the manual reinstall path.
  if (!isMobile || isInstalled) return null;

  return (
    <>
      <h5 className="text-label-md text-text-strong-950">
        {intl.formatMessage({
          id: "app.profile.install",
          defaultMessage: "Install App",
        })}
      </h5>

      {(guidance.scenario === "wrong-browser" || guidance.scenario === "in-app-browser") && (
        <Card>
          <div className="flex flex-row items-start gap-3 w-full">
            <Avatar>
              <div className="flex items-center justify-center text-center mx-auto text-warning-dark">
                <RiAlertLine className="w-4" />
              </div>
            </Avatar>
            <div className="flex flex-col gap-1 grow">
              <div className="text-sm font-medium text-warning-dark">
                {guidance.scenario === "in-app-browser"
                  ? intl.formatMessage({
                      id: "app.profile.openInBrowser",
                      defaultMessage: "Open in Browser",
                    })
                  : intl.formatMessage({
                      id: "app.profile.switchBrowser",
                      defaultMessage: "Switch Browser",
                    })}
              </div>
              <div className="text-xs text-text-sub-600">{guidance.browserSwitchReason}</div>
            </div>
            {guidance.openInBrowserUrl ? (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  window.location.href = guidance.openInBrowserUrl as string;
                }}
                leadingIcon={<RiExternalLinkLine className="h-4 w-4" aria-hidden="true" />}
                className="shrink-0"
              >
                {intl.formatMessage({
                  id: "app.profile.openChrome",
                  defaultMessage: "Open in Chrome",
                })}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={async () => {
                  const success = await copyToClipboard(window.location.href);
                  if (success) {
                    toastService.success({
                      title: intl.formatMessage({
                        id: "app.profile.urlCopied",
                        defaultMessage: "URL copied",
                      }),
                      message: intl.formatMessage({
                        id: "app.profile.urlCopiedMessage",
                        defaultMessage: "Profile URL copied to clipboard",
                      }),
                      context: "copy-url",
                      suppressLogging: true,
                    });
                  }
                }}
                leadingIcon={<RiFileCopyLine className="h-4 w-4" aria-hidden="true" />}
                className="shrink-0"
              >
                {intl.formatMessage({
                  id: "app.profile.copyLink",
                  defaultMessage: "Copy Link",
                })}
              </Button>
            )}
          </div>
        </Card>
      )}

      {guidance.scenario !== "wrong-browser" && guidance.scenario !== "in-app-browser" && (
        <Card>
          <div className="flex flex-row items-center gap-3 justify-between w-full">
            <Avatar>
              <div className="flex items-center justify-center text-center mx-auto text-primary">
                <RiSmartphoneLine className="w-4" />
              </div>
            </Avatar>
            <div className="flex flex-col gap-1 grow">
              <div className="text-sm font-medium">
                {intl.formatMessage({
                  id: "app.profile.installTitle",
                  defaultMessage: "Install Green Goods",
                })}
              </div>
              <div className="text-xs text-text-sub-600">{installDescription}</div>
            </div>
            {guidance.scenario === "native-prompt-available" && (
              <Button
                type="button"
                size="sm"
                onClick={promptInstall}
                leadingIcon={<RiDownloadLine className="h-4 w-4" aria-hidden="true" />}
                className="shrink-0"
              >
                {intl.formatMessage({
                  id: "app.profile.installButton",
                  defaultMessage: "Install",
                })}
              </Button>
            )}
            {guidance.scenario === "installing" && (
              <Button type="button" size="sm" loading className="shrink-0">
                {intl.formatMessage({
                  id: "app.profile.installingButton",
                  defaultMessage: "Installing",
                })}
              </Button>
            )}
          </div>
        </Card>
      )}
    </>
  );
};
