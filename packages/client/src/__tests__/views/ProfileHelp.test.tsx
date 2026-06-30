import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it } from "vitest";
import messages from "../../../../shared/src/i18n/en.json";
import { ProfileHelp } from "../../views/Profile/Help";

const wrap = (el: React.ReactElement) =>
  createElement(IntlProvider, { locale: "en", messages }, el);

describe("ProfileHelp", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders journey categories, the docs guide link, and surfaced/new topics", () => {
    render(wrap(createElement(ProfileHelp)));

    // Category headers
    expect(screen.getByText("Getting started")).toBeInTheDocument();
    expect(screen.getByText("Documenting work")).toBeInTheDocument();
    expect(screen.getByText("Account & identity")).toBeInTheDocument();
    expect(screen.getByText("How it works")).toBeInTheDocument();

    // Newly authored + surfaced topics are present
    expect(screen.getByTestId("faq-content-signingIn")).toBeInTheDocument();
    expect(screen.getByTestId("faq-content-installingApp")).toBeInTheDocument();
    expect(screen.getByTestId("faq-content-syncTroubleshooting")).toBeInTheDocument();
    expect(screen.getByTestId("faq-content-trackingStatus")).toBeInTheDocument();
    expect(screen.getByTestId("faq-content-smartAccountAddress")).toBeInTheDocument();
    expect(screen.getByTestId("faq-content-whatIsImpact")).toBeInTheDocument();

    // Docs guide link in the hub points at the public gardener guide
    const docsLink = screen.getByRole("link", { name: /Gardener guide/i });
    expect(docsLink).toHaveAttribute(
      "href",
      "https://docs.greengoods.app/community/gardener-guide"
    );

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
