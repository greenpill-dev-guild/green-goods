import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it } from "vitest";
import messages from "@green-goods/shared/i18n/en.json";
import { ProfileHelp } from "../../views/Profile/Help";

const wrap = (el: React.ReactElement) =>
  createElement(IntlProvider, { locale: "en", messages }, el);

describe("ProfileHelp", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps guides and socials apart from policies and requests, above the questions", () => {
    render(wrap(createElement(ProfileHelp)));

    // Headings and links in page order: each section's rows sit under its own heading.
    const page = [...document.querySelectorAll("h5, a")].map((element) =>
      element.tagName === "H5" ? `# ${element.textContent}` : element.getAttribute("href")
    );
    expect(page.slice(0, 11)).toEqual([
      "# Learn & Connect",
      "https://docs.greengoods.app/community/gardener-guide",
      "https://docs.greengoods.app/community/steward-guide",
      "https://x.com/greengoodsapp",
      "https://www.linkedin.com/company/greengoodsapp/",
      "# Privacy & Safety",
      "/privacy",
      "/terms",
      "/contact#account-deletion",
      "/contact#report-a-concern",
      "# Getting Started",
    ]);
    expect(screen.getByRole("link", { name: /Privacy Policy/ })).toHaveAttribute(
      "href",
      "/privacy"
    );
    expect(screen.getByRole("link", { name: /Steward Guide/ })).toHaveAttribute("target", "_blank");
  });

  it("links a question to the guide that walks through it, and only those questions", async () => {
    const user = userEvent.setup();
    render(wrap(createElement(ProfileHelp)));

    await user.click(screen.getByRole("button", { name: "How do I join a garden?" }));
    const guide = within(screen.getByTestId("faq-content-howToGetInvolved")).getByRole("link", {
      name: "Step-by-Step Guide (opens in a new tab)",
    });
    expect(guide).toHaveAttribute(
      "href",
      "https://docs.greengoods.app/community/gardener-guide/joining-a-garden"
    );
    expect(guide).toHaveAttribute("target", "_blank");
    expect(guide).toHaveAttribute("hreflang", "en");

    await user.click(screen.getByRole("button", { name: "What is Green Goods?" }));
    expect(
      within(screen.getByTestId("faq-content-whatIsGreenGoods")).queryByRole("link")
    ).not.toBeInTheDocument();
  });

  it("renders journey categories, the docs guide link, and surfaced/new topics", () => {
    render(wrap(createElement(ProfileHelp)));

    // Category headers (Title Case; "How it works" dissolved into Funds & Wallet / Privacy & Data)
    expect(screen.getByText("Getting Started")).toBeInTheDocument();
    expect(screen.getByText("Documenting Work")).toBeInTheDocument();
    expect(screen.getByText("Funds & Wallet")).toBeInTheDocument();
    expect(screen.getByText("Account & Identity")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Privacy & Data" })).toBeInTheDocument();
    expect(screen.queryByText("How it works")).not.toBeInTheDocument();

    // Newly authored + surfaced topics are present; the install FAQ was dropped
    expect(screen.getByTestId("faq-content-signingIn")).toBeInTheDocument();
    expect(screen.getByTestId("faq-content-syncTroubleshooting")).toBeInTheDocument();
    expect(screen.getByTestId("faq-content-trackingStatus")).toBeInTheDocument();
    expect(screen.getByTestId("faq-content-smartAccountAddress")).toBeInTheDocument();
    expect(screen.getByTestId("faq-content-whatIsImpact")).toBeInTheDocument();
    expect(screen.queryByTestId("faq-content-installingApp")).not.toBeInTheDocument();

    // New Funds & Wallet + Privacy & Data topics render
    expect(screen.getByTestId("faq-content-cookieJars")).toBeInTheDocument();
    expect(screen.getByTestId("faq-content-sendingFunds")).toBeInTheDocument();
    expect(screen.getByTestId("faq-content-onChainData")).toBeInTheDocument();
    expect(screen.getByTestId("faq-content-photoStorage")).toBeInTheDocument();

    // Account/app-management + declined-work topics render
    expect(screen.getByTestId("faq-content-profilePicture")).toBeInTheDocument();
    expect(screen.getByTestId("faq-content-changeLanguage")).toBeInTheDocument();
    expect(screen.getByTestId("faq-content-switchingAccounts")).toBeInTheDocument();
    expect(screen.getByTestId("faq-content-workDeclined")).toBeInTheDocument();

    // Docs guide link in the hub points at the public gardener guide
    const docsLink = screen.getByRole("link", { name: /Gardener Guide/ });
    expect(docsLink).toHaveAttribute(
      "href",
      "https://docs.greengoods.app/community/gardener-guide"
    );
    expect(
      document.querySelector('a[href^="https://t.me/"], a[href^="https://telegram.me/"]')
    ).toBeNull();

    // Onboarding form card was removed
    expect(screen.queryByText("Onboarding form")).not.toBeInTheDocument();
  });

  it("collapses the open item when another in the SAME category opens", async () => {
    const user = userEvent.setup();
    render(wrap(createElement(ProfileHelp)));

    // Both questions live in the "Getting started" category (one Faq root).
    const whatIs = screen.getByRole("button", { name: "What is Green Goods?" });
    const joinGarden = screen.getByRole("button", { name: "How do I join a garden?" });
    const whatIsContent = screen.getByTestId("faq-content-whatIsGreenGoods");
    const joinGardenContent = screen.getByTestId("faq-content-howToGetInvolved");

    expect(whatIs).toHaveAttribute("aria-expanded", "false");

    await user.click(whatIs);
    expect(whatIs).toHaveAttribute("aria-expanded", "true");
    expect(whatIsContent).toHaveAttribute("data-state", "open");

    await user.click(joinGarden);
    expect(whatIs).toHaveAttribute("aria-expanded", "false");
    expect(whatIsContent).toHaveAttribute("data-state", "closed");
    expect(joinGarden).toHaveAttribute("aria-expanded", "true");
    expect(joinGardenContent).toHaveAttribute("data-state", "open");
  });

  it("keeps items in DIFFERENT categories independently open", async () => {
    const user = userEvent.setup();
    render(wrap(createElement(ProfileHelp)));

    // "How do I join a garden?" is in Getting started; "How do I document garden work?"
    // is in Documenting work — separate Faq roots, so both can stay open.
    const joinGarden = screen.getByRole("button", { name: "How do I join a garden?" });
    const documentWork = screen.getByRole("button", { name: "How do I document garden work?" });
    const joinGardenContent = screen.getByTestId("faq-content-howToGetInvolved");
    const documentWorkContent = screen.getByTestId("faq-content-howSubmissionWorks");

    await user.click(joinGarden);
    await user.click(documentWork);

    expect(joinGarden).toHaveAttribute("aria-expanded", "true");
    expect(joinGardenContent).toHaveAttribute("data-state", "open");
    expect(documentWork).toHaveAttribute("aria-expanded", "true");
    expect(documentWorkContent).toHaveAttribute("data-state", "open");
  });
});
