import { toastService } from "@green-goods/shared";
import { useApp } from "@green-goods/shared/providers/App";
import React, { useState } from "react";
import { Hero } from "@/components/Layout";
import { Footer, Header } from "@/components/Navigation";

type LandingProps = {};

type SubscribeState = "idle" | "subscribing" | "subscribed" | "error";

const Landing: React.FC<LandingProps> = () => {
  const { isMobile } = useApp();

  const [_state, setSubscribeState] = useState<SubscribeState>("idle");

  function handleSubscribe(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setSubscribeState("subscribing");

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;

    fetch(import.meta.env.DEV ? "http://localhost:3000/api/subscribe" : "/api/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    })
      .then((response) => {
        if (!response.ok) {
          // ERROR
          throw new Error("Network response was not ok.");
        }
        toastService.success({
          title: "Subscribed",
          message: "Thanks for joining the waitlist!",
          context: "email subscription",
          suppressLogging: true,
        });

        setSubscribeState("subscribed");
      })
      .catch((_error) => {
        setSubscribeState("error");
        toastService.error({
          title: "Subscription failed",
          message: "Something went wrong. Please try again.",
          context: "email subscription",
          error: _error,
        });
      });
  }

  return (
    <div id="landing-root" className="px-8">
      <Header />
      <Hero handleSubscribe={handleSubscribe} />
      {!isMobile && <Footer />}
    </div>
  );
};

export default Landing;
