import * as Dialog from "@radix-ui/react-dialog";
import type React from "react";
import { DeviceFrameset } from "react-device-frameset";

import "react-device-frameset/styles/marvel-devices.min.css";

import { useApp } from "@green-goods/shared/providers/app";
import {
  RiAddBoxLine,
  RiCloseLine,
  RiDownloadLine,
  RiExternalLinkLine,
  RiMore2Fill,
  RiUploadLine,
} from "@remixicon/react";
import { FormattedMessage, useIntl } from "react-intl";

interface HeroProps {
  handleSubscribe: (e: React.FormEvent<HTMLFormElement>) => void;
}

export const Hero: React.FC<HeroProps> = () => {
  const intl = useIntl();
  const { isMobile, platform, deferredPrompt, promptInstall, isInstalled, wasInstalled } = useApp();

  return (
    <main className="w-full min-h-[calc(100lvh-9rem)] lg:min-h-[calc(100lvh-6rem)] flex flex-col lg:flex-row lg:justify-center gap-16">
      <div
        // onSubmit={handleSubscribe}
        className="flex-1 flex flex-col gap-2 items-center lg:items-start lg:justify-center pt-[10vh] lg:pt-0 text-center lg:text-left"
      >
        <h2 className="font-bold lg:text-8xl lg:tracking-wide text-[#367D42] mb-2">
          {intl.formatMessage({
            id: "app.hero.title",
            defaultMessage: "Bringing Biodiversity Onchain",
          })}
        </h2>
        <p className="text-xl lg:text-2xl">
          {intl.formatMessage({
            id: "app.hero.description",
            defaultMessage:
              "Green Goods measures, tracks, and rewards the impact on gardens with a simple progressive web app.",
          })}
          <span className="font-bold text-2xl hidden sm:flex text-[#367D42]">
            {intl.formatMessage({
              id: "app.hero.cta",
              defaultMessage: "Open the website on your phone to get started!",
            })}
          </span>
        </p>

        {isMobile && !isInstalled && (
          <>
            {deferredPrompt ? (
              /* NATIVE INSTALL - Direct trigger, no modal */
              <button
                type="button"
                onClick={() => {
                  promptInstall();
                }}
                className="px-6 py-4 bg-[#367D42] text-white rounded-full w-full font-bold shadow-sm active:scale-95 transition-transform flex items-center justify-center gap-2"
              >
                <RiDownloadLine className="w-5 h-5" />
                {intl.formatMessage({
                  id: "app.hero.install",
                  defaultMessage: "Install App",
                })}
              </button>
            ) : wasInstalled ? (
              /* OPEN APP - App was previously installed */
              <a
                href="/home"
                className="px-6 py-4 bg-[#367D42] text-white rounded-full w-full font-bold shadow-sm active:scale-95 transition-transform flex items-center justify-center gap-2 no-underline"
              >
                <RiExternalLinkLine className="w-5 h-5" />
                {intl.formatMessage({
                  id: "app.hero.open",
                  defaultMessage: "Open App",
                })}
              </a>
            ) : (
              /* MANUAL INSTALL - Show modal with instructions */
              <Dialog.Root>
                <Dialog.Trigger className="px-6 py-4 bg-[#367D42] text-white rounded-full w-full font-bold shadow-sm active:scale-95 transition-transform flex items-center justify-center gap-2">
                  <RiDownloadLine className="w-5 h-5" />
                  {intl.formatMessage({
                    id: "app.hero.install",
                    defaultMessage: "Install App",
                  })}
                </Dialog.Trigger>
                <Dialog.Portal>
                  <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in z-50" />
                  <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 px-4 max-w-md w-full animate-scale-in z-50 focus:outline-none">
                    <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-2 bg-[#367D42]" />

                      <div className="mt-2 mb-6">
                        <h4 className="text-xl font-bold text-[#367D42] mb-2">
                          {intl.formatMessage({
                            id: "app.hero.install.title",
                            defaultMessage: "Install Green Goods",
                          })}
                        </h4>
                        <p className="text-gray-600">
                          {intl.formatMessage({
                            id: "app.hero.install.subtitle",
                            defaultMessage: "Add to your home screen for the best experience.",
                          })}
                        </p>
                      </div>

                      <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
                        {platform === "ios" ? (
                          <>
                            <div className="flex items-start gap-3">
                              <div className="p-2 bg-blue-50 text-[#007AFF] rounded-md shrink-0 border border-blue-100">
                                <RiUploadLine className="w-6 h-6" />
                              </div>
                              <div>
                                <p className="font-bold text-gray-900 text-sm uppercase tracking-wide">
                                  Step 1
                                </p>
                                <p className="text-sm text-gray-600 leading-tight mt-0.5">
                                  <FormattedMessage
                                    id="app.hero.install.ios.step1"
                                    defaultMessage="Tap the <b>Share</b> button in your browser bar."
                                    values={{
                                      b: (chunks) => (
                                        <b className="font-bold text-gray-900">{chunks}</b>
                                      ),
                                    }}
                                  />
                                </p>
                              </div>
                            </div>
                            <div className="w-px h-4 bg-gray-300 ml-5" />
                            <div className="flex items-start gap-3">
                              <div className="p-2 bg-gray-200 text-gray-600 rounded-md shrink-0 border border-gray-300">
                                <RiAddBoxLine className="w-6 h-6" />
                              </div>
                              <div>
                                <p className="font-bold text-gray-900 text-sm uppercase tracking-wide">
                                  Step 2
                                </p>
                                <p className="text-sm text-gray-600 leading-tight mt-0.5">
                                  <FormattedMessage
                                    id="app.hero.install.ios.step2"
                                    defaultMessage="Scroll down and tap <b>Add to Home Screen</b>."
                                    values={{
                                      b: (chunks) => (
                                        <b className="font-bold text-gray-900">{chunks}</b>
                                      ),
                                    }}
                                  />
                                </p>
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-start gap-3">
                              <div className="p-2 bg-gray-200 text-gray-600 rounded-md shrink-0">
                                <RiMore2Fill className="w-6 h-6" />
                              </div>
                              <div>
                                <p className="font-bold text-gray-900 text-sm uppercase tracking-wide">
                                  Step 1
                                </p>
                                <p className="text-sm text-gray-600 leading-tight mt-0.5">
                                  <FormattedMessage
                                    id="app.hero.install.android.step1"
                                    defaultMessage="Tap the <b>Menu</b> button (three dots)."
                                    values={{
                                      b: (chunks) => (
                                        <b className="font-bold text-gray-900">{chunks}</b>
                                      ),
                                    }}
                                  />
                                </p>
                              </div>
                            </div>
                            <div className="w-px h-4 bg-gray-300 ml-5" />
                            <div className="flex items-start gap-3">
                              <div className="p-2 bg-gray-200 text-gray-600 rounded-md shrink-0 border border-gray-300">
                                <RiAddBoxLine className="w-6 h-6" />
                              </div>
                              <div>
                                <p className="font-bold text-gray-900 text-sm uppercase tracking-wide">
                                  Step 2
                                </p>
                                <p className="text-sm text-gray-600 leading-tight mt-0.5">
                                  <FormattedMessage
                                    id="app.hero.install.android.step2"
                                    defaultMessage="Select <b>Add to Home Screen</b> or <b>Install App</b>."
                                    values={{
                                      b: (chunks) => (
                                        <b className="font-bold text-gray-900">{chunks}</b>
                                      ),
                                    }}
                                  />
                                </p>
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      <Dialog.Close className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                        <RiCloseLine />
                      </Dialog.Close>
                    </div>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>
            )}
          </>
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
