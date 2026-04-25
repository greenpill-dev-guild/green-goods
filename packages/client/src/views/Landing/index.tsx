import { toastService } from "@green-goods/shared";
import React from "react";
import { useIntl } from "react-intl";
import { Hero } from "@/components/Layout";

const Landing: React.FC = () => {
  const { formatMessage } = useIntl();

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
          title: formatMessage({ id: "app.landing.subscribed", defaultMessage: "Subscribed" }),
          message: formatMessage({
            id: "app.landing.subscribedMessage",
            defaultMessage: "Thanks for joining the waitlist!",
          }),
          context: "email subscription",
          suppressLogging: true,
        });
      })
      .catch((error) => {
        toastService.error({
          title: formatMessage({
            id: "app.landing.subscriptionFailed",
            defaultMessage: "Subscription failed",
          }),
          message: formatMessage({
            id: "app.landing.subscriptionFailedMessage",
            defaultMessage: "Something went wrong. Please try again.",
          }),
          context: "email subscription",
          error,
        });
      });
  }

  return (
    <div id="landing-root" className="px-8">
      <Hero handleSubscribe={handleSubscribe} />
    </div>
  );
};

export default Landing;
