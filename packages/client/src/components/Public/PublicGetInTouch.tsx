import { logger, toastService } from "@green-goods/shared";
import type {
  PublicSubscribeRequest,
  PublicSubscribeResponse,
} from "@green-goods/shared/public-contracts";
import { type FormEvent, useCallback, useState } from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { publicCuration } from "@/content/publicCuration";

type SubmitState = "idle" | "loading" | "ok" | "error";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

/**
 * PublicGetInTouch — closing module on the editorial homepage.
 *
 * Calls `POST {VITE_API_BASE_URL}/public/subscribe` with explicit consent.
 * Honest UX: success only on `subscribed` / `already_subscribed`; otherwise
 * a safe failure state + Schedule-a-Call fallback. No fake success on Luma
 * outage.
 */
export function PublicGetInTouch() {
  const { formatMessage } = useIntl();
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMessageId, setErrorMessageId] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const email = String(formData.get("email") ?? "").trim();
      const consent = formData.get("consent") === "on";
      if (!email) {
        setSubmitState("error");
        setErrorMessageId("public.home.getInTouch.error.invalidEmail");
        return;
      }
      if (!consent) {
        setSubmitState("error");
        setErrorMessageId("public.home.getInTouch.error.consentRequired");
        return;
      }

      const body: PublicSubscribeRequest = {
        email,
        consent: true,
        source: "homepage_get_in_touch",
      };

      setSubmitState("loading");
      setErrorMessageId(null);
      try {
        const response = await fetch(`${API_BASE_URL}${publicCuration.subscribeRoute}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await response.json()) as PublicSubscribeResponse;
        if (response.ok && "ok" in json && json.ok) {
          setSubmitState("ok");
          toastService.success({
            title: formatMessage({
              id: "public.home.getInTouch.success.title",
              defaultMessage: "We'll keep you posted",
            }),
            message: formatMessage({
              id:
                json.status === "already_subscribed"
                  ? "public.home.getInTouch.success.alreadySubscribed"
                  : "public.home.getInTouch.success.subscribed",
              defaultMessage:
                json.status === "already_subscribed"
                  ? "You're already on the list — thanks for sticking with us."
                  : "Thanks for subscribing. Updates land a few times a season.",
            }),
            context: "public.home.getInTouch",
            suppressLogging: true,
          });
          return;
        }
        const errorCode = json && "errorCode" in json ? json.errorCode : "internal_error";
        setSubmitState("error");
        setErrorMessageId(`public.home.getInTouch.error.${errorCode}`);
      } catch (error) {
        logger.warn("[PublicGetInTouch] subscribe failed", { error });
        setSubmitState("error");
        setErrorMessageId("public.home.getInTouch.error.network");
      }
    },
    [formatMessage]
  );

  return (
    <section className="bg-bg-weak-50 py-20" aria-labelledby="public-get-in-touch-title">
      <div className="mx-auto max-w-3xl px-6 text-center sm:px-10">
        <h2
          id="public-get-in-touch-title"
          className="font-serif text-3xl text-text-strong-950 md:text-4xl"
        >
          {formatMessage({
            id: "public.home.getInTouch.title",
            defaultMessage: "Get in touch",
          })}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-text-sub-600 md:text-base">
          {formatMessage({
            id: "public.home.getInTouch.description",
            defaultMessage:
              "Subscribe for seasonal updates, or schedule a call to talk through what you're working on.",
          })}
        </p>

        <form
          onSubmit={handleSubmit}
          className="mx-auto mt-8 flex max-w-xl flex-col gap-3"
          aria-describedby="public-subscribe-help"
        >
          <label htmlFor="public-subscribe-email" className="sr-only">
            {formatMessage({
              id: "public.home.getInTouch.emailLabel",
              defaultMessage: "Email address",
            })}
          </label>
          <input
            id="public-subscribe-email"
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder={formatMessage({
              id: "public.home.getInTouch.emailPlaceholder",
              defaultMessage: "you@example.com",
            })}
            className="w-full rounded-full border border-stroke-soft-200 bg-bg-white-0 px-5 py-3 text-sm text-text-strong-950 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base"
          />
          <label className="flex items-start gap-2 text-left text-xs text-text-sub-600">
            <input
              type="checkbox"
              name="consent"
              required
              className="mt-0.5 h-4 w-4 rounded border-stroke-soft-200"
            />
            <span>
              {formatMessage({
                id: "public.home.getInTouch.consent",
                defaultMessage:
                  "I want occasional updates from Green Goods. I can unsubscribe any time.",
              })}
            </span>
          </label>
          <button
            type="submit"
            disabled={submitState === "loading"}
            className="rounded-full bg-primary-action px-6 py-3 text-sm font-semibold text-primary-action-foreground shadow-sm transition-colors hover:bg-primary-action-hover disabled:opacity-60"
          >
            {submitState === "loading"
              ? formatMessage({
                  id: "public.home.getInTouch.submitting",
                  defaultMessage: "Subscribing…",
                })
              : formatMessage({
                  id: "public.home.getInTouch.submit",
                  defaultMessage: "Subscribe",
                })}
          </button>
          {submitState === "ok" ? (
            <p
              role="status"
              className="mt-2 rounded-full bg-success-lighter px-4 py-2 text-xs text-success-base"
            >
              {formatMessage({
                id: "public.home.getInTouch.success.inline",
                defaultMessage: "Thanks — check your inbox to confirm.",
              })}
            </p>
          ) : null}
          {submitState === "error" && errorMessageId ? (
            <p
              role="alert"
              className="mt-2 rounded-full bg-error-lighter px-4 py-2 text-xs text-error-base"
            >
              {formatMessage({
                id: errorMessageId,
                defaultMessage: "Something went wrong. Please try again or schedule a call below.",
              })}
            </p>
          ) : null}
          <p id="public-subscribe-help" className="sr-only">
            {formatMessage({
              id: "public.home.getInTouch.help",
              defaultMessage: "Single opt-in subscription. Email stays server-side.",
            })}
          </p>
        </form>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3 text-sm">
          <a
            href={publicCuration.appointmentUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-full border border-stroke-soft-200 bg-bg-white-0 px-5 py-2.5 text-sm font-medium text-text-strong-950 transition-colors hover:bg-bg-weak-50"
          >
            {formatMessage({
              id: "public.home.getInTouch.scheduleCall",
              defaultMessage: "Schedule a call",
            })}
          </a>
          <Link to="/gardens" className="text-sm font-medium text-primary-base hover:underline">
            {formatMessage({
              id: "public.home.getInTouch.exploreGardens",
              defaultMessage: "Explore Gardens",
            })}
          </Link>
        </div>
      </div>
    </section>
  );
}
