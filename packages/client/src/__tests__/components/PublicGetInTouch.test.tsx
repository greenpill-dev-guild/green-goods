/**
 * PublicGetInTouch Component Tests
 *
 * Covers the public-browser contact section contract:
 * - Email signup remains the primary action.
 * - Consent is communicated as microcopy, not a checkbox.
 * - The public subscribe API still receives consent=true.
 * - Schedule-a-call uses the configured appointment URL without card chrome.
 *
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockToastSuccess, mockLoggerWarn } = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
  mockLoggerWarn: vi.fn(),
}));

vi.mock("@green-goods/shared", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  logger: { warn: mockLoggerWarn },
  toastService: { success: mockToastSuccess },
  useInViewReveal: () => ({ ref: () => undefined, revealed: true }),
}));

vi.mock("@/content/publicCuration", () => ({
  publicCuration: {
    featuredGardens: [],
    heroImagePath: "/images/hero.webp",
    fallbackImagePaths: ["/images/no-image-placeholder.png"],
    subscribeRoute: "/public/subscribe",
    appointmentUrl: "https://calendar.example/schedule",
  },
}));

import { getPublicSubscribeUrl, PublicGetInTouch } from "../../components/Public/PublicGetInTouch";

const messages: Record<string, string> = {
  "public.home.getInTouch.consent":
    "By subscribing, you agree to receive seasonal Green Goods updates. Unsubscribe any time.",
  "public.home.getInTouch.description":
    "Quiet dispatches from the Gardens: what's planted, what's tended, what's ready to be funded. No urgency. No tracking. One opt-in.",
  "public.home.getInTouch.emailLabel": "Your email",
  "public.home.getInTouch.emailPlaceholder": "you@example.com",
  "public.home.getInTouch.help": "Single opt-in subscription. Email stays server-side.",
  "public.home.getInTouch.kicker": "Section 05: Get In Touch",
  "public.home.getInTouch.scheduleCall": "Schedule a call",
  "public.home.getInTouch.scheduleIntro":
    "Want to talk through a Garden, funding path, or partnership? Book a quiet half-hour with the team.",
  "public.home.getInTouch.submit": "Subscribe",
  "public.home.getInTouch.submitting": "Subscribing...",
  "public.home.getInTouch.success.subscribed":
    "Thanks for subscribing. Updates land a few times a season.",
  "public.home.getInTouch.success.title": "We'll keep you posted",
  "public.home.getInTouch.title": "A letter, once a season.",
};

let fetchMock: ReturnType<typeof vi.fn>;

function renderGetInTouch() {
  return render(
    createElement(IntlProvider, { locale: "en", messages }, createElement(PublicGetInTouch))
  );
}

describe("PublicGetInTouch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, status: "subscribed" }),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders consent as microcopy rather than a checkbox", () => {
    renderGetInTouch();

    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(
      screen.getByText(
        "By subscribing, you agree to receive seasonal Green Goods updates. Unsubscribe any time."
      )
    ).toBeInTheDocument();
  });

  it("submits consent=true to the public subscription route", async () => {
    renderGetInTouch();

    fireEvent.change(screen.getByLabelText("Your email"), {
      target: { value: "person@example.org" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/public/subscribe",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "person@example.org",
          consent: true,
          source: "homepage_get_in_touch",
        }),
      })
    );
  });

  it("uses the same-origin Vercel proxy for the production public agent", () => {
    expect(getPublicSubscribeUrl("/public/subscribe", "https://agent.greengoods.app", true)).toBe(
      "/api/agent/public/subscribe"
    );
    expect(getPublicSubscribeUrl("/public/subscribe", "https://agent.greengoods.app", false)).toBe(
      "https://agent.greengoods.app/public/subscribe"
    );
    expect(getPublicSubscribeUrl("/public/subscribe", "", true)).toBe("/public/subscribe");
  });

  it("normalizes subscribe routes without changing custom API bases", () => {
    expect(getPublicSubscribeUrl("public/subscribe", "https://api.example.test/root", true)).toBe(
      "https://api.example.test/root/public/subscribe"
    );
  });

  it("links schedule-a-call to the configured appointment URL", () => {
    renderGetInTouch();

    const scheduleLink = screen.getByRole("link", { name: /schedule a call/i });
    expect(scheduleLink).toHaveAttribute("href", "https://calendar.example/schedule");
    expect(scheduleLink).toHaveClass("whitespace-nowrap");
    expect(scheduleLink).toHaveClass("shrink-0");
  });

  it("does not render schedule-a-call as a separate card", () => {
    renderGetInTouch();

    expect(screen.queryByText("Prefer a conversation?")).toBeNull();
    const scheduleLink = screen.getByRole("link", { name: /schedule a call/i });
    expect(scheduleLink.closest(".rounded-3xl")).toBeNull();
  });

  it("clears the email field after a successful subscribe", async () => {
    renderGetInTouch();

    const email = screen.getByLabelText("Your email") as HTMLInputElement;
    fireEvent.change(email, { target: { value: "person@example.org" } });
    expect(email.value).toBe("person@example.org");

    fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());

    expect(email.value).toBe("");
  });

  it("stacks the email input above the submit button on mobile", () => {
    renderGetInTouch();

    const email = screen.getByLabelText("Your email");
    const wrapper = email.parentElement as HTMLElement;

    // Mobile baseline is `flex-col`; the row layout only kicks in at `sm:`.
    expect(wrapper.className).toMatch(/\bflex-col\b/);
    expect(wrapper.className).toMatch(/\bsm:flex-row\b/);

    const submitButton = screen.getByRole("button", { name: "Subscribe" });
    // Submit button must span the full width on mobile to avoid the
    // 375px placeholder-truncation regression called out in the plan.
    expect(submitButton.className).toMatch(/\bw-full\b/);
    expect(submitButton.className).toMatch(/\bsm:w-auto\b/);
  });
});
