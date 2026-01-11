import { toastService } from "@green-goods/shared";
import { useApp } from "@green-goods/shared/providers/App";
import React from "react";
import { Hero } from "@/components/Layout";
import { Footer, Header } from "@/components/Navigation";

const Landing: React.FC = () => {
  const { isMobile } = useApp();

  function handleSubscribe(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

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
          throw new Error("Network response was not ok.");
        }
        toastService.success({
          title: "Subscribed",
          message: "Thanks for joining the waitlist!",
          context: "email subscription",
          suppressLogging: true,
        });
      })
      .catch((error) => {
        toastService.error({
          title: "Subscription failed",
          message: "Something went wrong. Please try again.",
          context: "email subscription",
          error,
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
