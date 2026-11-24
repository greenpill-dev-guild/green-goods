// TEST-QUALITY: allow-small-test-file - no other file covers the campaign jar row; its layout
// and its open act are covered by its stories, and this file pins the read-failure rule alone.
import type { CampaignCookieJarCampaign } from "@green-goods/shared/types/cookie-jar";
import type { Address } from "@green-goods/shared/types/domain";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../test-utils";

const mocks = vi.hoisted(() => ({ read: {} as Record<string, unknown> }));

vi.mock("@green-goods/shared/hooks/cookie-jar/useCampaignCookieJar", () => ({
  useCampaignCookieJar: () => mocks.read,
}));

import { CampaignJarListRow } from "@/views/Cookies/components/CampaignCookieJar/CampaignJarListRow";

const JAR = "0x7A3d0000000000000000000000000000000041C2" as Address;
const campaign: CampaignCookieJarCampaign = {
  address: JAR,
  jarAddress: JAR,
  slug: "earth-week",
  label: "Earth Week",
  title: "Earth Week stewards",
  metadata: null,
  rawMetadata: "",
  source: "indexed",
};
const jar = {
  balance: 9_980_000_000_000_000_000n,
  decimals: 18,
  symbol: "DAI",
  withdrawalType: "fixed",
  fixedAmount: 2_000_000_000_000_000_000n,
  maxWithdrawal: 2_000_000_000_000_000_000n,
  metadata: null,
};

describe("CampaignJarListRow", () => {
  beforeEach(() => {
    mocks.read = { jar, isLoading: false, hasDetailReadFailure: false };
  });

  it("shows what one claim pays, and drops it when the jar's details could not be read", () => {
    const { unmount } = renderWithProviders(
      <CampaignJarListRow campaign={campaign} onSelect={vi.fn()} />
    );
    expect(screen.getByText("2 DAI a claim")).toBeInTheDocument();
    expect(screen.queryByText("Needs review")).not.toBeInTheDocument();
    unmount();

    // A failed detail read leaves the amounts at a fallback zero: the pill says so, alone.
    mocks.read = { jar: { ...jar, fixedAmount: 0n }, isLoading: false, hasDetailReadFailure: true };
    renderWithProviders(<CampaignJarListRow campaign={campaign} onSelect={vi.fn()} />);
    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.queryByText(/a claim/)).not.toBeInTheDocument();
  });
});
