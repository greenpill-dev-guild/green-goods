import React, { useState } from "react";
import { a, useSpring } from "@react-spring/web";

type SubscribeState = "idle" | "subscribing" | "subscribed" | "error";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const url =
  "https://house.us21.list-manage.com/subscribe/post-json?u=f9cd12d07ddbdbe80d68c3e28&amp;id=792284a5e1&amp&c=1;f_id=00ddeae6f0";

export const OnlyMobile: React.FC = () => {
  const [, setSubscribeState] = useState<SubscribeState>("idle");
  const [, setSubscribeError] = useState<string | null>(null);

  const contentSpring = useSpring({
    from: { opacity: 0 },
    to: { opacity: 1 },
    delay: 720,
    config: { friction: 120, tension: 240 },
  });

  function handleSubscribe(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setSubscribeState("subscribing");
    setSubscribeError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;

    console.log(email);

    fetch(url + "&" + formData, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      mode: "cors",
      cache: "default",
    })
      .then((response) => response.json())
      .then((data) => {
        if (data["result"] !== "success") {
          // ERROR
          console.log(data["msg"]);

          setSubscribeError("Something went wrong. Please try again.");
          setSubscribeState("error");
        } else {
          // SUCCESS - Show notification
          console.log(data["msg"]);

          setSubscribeState("subscribed");

          wait(2000).then(() => {
            setSubscribeState("idle");
          });
        }
      })
      .catch((error) => {
        console.error("Error:", error);

        setSubscribeError(error.message);
        setSubscribeState("error");
      });
  }

  return (
    <a.div className="grid place-items-center w-screen h-screen text-center z-10">
      <a.div style={contentSpring} className="flex flex-col gap-12">
        <div className="justify-self-start flex flex-col gap-2">
          <h1 className="text-9xl font-bold leading-[6rem]">Web3</h1>
          <p className="text-4xl tracking-wider">
            Connecting Generative Art & Culture
          </p>
        </div>
        <p className="text-2xl font-normal tracking-wide">
          📲 Visit <span className="font-bold">web3.app</span> on phone to
          install app
        </p>
        <form
          onSubmit={handleSubscribe}
          className="flex flex-col gap-2 justify-self-start"
        >
          <input
            className="w-96 h-14 px-4 py-2 rounded-md bg-gray-100"
            name="email"
            type="email"
            placeholder="Your email"
          />
          <button
            className="w-96 h-14 px-4 py-2 rounded-md bg-black text-white font-bold"
            type="submit"
          >
            Subscribe
          </button>
        </form>
      </a.div>
    </a.div>
  );
};
