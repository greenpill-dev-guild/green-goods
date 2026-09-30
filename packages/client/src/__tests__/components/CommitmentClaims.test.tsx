import type { CommitmentClaimRequestRecord } from "@green-goods/shared/commitment-pooling";
import {
  claimFixture,
  commitmentFixture,
} from "@green-goods/shared/__tests__/test-utils/commitment-pooling-fixtures";
import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

const VIEWER = "0x1111111111111111111111111111111111111111" as const;

vi.mock("../../views/Home/Garden/Commitment/CommitmentClaimPanel", () => ({
  CommitmentClaimPanel: () => <div data-testid="own-claim" />,
}));
vi.mock("../../views/Home/Garden/Commitment/ClaimDecisionPanel", () => ({
  ClaimDecisionPanel: ({ requests }: { requests: CommitmentClaimRequestRecord[] }) => (
    <div data-testid="claim-decisions" data-count={requests.length} />
  ),
}));
vi.mock("../../views/Home/Garden/Commitment/ClaimContextSheet", () => ({
  ClaimContextSheet: ({ open }: { open: boolean }) => (
    <div data-testid="claim-context" data-open={String(open)} />
  ),
}));

const { CommitmentClaims } = await import("../../views/Home/Garden/Commitment/CommitmentClaims");

function props(
  overrides: Partial<ComponentProps<typeof CommitmentClaims>> = {}
): ComponentProps<typeof CommitmentClaims> {
  return {
    commitment: commitmentFixture(),
    viewer: VIEWER,
    ownRequest: null,
    pendingRequests: [],
    canAskAgain: false,
    stewardsPoolGarden: false,
    claimGardens: { member: [], stewarded: [] },
    contextOpen: false,
    onContextOpenChange: vi.fn(),
    isClaiming: false,
    isDeciding: false,
    onAskAgain: vi.fn(),
    onContinue: vi.fn(),
    onBackToBrowse: vi.fn(),
    onAccept: vi.fn(),
    onDecline: vi.fn(),
    ...overrides,
  };
}

describe("CommitmentClaims", () => {
  it("always renders the claim-context boundary", () => {
    render(<CommitmentClaims {...props({ contextOpen: true })} />);
    expect(screen.getByTestId("claim-context")).toHaveAttribute("data-open", "true");
  });

  it("renders the reader's request only when the reader is known", () => {
    const ownRequest = claimFixture({ claimant: VIEWER });
    const { rerender } = render(<CommitmentClaims {...props({ ownRequest })} />);
    expect(screen.getByTestId("own-claim")).toBeInTheDocument();

    rerender(<CommitmentClaims {...props({ ownRequest, viewer: null })} />);
    expect(screen.queryByTestId("own-claim")).not.toBeInTheDocument();
  });

  it("renders pending decisions only for a pool-garden steward", () => {
    const request = claimFixture({ claimant: VIEWER });
    const { rerender } = render(
      <CommitmentClaims {...props({ pendingRequests: [request], stewardsPoolGarden: true })} />
    );
    expect(screen.getByTestId("claim-decisions")).toHaveAttribute("data-count", "1");

    rerender(
      <CommitmentClaims {...props({ pendingRequests: [request], stewardsPoolGarden: false })} />
    );
    expect(screen.queryByTestId("claim-decisions")).not.toBeInTheDocument();
  });
});
