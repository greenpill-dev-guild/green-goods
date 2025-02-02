import React from "react";
import { DeviceFrameset } from "react-device-frameset";
import "react-device-frameset/styles/marvel-devices.min.css";

import { useApp } from "@/providers/app";

interface HeroProps {
  handleSubscribe: (e: React.FormEvent<HTMLFormElement>) => void;
}

export const Hero: React.FC<HeroProps> = ({ handleSubscribe }) => {
  const { isMobile, platform } = useApp();

  return (
    <main className="w-full min-h-[calc(100lvh-9rem)] lg:min-h-[calc(100lvh-6rem)] flex flex-col lg:flex-row lg:justify-center gap-16">
      <div
        // onSubmit={handleSubscribe}
        className="flex-1 flex flex-col gap-2 items-center lg:items-start lg:justify-center pt-[10vh] lg:pt-0 text-center lg:text-left"
      >
        <h2 className="font-bold lg:text-8xl lg:tracking-wide text-[#367D42] mb-2">
          Bringing Biodiversity Onchain
        </h2>
        <p className="text-xl lg:text-2xl">
          Green Goods measures, tracks, and rewards the impact on gardens with a
          simple progressive web app.{" "}
          <span className="font-bold text-2xl hidden sm:flex text-[#367D42]">
            Open the website on your phone to get started!
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
          <>
            <button
              className="w-full lg:max-w-xs h-14 px-4 py-2 rounded-md bg-[#D2B48C] text-white font-bold"
              type="button"
              onClick={() => {
                const dialog = document.getElementById(
                  "pwa-dialog"
                ) as HTMLDialogElement;

                dialog.showModal();
              }}
            >
              Install App
            </button>
            <dialog id="pwa-dialog" className="modal">
              <div className="modal-box bg-white">
                <h4 className="text-[#367D42]">Install Green Goods</h4>
                <p>
                  {platform === "ios" ?
                    "Tap the share button and then 'Add to Home Screen'."
                  : platform === "android" ?
                    "Tap the menu button and then 'Add to Home Screen'."
                  : "Tap the menu button and then 'Add to Home Screen'."}
                </p>
              </div>
              <form method="dialog" className="modal-backdrop">
                <button>close</button>
              </form>
            </dialog>
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
