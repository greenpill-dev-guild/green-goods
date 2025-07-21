import React, { useState } from "react";
import toast from "react-hot-toast";
import { Footer } from "@/components/Layout/Footer";
import { Header } from "@/components/Layout/Header";
import { Hero } from "@/components/Layout/Hero";
import { useApp } from "@/providers/app";

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
        toast.success("Successfilly subscribed!");

        setSubscribeState("subscribed");
      })
      .catch((_error) => {
        setSubscribeState("error");
        toast.error("Something went wrong. Please try again.");
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
