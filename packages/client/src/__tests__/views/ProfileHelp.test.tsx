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

  it("opens, closes, and switches FAQ questions", async () => {
    const user = userEvent.setup();

    render(wrap(createElement(ProfileHelp)));

    const joinGarden = screen.getByRole("button", { name: "How do I join a garden?" });
    const documentWork = screen.getByRole("button", { name: "How do I document garden work?" });
    const joinGardenContent = screen.getByTestId("faq-content-howToGetInvolved");
    const documentWorkContent = screen.getByTestId("faq-content-howSubmissionWorks");

    expect(joinGarden).toHaveAttribute("aria-expanded", "false");
    expect(joinGardenContent).toHaveAttribute("data-state", "closed");

    await user.click(joinGarden);

    expect(joinGarden).toHaveAttribute("aria-expanded", "true");
    expect(joinGardenContent).toHaveAttribute("data-state", "open");

    await user.click(joinGarden);

    expect(joinGarden).toHaveAttribute("aria-expanded", "false");
    expect(joinGardenContent).toHaveAttribute("data-state", "closed");

    await user.click(joinGarden);
    await user.click(documentWork);

    expect(joinGarden).toHaveAttribute("aria-expanded", "false");
    expect(joinGardenContent).toHaveAttribute("data-state", "closed");
    expect(documentWork).toHaveAttribute("aria-expanded", "true");
    expect(documentWorkContent).toHaveAttribute("data-state", "open");
  });
});
