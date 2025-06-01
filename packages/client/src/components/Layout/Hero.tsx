import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { DeviceFrameset } from "react-device-frameset";

import "react-device-frameset/styles/marvel-devices.min.css";

import { useApp } from "@/providers/app";
import { RiCloseLine } from "@remixicon/react";
import { useIntl } from "react-intl";

interface HeroProps {
  handleSubscribe: (e: React.FormEvent<HTMLFormElement>) => void;
}

export const Hero: React.FC<HeroProps> = () => {
  const intl = useIntl();
  const { isMobile, platform } = useApp();

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
        {/* <div className="flex flex-col lg:flex-row w-full mt-6">
          <input
            className="w-full h-14 px-4 py-2 border-[#367D42] rounded-md bg-slate-50 mb-2"
            name="email"
            type="email"
            required
            placeholder="Grow with us, enter your email"
          />
          <button
            className="w-full lg:max-w-60 h-14 px-4 py-2 rounded-md bg-[#367D42] text-white font-bold mb-6"
            type="submit"
            disabled={state === "subscribing" || state === "subscribed"}
          >
            Subscribe
          </button>
        </div> */}
        {isMobile && (
          <Dialog.Root>
            <Dialog.Trigger className="px-4 py-3 bg-green-600 text-white rounded-full w-full">
              {intl.formatMessage({
                id: "app.hero.install",
                defaultMessage: "Install App",
              })}
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 bg-transparent backdrop-blur-sm animate-fade-in" />
              <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 px-4 max-w-md w-full animate-scale-in">
                <div className="relative bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
                  <h4 className="text-[#367D42]">
                    {intl.formatMessage({
                      id: "app.hero.install.title",
                      defaultMessage: "Install Green Goods",
                    })}
                  </h4>
                  <p>
                    {platform === "ios" ?
                      intl.formatMessage({
                        id: "app.hero.install.ios",
                        defaultMessage:
                          "Tap the share button and then press <b>Add to Home Screen</b>",
                      })
                    : platform === "android" ?
                      intl.formatMessage({
                        id: "app.hero.install.android",
                        defaultMessage:
                          "Tap the 3 dots menu button in the bottom right and press <b>Add to Home Screen</b>",
                      })
                    : intl.formatMessage({
                        id: "app.hero.install.other",
                        defaultMessage:
                          "Tap the menu button and press <b>Add to Home Screen</b>",
                      })
                    }
                  </p>
                  <Dialog.Close className="absolute top-3 right-3">
                    <RiCloseLine />
                  </Dialog.Close>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
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
