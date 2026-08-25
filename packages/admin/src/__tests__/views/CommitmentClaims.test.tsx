/**
 * @vitest-environment jsdom
 */

import { claimFixture } from "@green-goods/shared/__tests__/test-utils/commitment-pooling-fixtures";
import { commitmentDialogControllerFixture } from "@green-goods/shared/__tests__/test-utils/controller-fixtures";
import { describe, expect, it, vi } from "vitest";
import { CommitmentClaims } from "@/views/Garden/Pool/CommitmentDialog/CommitmentClaims";
import { renderWithProviders, screen, userEvent } from "../test-utils";

describe("CommitmentClaims", () => {
  it("keeps steward actions 44px-targeted and operable by pointer and keyboard", async () => {
    const acceptClaim = vi.fn().mockResolvedValue(undefined);
    const onOpenDialog = vi.fn();
    const controller = commitmentDialogControllerFixture();

    renderWithProviders(
      <CommitmentClaims
        claims={[claimFixture()]}
        can={{ ...controller.can, acceptClaim: true }}
        acts={{ ...controller.acts, acceptClaim }}
        actDisabled={false}
        onOpenDialog={onOpenDialog}
      />
    );

    const user = userEvent.setup();
    const accept = screen.getByRole("button", { name: "Accept" });
    const decline = screen.getByRole("button", { name: /Decline/ });
    expect(accept).toHaveClass("min-h-12");
    expect(decline).toHaveClass("min-h-12");

    await user.click(accept);
    decline.focus();
    await user.keyboard("{Enter}");

    expect(acceptClaim).toHaveBeenCalledTimes(1);
    expect(onOpenDialog).toHaveBeenCalledWith(expect.objectContaining({ kind: "decline-claim" }));
  });
});
