import * as Dialog from "@radix-ui/react-dialog";
import { type InstallGuidance, cn } from "@green-goods/shared";
import { RiCloseLine } from "@remixicon/react";
import { QRCodeSVG } from "qrcode.react";
import type { MouseEventHandler } from "react";
import { useIntl } from "react-intl";
export type PublicInstallDialogMode = "desktopQr" | "mobileSteps" | "braveLaunch";
export interface PublicInstallDialogProps {
  open: boolean;
  mode: PublicInstallDialogMode;
  launchUrl: string;
  guidance: InstallGuidance;
  onOpenChange: (open: boolean) => void;
  onPrimaryAction?: MouseEventHandler<HTMLButtonElement>;
}

function cleanInstructionText(value: string): string {
  return value.replace(/\*\*/g, "");
}

function hasMobilePrimaryAction(guidance: InstallGuidance): boolean {
  return (
    guidance.primaryAction.type === "open-in-browser" || guidance.primaryAction.type === "copy-url"
  );
}

export function PublicInstallDialog({
  open,
  mode,
  launchUrl,
  guidance,
  onOpenChange,
  onPrimaryAction,
}: PublicInstallDialogProps) {
  const { formatMessage } = useIntl();
  const isDesktopQr = mode === "desktopQr";
  const isBraveLaunch = mode === "braveLaunch";
  const manualSteps = guidance.manualInstructions ?? [];
  const showMobilePrimaryAction =
    !isDesktopQr && !isBraveLaunch && hasMobilePrimaryAction(guidance);

  const kickerId = isBraveLaunch
    ? "public.installDialog.braveKicker"
    : "public.installDialog.kicker";
  const kickerDefault = isBraveLaunch ? "Open the app" : "Phone handoff";

  const titleId = isDesktopQr
    ? "public.installDialog.title"
    : isBraveLaunch
      ? "public.installDialog.braveTitle"
      : "public.installDialog.mobileTitle";
  const titleDefault = isDesktopQr
    ? "Bring Green Goods into the field"
    : isBraveLaunch
      ? "Open Green Goods from your home screen"
      : "Install Green Goods on this phone";

  const descriptionId = isDesktopQr
    ? "public.installDialog.description"
    : isBraveLaunch
      ? "public.installDialog.braveBody"
      : "public.installDialog.mobileDescription";
  const descriptionDefault = isDesktopQr
    ? "Scan the code with your phone, then install the app from Safari or Chrome."
    : isBraveLaunch
      ? "Brave adds Green Goods as a home-screen app instead of launching it from this button. Tap the Green Goods icon on your home screen to open it."
      : "Use your browser's install controls. If this browser cannot install apps, open this page in Safari or Chrome first.";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="public-install-overlay fixed inset-0 z-overlay bg-static-black/45" />
        <Dialog.Content
          className={cn(
            "public-install-sheet fixed z-modal max-h-[calc(100vh-2rem)] w-full max-w-[calc(100vw-1.5rem)] overflow-hidden border border-stroke-soft-200 bg-bg-weak-50 text-text-strong-950 shadow-[var(--shadow-editorial-panel)] focus:outline-none",
            "bottom-0 left-1/2 -translate-x-1/2 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2",
            isDesktopQr ? "sm:max-w-[44rem]" : "sm:max-w-lg"
          )}
        >
          <div className="flex max-h-[calc(100vh-2rem)] flex-col overflow-y-auto p-5 sm:p-7">
            <header className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-text-soft-400">
                  {formatMessage({
                    id: kickerId,
                    defaultMessage: kickerDefault,
                  })}
                </p>
                <Dialog.Title className="mt-2 font-serif text-2xl font-normal leading-[1.08] tracking-[-0.018em] text-text-strong-950 md:text-3xl">
                  {formatMessage({
                    id: titleId,
                    defaultMessage: titleDefault,
                  })}
                </Dialog.Title>
                <Dialog.Description className="mt-3 max-w-prose text-sm leading-[1.65] text-text-sub-600">
                  {formatMessage({
                    id: descriptionId,
                    defaultMessage: descriptionDefault,
                  })}
                </Dialog.Description>
              </div>

              <Dialog.Close asChild>
                <button
                  type="button"
                  className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-stroke-soft-200 bg-bg-white-0 text-text-sub-600 transition-colors hover:bg-bg-weak-50 hover:text-text-strong-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2"
                  aria-label={formatMessage({
                    id: "app.common.close",
                    defaultMessage: "Close",
                  })}
                >
                  <RiCloseLine className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </header>

            {isDesktopQr ? (
              <div className="mt-7 grid gap-6 sm:grid-cols-[13.5rem_1fr] sm:items-start">
                <figure className="mx-auto w-full max-w-[13.5rem] border border-stroke-soft-200 bg-static-white p-4 text-static-black shadow-[var(--shadow-editorial-card)] sm:mx-0">
                  <QRCodeSVG
                    value={launchUrl}
                    size={192}
                    marginSize={4}
                    bgColor="var(--color-static-white)"
                    fgColor="var(--color-static-black)"
                    className="h-auto w-full"
                    role="img"
                    aria-label={formatMessage({
                      id: "public.installDialog.qrLabel",
                      defaultMessage: "QR code for the Green Goods app",
                    })}
                  />
                  <figcaption className="mt-3 text-center font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-soft-400">
                    {formatMessage({
                      id: "public.installDialog.qrCaption",
                      defaultMessage: "Scan with your phone camera",
                    })}
                  </figcaption>
                </figure>

                <div className="space-y-5">
                  <p className="font-serif text-lg leading-snug tracking-[-0.006em] text-text-strong-950">
                    {formatMessage({
                      id: "public.installDialog.message",
                      defaultMessage:
                        "Green Goods works best close to the garden: quick records, field photos, and offline-friendly work logs from your phone.",
                    })}
                  </p>

                  <ol className="space-y-3 text-sm leading-relaxed text-text-sub-600">
                    {[
                      [
                        "public.installDialog.step1Label",
                        "Step 1",
                        "public.installDialog.step1",
                        "Scan the QR code with your phone camera.",
                      ],
                      [
                        "public.installDialog.step2Label",
                        "Step 2",
                        "public.installDialog.step2",
                        "Open the site in Safari on iPhone or Chrome on Android.",
                      ],
                      [
                        "public.installDialog.step3Label",
                        "Step 3",
                        "public.installDialog.step3",
                        "Use Share, then Add to Home Screen on iPhone, or the browser menu, then Install app on Android.",
                      ],
                    ].map(([labelId, labelDefault, stepId, stepDefault]) => (
                      <li
                        key={stepId}
                        className="border-t border-stroke-soft-200 pt-3 first:border-t-0 first:pt-0"
                      >
                        <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-primary-dark">
                          {formatMessage({ id: labelId, defaultMessage: labelDefault })}
                        </span>
                        <p className="mt-1">
                          {formatMessage({ id: stepId, defaultMessage: stepDefault })}
                        </p>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            ) : isBraveLaunch ? (
              <div className="mt-6">
                <a
                  href={launchUrl}
                  className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-full bg-primary-action px-5 py-3 text-sm font-semibold text-primary-action-foreground transition-colors hover:bg-primary-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2 sm:w-fit"
                >
                  {formatMessage({
                    id: "public.installDialog.braveFallback",
                    defaultMessage: "Open in this tab instead",
                  })}
                </a>
              </div>
            ) : (
              <div className="mt-6 space-y-5">
                {guidance.browserSwitchReason ? (
                  <p className="border border-stroke-soft-200 bg-bg-white-0 p-4 text-sm leading-relaxed text-text-sub-600">
                    {guidance.browserSwitchReason}
                  </p>
                ) : null}

                {manualSteps.length > 0 ? (
                  <ol className="space-y-3">
                    {manualSteps.map((step) => (
                      <li
                        key={step.stepNumber}
                        className="flex gap-3 border border-stroke-soft-200 bg-bg-white-0 p-4"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-action text-xs font-semibold text-primary-action-foreground">
                          {step.stepNumber}
                        </span>
                        <div>
                          <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-primary-dark">
                            {formatMessage(
                              {
                                id: "public.installDialog.stepNumber",
                                defaultMessage: "Step {number}",
                              },
                              { number: step.stepNumber }
                            )}
                          </p>
                          <p className="mt-1 text-sm leading-relaxed text-text-sub-600">
                            {cleanInstructionText(step.description)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm leading-relaxed text-text-sub-600">
                    {formatMessage({
                      id: "public.installDialog.mobileFallback",
                      defaultMessage:
                        "Open this page in your phone's recommended browser, then use the browser menu to add Green Goods to your home screen.",
                    })}
                  </p>
                )}

                {showMobilePrimaryAction && onPrimaryAction ? (
                  <button
                    type="button"
                    onClick={onPrimaryAction}
                    data-install-action={guidance.primaryAction.type}
                    className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-full bg-primary-action px-5 py-3 text-sm font-semibold text-primary-action-foreground transition-colors hover:bg-primary-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2 sm:w-fit"
                  >
                    {guidance.primaryAction.label}
                  </button>
                ) : manualSteps.length === 0 ? (
                  <a
                    href={launchUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-full bg-primary-action px-5 py-3 text-sm font-semibold text-primary-action-foreground transition-colors hover:bg-primary-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2 sm:w-fit"
                  >
                    {formatMessage({
                      id: "public.installDialog.openInBrowser",
                      defaultMessage: "Open Green Goods",
                    })}
                  </a>
                ) : null}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
