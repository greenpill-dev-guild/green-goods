import { usePWA } from "@/providers/PWAProvider";
import React, { useState } from "react";
import { DeviceFrameset } from "react-device-frameset";
import "react-device-frameset/styles/marvel-devices.min.css";
import toast from "react-hot-toast";

type SubscribeState = "idle" | "subscribing" | "subscribed" | "error";

export const Hero: React.FC = () => {
  const { isMobile, platform } = usePWA();
  const [state, setSubscribeState] = useState<SubscribeState>("idle");

  function handleSubscribe(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setSubscribeState("subscribing");

    console.log(e.currentTarget);
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;

    fetch(
      import.meta.env.DEV ?
        "http://localhost:3000/api/subscribe"
      : "/api/subscribe",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      }
    )
      .then((response) => {
        if (!response.ok) {
          // ERROR
          console.log(response.status);

          throw new Error("Network response was not ok.");
        } else {
          toast.success("Successfilly subscribed!");

          setSubscribeState("subscribed");
        }
      })
      .catch((error) => {
        console.error("Error:", error);

        setSubscribeState("error");
        toast.error("Something went wrong. Please try again.");
      });
  }

  return (
    <main className="w-full min-h-[calc(100lvh-9rem)] lg:min-h-[calc(100lvh-6rem)] flex flex-col lg:flex-row lg:justify-center gap-16">
      <form
        onSubmit={handleSubscribe}
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
        <div className="flex flex-col lg:flex-row w-full mt-6">
          <input
            className="w-full h-14 px-4 py-2 border-[#367D42] rounded-md bg-stone-50 mb-2"
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
        </div>
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
              <div className="modal-box">
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
      </form>
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
