/**
 * Public vault crowdfunding route tests.
 *
 * @vitest-environment jsdom
 */

import { render, screen, within } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { OctantVaultCampaignManifest } from "@green-goods/shared";
import VaultsPage, { CampaignCard } from "../../views/Public/Vaults";

function renderView() {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: ["/vaults"] },
      createElement(IntlProvider, { locale: "en", messages: {} }, createElement(VaultsPage))
    )
  );
}

function renderCard(campaign: OctantVaultCampaignManifest) {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: ["/vaults"] },
      createElement(
        IntlProvider,
        { locale: "en", messages: {} },
        createElement(CampaignCard, { campaign })
      )
    )
  );
}

describe("VaultsPage", () => {
  it("renders the dedicated /vaults browse surface without wallet connection", () => {
    renderView();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Octant vault campaigns for public goods."
    );
    expect(screen.getByRole("heading", { name: "Greenpill NYC" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "EVMavericks Fantasy Football League" })
    ).toBeInTheDocument();
    expect(screen.getByText("No wallet connection needed to browse.")).toBeInTheDocument();
  });

  it("shows blocked transaction controls for incomplete manifest fixtures", () => {
    renderView();

    const nycCard = screen.getByTestId("vault-campaign-card-greenpill-nyc");
    const evmavericksCard = screen.getByTestId("vault-campaign-card-evmavericks");

    expect(
      within(nycCard).getByRole("button", { name: "Wallet Endow unavailable for Greenpill NYC" })
    ).toBeDisabled();
    expect(
      within(evmavericksCard).getByRole("button", {
        name: "Wallet Endow unavailable for EVMavericks Fantasy Football League",
      })
    ).toBeDisabled();
    expect(
      within(
        within(evmavericksCard).getByRole("list", { name: "Missing manifest fields" })
      ).getByText("Protocol Guild destination context")
    ).toBeInTheDocument();
  });

  it("keeps Donate and Card Donate out of the vault campaign route", () => {
    renderView();

    expect(screen.queryByText("Donate")).not.toBeInTheDocument();
    expect(screen.queryByText("Card Donate")).not.toBeInTheDocument();
    expect(
      screen.getAllByText("Thirdweb Card Endow hidden until custody proof passes")
    ).toHaveLength(2);
  });

  it("keeps Wallet Endow disabled for complete manifests until Phase 3 execution lands", () => {
    const completeCampaign: OctantVaultCampaignManifest = {
      slug: "synthetic-complete",
      displayName: "Synthetic complete campaign",
      communityName: "Synthetic Community",
      fixtureRole: "standard_campaign",
      routePath: "/vaults",
      targetProtocol: "octant-v2-ethereum",
      campaignCopy: {
        headline: "Fund a complete Octant vault",
        summary: "A complete fixture for manifest validation.",
        fundingPurpose: "Support public-goods work through a dedicated vault.",
        recipientLogic: "Yield routes through the supplied recipient configuration.",
        riskNote: "Vault deposits depend on the underlying token and Octant vault strategy.",
      },
      vault: {
        chainId: 1,
        vaultAddress: "0x1111111111111111111111111111111111111111",
        asset: {
          address: "0x2222222222222222222222222222222222222222",
          symbol: "USDC",
          decimals: 6,
        },
        explorerLink: "https://etherscan.io/address/0x1111111111111111111111111111111111111111",
      },
      recipientRoutingSummary: "Yield routes to a verified public-goods recipient.",
      protocolGuildDestinationContext: "Protocol Guild allocation context is recorded.",
    };

    renderCard(completeCampaign);

    expect(screen.getByText("Manifest complete")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Wallet Endow unavailable for Synthetic complete campaign",
      })
    ).toBeDisabled();
    expect(
      screen.getByText(
        "This campaign has the required vault tuple for Wallet Endow. Transaction execution starts in the next phase."
      )
    ).toBeInTheDocument();
  });
});
