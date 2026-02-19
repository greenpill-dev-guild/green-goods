import {
  copyToClipboard,
  hapticLight,
  toastService,
  useApp,
  useInstallGuidance,
} from "@green-goods/shared";
import {
  RiAlertLine,
  RiDownloadLine,
  RiExternalLinkLine,
  RiFileCopyLine,
  RiSmartphoneLine,
} from "@remixicon/react";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { Button } from "@/components/Actions";
import { Card } from "@/components/Cards";
import { Avatar } from "@/components/Display";

export const InstallCta: React.FC = () => {
  const { isMobile, isInstalled, wasInstalled, deferredPrompt, promptInstall, platform } = useApp();
  const intl = useIntl();

  const guidance = useInstallGuidance(
    platform,
    isInstalled,
    wasInstalled,
    deferredPrompt,
    isMobile
  );

  const installDescription = useMemo(() => {
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
                variant="primary"
                mode="filled"
                size="xsmall"
                onClick={() => {
                  hapticLight();
                  window.location.href = guidance.openInBrowserUrl as string;
                }}
                leadingIcon={<RiExternalLinkLine className="w-4" />}
                label={intl.formatMessage({
                  id: "app.profile.openChrome",
                  defaultMessage: "Open in Chrome",
                })}
                className="shrink-0"
              />
            ) : (
              <Button
                variant="primary"
                mode="filled"
                size="xsmall"
                onClick={async () => {
                  hapticLight();
                  const success = await copyToClipboard(window.location.href);
                  if (success) {
                    toastService.success({
                      title: intl.formatMessage({
                        id: "app.profile.urlCopied",
                        defaultMessage: "Link Copied",
                      }),
                      message: intl.formatMessage({
                        id: "app.profile.urlCopiedMessage",
                        defaultMessage: "Open Safari and paste the link to install.",
                      }),
                      context: "copy-url",
                      suppressLogging: true,
                    });
                  }
                }}
                leadingIcon={<RiFileCopyLine className="w-4" />}
                label={intl.formatMessage({
                  id: "app.profile.copyLink",
                  defaultMessage: "Copy Link",
                })}
                className="shrink-0"
              />
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
                variant="primary"
                mode="filled"
                size="xsmall"
                onClick={promptInstall}
                leadingIcon={<RiDownloadLine className="w-4" />}
                label={intl.formatMessage({
                  id: "app.profile.installButton",
                  defaultMessage: "Install",
                })}
                className="shrink-0"
              />
            )}
          </div>
        </Card>
      )}
    </>
  );
};
