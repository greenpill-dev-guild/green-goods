import { logger, toastService } from "@green-goods/shared";
import type {
  PublicSubscribeRequest,
  PublicSubscribeResponse,
} from "@green-goods/shared/public-contracts";
import { type FormEvent, useCallback, useState } from "react";
import { useIntl } from "react-intl";
import { publicCuration } from "@/content/publicCuration";
import {
  EditorialDivider,
  EditorialHeading,
  EditorialKicker,
  EditorialLede,
  EditorialPrimaryButton,
} from "./atoms";

type SubmitState = "idle" | "loading" | "ok" | "error";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

/**
 * PublicGetInTouch — closing module on the editorial homepage.
 *
 * Editorial walnut surface (`bg-editorial-deep`) with a quiet email subscribe
 * form and a Schedule-a-Call CTA. Honest UX: success only when the public
 * Agent route returns a confirmed `subscribed` / `already_subscribed`; Luma
 * outages render a localized failure with the Schedule-a-Call fallback.
 *
 * Mobile: subscribe form first, then a full-width Schedule-a-Call ghost
 * button so visitors on phones see both paths without scrolling past either.
 * Desktop: same content reflowed in a two-column editorial layout.
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
    <section className="bg-editorial-deep" aria-labelledby="public-get-in-touch-title">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 sm:px-10 md:py-28 lg:grid-cols-[1fr_1.1fr] lg:gap-24">
        <div>
          <EditorialKicker tone="dark" className="mb-5">
            {formatMessage({
              id: "public.home.getInTouch.kicker",
              defaultMessage: "§ 04 — Get In Touch",
            })}
          </EditorialKicker>
          <EditorialHeading id="public-get-in-touch-title" tone="dark">
            {formatMessage({
              id: "public.home.getInTouch.title",
              defaultMessage: "A letter, once a season.",
            })}
          </EditorialHeading>
          <div className="mt-5 max-w-md">
            <EditorialLede tone="dark">
              {formatMessage({
                id: "public.home.getInTouch.description",
                defaultMessage:
                  "Quiet dispatches from the Gardens — what's planted, what's tended, what's ready to be funded. No urgency. No tracking. One opt-in.",
              })}
            </EditorialLede>
          </div>
        </div>

        <div>
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-6"
            aria-describedby="public-subscribe-help"
          >
            <div>
              <label
                htmlFor="public-subscribe-email"
                className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-editorial-deep-fg/60"
              >
                {formatMessage({
                  id: "public.home.getInTouch.emailLabel",
                  defaultMessage: "Your email",
                })}
              </label>
              <div className="mt-3 flex items-center gap-3 border-b border-editorial-deep-fg/30 pb-2 focus-within:border-editorial-deep-fg/60">
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
                  className="flex-1 bg-transparent font-serif text-xl font-normal text-editorial-deep-fg placeholder-editorial-deep-fg/40 focus:outline-none md:text-2xl"
                />
                <EditorialPrimaryButton
                  type="submit"
                  disabled={submitState === "loading"}
                  className="shrink-0 px-5 py-2.5"
                >
                  {submitState === "loading"
                    ? formatMessage({
                        id: "public.home.getInTouch.submitting",
                        defaultMessage: "…",
                      })
                    : formatMessage({
                        id: "public.home.getInTouch.submit",
                        defaultMessage: "Subscribe",
                      })}
                </EditorialPrimaryButton>
              </div>
            </div>

            <label className="flex items-start gap-3 text-sm leading-relaxed text-editorial-deep-fg/72">
              <input
                type="checkbox"
                name="consent"
                required
                className="mt-1 h-4 w-4 shrink-0 rounded border-editorial-deep-fg/40 bg-transparent accent-primary-base"
              />
              <span>
                {formatMessage({
                  id: "public.home.getInTouch.consent",
                  defaultMessage:
                    "I'd like Green Goods to send seasonal letters about the Gardens. I can unsubscribe at any time, from any letter.",
                })}
              </span>
            </label>

            {submitState === "ok" ? (
              <p
                role="status"
                className="rounded-full bg-editorial-deep-fg/10 px-4 py-2 text-xs text-editorial-deep-fg"
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
                className="rounded-full bg-error-base/20 px-4 py-2 text-xs text-error-lighter"
              >
                {formatMessage({
                  id: errorMessageId,
                  defaultMessage:
                    "Something went wrong. Please try again or schedule a call below.",
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

          <div className="mt-10">
            <EditorialDivider tone="dark" />
            <p className="mt-4 text-sm leading-relaxed text-editorial-deep-fg/72">
              {formatMessage({
                id: "public.home.getInTouch.scheduleIntro",
                defaultMessage:
                  "Want to talk through what you're working on? Book a quiet half-hour with the team.",
              })}
            </p>
            <div className="mt-5">
              <a
                href={publicCuration.appointmentUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-editorial-deep-fg/40 bg-transparent px-6 py-3 text-sm font-medium text-editorial-deep-fg transition-colors hover:bg-editorial-deep-fg/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-editorial-deep-fg focus-visible:ring-offset-2 sm:w-auto"
              >
                {formatMessage({
                  id: "public.home.getInTouch.scheduleCall",
                  defaultMessage: "Schedule a call",
                })}
                <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
