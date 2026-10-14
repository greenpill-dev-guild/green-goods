/**
 * The claim-context sheet keeps the reader's choice while its lists refresh.
 *
 * @vitest-environment happy-dom
 */
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { ClaimContextSheet } from "../../views/Home/Garden/Commitment/ClaimContextSheet";
import { renderWithProviders, screen } from "../test-utils";

const HOST = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const OTHER = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
const STEWARDED = "0xcccccccccccccccccccccccccccccccccccccccc" as const;

describe("ClaimContextSheet", () => {
  it("keeps the reader's choice while the lists refresh behind the open sheet", async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    const sheet = (memberGardens: ComponentProps<typeof ClaimContextSheet>["memberGardens"]) => (
      <ClaimContextSheet
        open
        onOpenChange={vi.fn()}
        memberGardens={memberGardens}
        stewardedGardens={[{ address: STEWARDED, name: "Stewarded Garden" }]}
        approvalGated={false}
        isPending={false}
        onContinue={onContinue}
      />
    );
    const { rerender } = renderWithProviders(sheet([{ address: OTHER, name: "Other Garden" }]));

    await user.click(screen.getByRole("radio", { name: /For Stewarded Garden/ }));
    // The host's own read lands, and the personal list gains the host.
    rerender(
      sheet([
        { address: HOST, name: "Host Garden" },
        { address: OTHER, name: "Other Garden" },
      ])
    );
    await user.click(screen.getByRole("button", { name: "Take This Up" }));

    expect(onContinue).toHaveBeenCalledWith({ kind: "garden", garden: STEWARDED });
  });
});
