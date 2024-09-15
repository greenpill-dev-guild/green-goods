import toast from "react-hot-toast";
import React, { useState } from "react";

import { usePWA } from "@/providers/PWAProvider";

import { Hero } from "@/components/Layout/Hero";
import { Header } from "@/components/Layout/Header";
import { Footer } from "@/components/Layout/Footer";

interface LandingProps {}

type SubscribeState = "idle" | "subscribing" | "subscribed" | "error";

const Landing: React.FC<LandingProps> = () => {
  const { isMobile } = usePWA();

  const [_state, setSubscribeState] = useState<SubscribeState>("idle");

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
    <>
      <Header />
      <Hero handleSubscribe={handleSubscribe} />
      {!isMobile && <Footer />}
    </>
  );
};

export default Landing;
