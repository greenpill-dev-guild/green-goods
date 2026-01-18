import * as Dialog from "@radix-ui/react-dialog";
import { useCallback, useState, type FC } from "react";
import { useNavigate } from "react-router-dom";
import { DeviceFrameset } from "react-device-frameset";

import "react-device-frameset/styles/marvel-devices.min.css";

import { useInstallGuidance, copyToClipboard } from "@green-goods/shared";
import { useApp } from "@green-goods/shared/providers/App";
import {
  RiAddBoxLine,
  RiAlertLine,
  RiArrowRightLine,
  RiCheckLine,
  RiCloseLine,
  RiDownloadLine,
  RiExternalLinkLine,
  RiFileCopyLine,
  RiMore2Fill,
  RiSmartphoneLine,
  RiUploadLine,
} from "@remixicon/react";
import { FormattedMessage, useIntl } from "react-intl";

interface HeroProps {
  handleSubscribe: (e: React.FormEvent<HTMLFormElement>) => void;
}

export const Hero: FC<HeroProps> = () => {
  const intl = useIntl();
  const navigate = useNavigate();
  const { isMobile, platform, deferredPrompt, promptInstall, isInstalled, wasInstalled } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [copyError, setCopyError] = useState(false);

  // Get smart installation guidance based on current browser/platform
  const guidance = useInstallGuidance(
    platform,
    isInstalled,
    wasInstalled,
    deferredPrompt,
    isMobile
  );

  const handleCopyUrl = useCallback(async () => {
    try {
      const success = await copyToClipboard(window.location.href);
      if (success) {
        setCopySuccess(true);
        setCopyError(false);
        setTimeout(() => setCopySuccess(false), 2000);
      } else {
        setCopyError(true);
        setTimeout(() => setCopyError(false), 2000);
      }
    } catch {
      setCopyError(true);
      setTimeout(() => setCopyError(false), 2000);
    }
  }, []);

  const handlePrimaryAction = useCallback(() => {
    switch (guidance.primaryAction.type) {
      case "native-install":
        promptInstall();
        break;
      case "show-manual-steps":
        setIsModalOpen(true);
        break;
      case "open-in-browser":
        if (guidance.openInBrowserUrl) {
          window.location.href = guidance.openInBrowserUrl;
        }
        break;
      case "copy-url":
        handleCopyUrl();
        break;
      case "open-app":
        navigate("/home");
        break;
      default:
        break;
    }
  }, [guidance, promptInstall, handleCopyUrl, navigate]);

  return (
    <main className="w-full min-h-[calc(100lvh-9rem)] lg:min-h-[calc(100lvh-6rem)] flex flex-col lg:flex-row lg:justify-center gap-16">
      <div
        // onSubmit={handleSubscribe}
        className="flex-1 flex flex-col gap-2 items-center lg:items-start lg:justify-center pt-[10vh] lg:pt-0 text-center lg:text-left"
      >
        <h2 className="font-bold lg:text-7xl lg:tracking-wide text-primary mb-2">
          {intl.formatMessage({
            id: "app.hero.title",
            defaultMessage: "Bringing Regenerative Actions Onchain",
          })}
        </h2>
        <p className="text-xl lg:text-2xl">
          {intl.formatMessage({
            id: "app.hero.description",
            defaultMessage:
              "Green Goods measures, tracks, and rewards the impact on local hubs with a simple progressive web app.",
          })}
          <span className="font-bold text-2xl hidden sm:flex text-primary">
            {intl.formatMessage({
              id: "app.hero.cta",
              defaultMessage: "Open the website on your phone to get started!",
            })}
          </span>
        </p>

        {/* Smart PWA Installation Flow based on browser/platform detection */}
        {guidance.scenario === "already-installed" ? (
          /* Already installed - show open app button */
          <a
            href="/home"
            className="px-6 py-4 bg-primary text-primary-foreground rounded-full w-full font-bold shadow-sm active:scale-95 transition-transform flex items-center justify-center gap-2 no-underline"
          >
            <RiExternalLinkLine className="w-5 h-5" />
            {intl.formatMessage({
              id: "app.hero.open",
              defaultMessage: "Open App",
            })}
          </a>
        ) : guidance.scenario === "desktop" ? (
          /* Desktop view - prompt to open on mobile */
          <div className="text-center lg:text-left">
            <div className="flex items-center gap-2 text-primary">
              <RiSmartphoneLine className="w-5 h-5" />
              <span className="font-bold">
                {intl.formatMessage({
                  id: "app.hero.desktop.prompt",
                  defaultMessage: "Open on your phone to install",
                })}
              </span>
            </div>
          </div>
        ) : (
          /* Mobile installation flow */
          <div className="space-y-3 w-full">
            {/* Browser Switch Warning */}
            {(guidance.scenario === "wrong-browser" || guidance.scenario === "in-app-browser") && (
              <div className="bg-warning-lighter border border-warning-light rounded-lg p-4 flex items-start gap-3">
                <RiAlertLine className="w-5 h-5 text-warning-dark shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-warning-dark text-sm">
                    {guidance.scenario === "in-app-browser"
                      ? intl.formatMessage({
                          id: "app.hero.inapp.title",
                          defaultMessage: "Open in Browser",
                        })
                      : intl.formatMessage({
                          id: "app.hero.wrongbrowser.title",
                          defaultMessage: "Switch Browser",
                        })}
                  </p>
                  <p className="text-sm text-warning-dark/80 mt-1">
                    {guidance.browserSwitchReason}
                  </p>
                </div>
              </div>
            )}

            {/* Primary Action Button */}
            <button
              type="button"
              onClick={handlePrimaryAction}
              className="px-6 py-4 bg-primary text-primary-foreground rounded-full w-full font-bold shadow-sm active:scale-95 transition-transform flex items-center justify-center gap-2"
            >
              {guidance.primaryAction.type === "native-install" && (
                <RiDownloadLine className="w-5 h-5" />
              )}
              {guidance.primaryAction.type === "show-manual-steps" && (
                <RiDownloadLine className="w-5 h-5" />
              )}
              {guidance.primaryAction.type === "open-in-browser" && (
                <RiExternalLinkLine className="w-5 h-5" />
              )}
              {guidance.primaryAction.type === "copy-url" &&
                (copySuccess ? (
                  <RiCheckLine className="w-5 h-5" />
                ) : copyError ? (
                  <RiAlertLine className="w-5 h-5" />
                ) : (
                  <RiFileCopyLine className="w-5 h-5" />
                ))}
              {guidance.primaryAction.type === "open-app" && (
                <RiExternalLinkLine className="w-5 h-5" />
              )}

              {copySuccess
                ? intl.formatMessage({ id: "app.hero.copied", defaultMessage: "Copied!" })
                : copyError
                  ? intl.formatMessage({ id: "app.hero.copyFailed", defaultMessage: "Copy failed" })
                  : guidance.primaryAction.label}
            </button>

            {/* Secondary Action - Continue in Browser */}
            {guidance.secondaryAction && guidance.showBrowserOption && (
              <a
                href="/home"
                className="px-6 py-3 bg-transparent border border-stroke-soft-200 text-text-sub-600 rounded-full w-full font-medium flex items-center justify-center gap-2 no-underline hover:bg-bg-weak-50 transition-colors"
              >
                <RiArrowRightLine className="w-4 h-4" />
                {guidance.secondaryAction.label}
              </a>
            )}

            {/* Manual Installation Modal */}
            <Dialog.Root open={isModalOpen} onOpenChange={setIsModalOpen}>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm animate-fade-in z-50" />
                <Dialog.Content
                  className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 px-4 max-w-md w-full animate-scale-in z-50 focus:outline-none"
                  aria-labelledby="hero-modal-title"
                  aria-describedby="hero-modal-desc"
                >
                  <div className="relative bg-bg-white-0 rounded-xl shadow-2xl p-6 w-full overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-primary" />

                    <div className="mt-2 mb-6">
                      <h4 id="hero-modal-title" className="text-xl font-bold text-primary mb-2">
                        {intl.formatMessage({
                          id: "app.hero.install.title",
                          defaultMessage: "Install Green Goods",
                        })}
                      </h4>
                      <p id="hero-modal-desc" className="text-text-sub-600">
                        {intl.formatMessage({
                          id: "app.hero.install.subtitle",
                          defaultMessage: "Add to your home screen for the best experience.",
                        })}
                      </p>
                      {/* Show detected browser for transparency */}
                      <p className="text-xs text-text-soft-400 mt-2">
                        {intl.formatMessage(
                          {
                            id: "app.hero.install.browser",
                            defaultMessage: "Detected: {browser} on {platform}",
                          },
                          {
                            browser: guidance.browserInfo.displayName,
                            platform:
                              platform === "ios"
                                ? "iOS"
                                : platform === "android"
                                  ? "Android"
                                  : "Mobile",
                          }
                        )}
                      </p>
                    </div>

                    {/* Dynamic Installation Steps based on browser detection */}
                    {guidance.manualInstructions && (
                      <div className="space-y-4 bg-bg-weak-50 p-4 rounded-lg border border-stroke-soft-200">
                        {guidance.manualInstructions.map((step, index) => (
                          <div key={step.stepNumber}>
                            {index > 0 && <div className="w-px h-4 bg-bg-sub-300 ml-5 -my-2" />}
                            <div className="flex items-start gap-3">
                              <div
                                className={`p-2 rounded-md shrink-0 border ${
                                  index === 0
                                    ? "bg-information-lighter text-information-dark border-information-light"
                                    : "bg-bg-soft-200 text-text-sub-600 border-stroke-sub-300"
                                }`}
                              >
                                <StepIcon icon={step.icon} />
                              </div>
                              <div>
                                <p className="font-bold text-text-strong-950 text-sm uppercase tracking-wide">
                                  {step.title}
                                </p>
                                <p className="text-sm text-text-sub-600 leading-tight mt-0.5">
                                  <FormattedMessage
                                    id={`app.hero.install.step.${step.stepNumber}`}
                                    defaultMessage={step.description}
                                    values={{
                                      b: (chunks) => (
                                        <b className="font-bold text-text-strong-950">{chunks}</b>
                                      ),
                                    }}
                                  />
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Continue in browser option inside modal */}
                    <div className="mt-6 pt-4 border-t border-stroke-soft-200">
                      <a
                        href="/home"
                        className="text-sm text-text-soft-400 hover:text-text-sub-600 flex items-center justify-center gap-1 no-underline"
                        onClick={() => setIsModalOpen(false)}
                      >
                        {intl.formatMessage({
                          id: "app.hero.install.continue",
                          defaultMessage: "Continue in browser instead",
                        })}
                        <RiArrowRightLine className="w-4 h-4" />
                      </a>
                    </div>

                    <Dialog.Close className="absolute top-4 right-4 p-2 text-text-soft-400 hover:text-text-sub-600 rounded-full hover:bg-bg-weak-50 transition-colors">
                      <RiCloseLine className="w-5 h-5" />
                    </Dialog.Close>
                  </div>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          </div>
        )}
      </div>
      <div>
        {!isMobile && (
          <div className="flex-1 w-full h-full grid place-items-center">
            <DeviceFrameset device="iPhone 8" color="black">
              <img
                src="/images/app-mock.png"
                alt="Green Goods App Mockup"
                className="w-full h-full object-cover"
              />
            </DeviceFrameset>
          </div>
        )}
      </div>
    </main>
  );
};

/**
 * Helper component for rendering step icons in the manual installation flow
 */
const StepIcon: FC<{ icon: "share" | "menu" | "add" | "install" }> = ({ icon }) => {
  switch (icon) {
    case "share":
      return <RiUploadLine className="w-6 h-6" />;
    case "menu":
      return <RiMore2Fill className="w-6 h-6" />;
    case "add":
      return <RiAddBoxLine className="w-6 h-6" />;
    case "install":
      return <RiDownloadLine className="w-6 h-6" />;
    default:
      return <RiAddBoxLine className="w-6 h-6" />;
  }
};
