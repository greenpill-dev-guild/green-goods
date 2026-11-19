import type { Address } from "@green-goods/shared/types/domain";
import {
  claimFixture,
  commitmentFixture,
} from "@green-goods/shared/__tests__/test-utils/commitment-pooling-fixtures";
import { describe, expect, it, vi } from "vitest";
import { CommitmentClaimPanel } from "../../views/Home/Garden/Commitment/CommitmentClaimPanel";
import { renderWithProviders, screen } from "../test-utils";

const VIEWER = "0x1111111111111111111111111111111111111111" as Address;
const GARDEN = "0x2222222222222222222222222222222222222222" as Address;

describe("CommitmentClaimPanel", () => {
  // The index supersedes a request still pending when its promise is taken up, withdrawn or
  // lapses, and says which in the resolution code.
  it.each([
    {
      ending: "taken up by someone else",
      resolutionCode: "COMMITMENT_ACCEPTED",
      garden: false,
      title: "Taken up by another provider",
      body: /^Someone else took this up before a steward reached your request\./,
    },
    {
      ending: "withdrawn",
      resolutionCode: "COMMITMENT_CANCELLED",
      garden: false,
      title: "The promise was withdrawn",
      body: /^The promise was withdrawn before anyone took it up, so your request closed with it\./,
    },
    {
      ending: "withdrawn, on a garden's request",
      resolutionCode: "COMMITMENT_CANCELLED",
      garden: true,
      title: "The promise was withdrawn",
      body: /so your garden's request closed with it\./,
    },
    {
      ending: "lapsed",
      resolutionCode: "COMMITMENT_EXPIRED",
      garden: false,
      title: "The promise ran out of time",
      body: /^The promise lapsed before anyone took it up, so your request closed with it\./,
    },
  ])("tells a superseded request its promise was $ending", ({
    resolutionCode,
    garden,
    title,
    body,
  }) => {
    renderWithProviders(
      <CommitmentClaimPanel
        commitment={commitmentFixture({ claimMode: "APPROVAL_GATED" })}
        request={claimFixture({
          state: "SUPERSEDED",
          resolutionCode,
          claimant: garden ? GARDEN : VIEWER,
          requestedBy: VIEWER,
          claimType: garden ? "GARDEN" : "INDIVIDUAL",
        })}
        viewer={VIEWER}
        canAskAgain={false}
        isPending={false}
        onAskAgain={vi.fn()}
        onBackToBrowse={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.getByText(body)).toBeInTheDocument();
    if (resolutionCode !== "COMMITMENT_ACCEPTED") {
      expect(screen.queryByText("Taken up by another provider")).not.toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: /back to/i })).toBeInTheDocument();
  });
});
