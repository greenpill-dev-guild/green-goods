import type { Address } from "@green-goods/shared/types/domain";
import {
  claimFixture,
  commitmentFixture,
} from "@green-goods/shared/__tests__/test-utils/commitment-pooling-fixtures";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../test-utils";

const mocks = vi.hoisted(() => ({
  reasons: {} as Record<string, string>,
  loading: false,
}));

vi.mock("@green-goods/shared/commitment-pooling", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@green-goods/shared/commitment-pooling")>()),
  useCommitmentReason: (cid: string | null | undefined) => {
    const text = cid ? mocks.reasons[cid] : undefined;
    return {
      reason: text ? { version: 1, reason: text } : null,
      isLoading: Boolean(cid) && mocks.loading,
      isUnavailable: false,
    };
  },
}));

const { CommitmentClaimPanel } = await import(
  "../../views/Home/Garden/Commitment/CommitmentClaimPanel"
);

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
      body: /^Someone else took this up before a steward got to you\./,
    },
    {
      ending: "withdrawn",
      resolutionCode: "COMMITMENT_CANCELLED",
      garden: false,
      title: "The promise was withdrawn",
      body: /^The promise was withdrawn before anyone took it up, so you're no longer waiting on it\./,
    },
    {
      ending: "withdrawn, on a garden's request",
      resolutionCode: "COMMITMENT_CANCELLED",
      garden: true,
      title: "The promise was withdrawn",
      body: /so your garden is no longer waiting on it\./,
    },
    {
      ending: "lapsed",
      resolutionCode: "COMMITMENT_EXPIRED",
      garden: false,
      title: "The promise ran out of time",
      body: /^The promise lapsed before anyone took it up, so you're no longer waiting on it\./,
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

  function renderClosedRequest(resolutionCode: string) {
    renderWithProviders(
      <CommitmentClaimPanel
        commitment={commitmentFixture({
          claimMode: "APPROVAL_GATED",
          cancelReasonCID: "bafy-cancel-reason",
        })}
        request={claimFixture({ state: "SUPERSEDED", resolutionCode, requestedBy: VIEWER })}
        viewer={VIEWER}
        canAskAgain={false}
        isPending={false}
        onAskAgain={vi.fn()}
        onBackToBrowse={vi.fn()}
      />
    );
  }

  it("shows the reason the promise was withdrawn with", () => {
    mocks.reasons = { "bafy-cancel-reason": "Duplicate promise" };
    mocks.loading = false;
    renderClosedRequest("COMMITMENT_CANCELLED");
    expect(screen.getByText("Reason")).toBeInTheDocument();
    expect(screen.getByText("Duplicate promise")).toBeInTheDocument();
  });

  it.each([
    { loading: true, shown: "Reading the reason…", hidden: "—" },
    // Not loading and no words: the reason could not be read, or its CID is one the reader
    // rejects, so the row must not claim to be reading it.
    { loading: false, shown: "—", hidden: "Reading the reason…" },
  ])("reads $shown for the withdrawal's reason while loading is $loading", ({
    loading,
    shown,
    hidden,
  }) => {
    mocks.reasons = {};
    mocks.loading = loading;
    renderClosedRequest("COMMITMENT_CANCELLED");
    expect(screen.getByText(shown)).toBeInTheDocument();
    expect(screen.queryByText(hidden)).not.toBeInTheDocument();
  });

  it("gives no reason row when someone else took the promise up", () => {
    mocks.reasons = { "bafy-cancel-reason": "Duplicate promise" };
    mocks.loading = false;
    renderClosedRequest("COMMITMENT_ACCEPTED");
    expect(screen.queryByText("Reason")).not.toBeInTheDocument();
    expect(screen.queryByText("Duplicate promise")).not.toBeInTheDocument();
  });
});
