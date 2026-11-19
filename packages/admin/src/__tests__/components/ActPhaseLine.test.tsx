/**
 * The act line while a pool act waits on the wallet and after it ends (PRD-1551): past 20
 * seconds it says to open the wallet and offers Cancel, and an act that may still land, or that
 * the steward stopped waiting for, never reads as failed.
 */
import type { TxActPhase } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { describe, expect, it, vi } from "vitest";
import { ActPhaseLine } from "@/components/ActPhaseLine";
import { render, screen, userEvent } from "../test-utils";

describe("ActPhaseLine", () => {
  it("says to open the wallet once it is slow, and Cancel stops the wait", async () => {
    const cancel = vi.fn();
    render(
      <ActPhaseLine phase={{ status: "signing", key: "k", slow: true, cancel }} confirmed="" />
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Still waiting for your wallet. Open it to approve or reject the request."
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(cancel).toHaveBeenCalledOnce();
  });

  it.each([
    ["still-confirming", /^Sent\. Confirming is taking longer than usual\./],
    ["safe-signers", /^Waiting for the Safe's signers$/],
    ["stopped", /^Stopped waiting\. If your wallet still shows the request, reject it there\.$/],
  ] as const)("says a %s act in its own words, never as failed", (status, words) => {
    render(<ActPhaseLine phase={{ status, key: "k" } as TxActPhase} confirmed="" />);

    const line = screen.getByRole("status");
    expect(line).toHaveTextContent(words);
    expect(line).not.toHaveClass("text-error-dark");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
