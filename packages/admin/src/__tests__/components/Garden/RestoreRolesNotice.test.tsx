import messages from "@green-goods/shared/i18n/en.json";
import type { Address } from "@green-goods/shared/types/domain";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RestoreRolesNotice } from "@/components/Garden/RestoreRolesNotice";
import { renderWithProviders as render } from "../../test-utils";

const MEMBER = "0x2222222222222222222222222222222222222222" as Address;

describe("RestoreRolesNotice", () => {
  it("restores only the roles the chain still lacks, in one action that names them", async () => {
    const check = vi.fn().mockResolvedValue(["evaluator"]);
    const restore = vi.fn().mockResolvedValue(true);
    render(
      <RestoreRolesNotice
        address={MEMBER}
        roles={["steward"]}
        revokedRoles={[]}
        check={check}
        restore={restore}
      />
    );

    expect(
      screen.getByText("Missing Evaluator and Gardener, which their Steward role includes.")
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Restore Evaluator and Gardener" }));

    expect(check).toHaveBeenCalledWith(MEMBER, ["evaluator", "gardener"]);
    // The indexed list lagged a Gardener grant: only Evaluator goes to the wallet.
    await waitFor(() => expect(restore).toHaveBeenCalledWith(MEMBER, ["evaluator"]));
  });

  it("asks the wallet for nothing and says so when the chain already has every role", async () => {
    const restore = vi.fn();
    const onRosterStale = vi.fn();
    render(
      <RestoreRolesNotice
        address={MEMBER}
        roles={["owner", "steward"]}
        revokedRoles={[]}
        check={vi.fn().mockResolvedValue([])}
        restore={restore}
        onRosterStale={onRosterStale}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Restore Gardener" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      messages["admin.manageRoles.restore.nothing"]
    );
    expect(restore).not.toHaveBeenCalled();
    expect(onRosterStale).toHaveBeenCalledTimes(1);
  });

  it("sends nothing when the chain cannot be read", async () => {
    const restore = vi.fn();
    render(
      <RestoreRolesNotice
        address={MEMBER}
        roles={["steward", "evaluator"]}
        revokedRoles={[]}
        check={vi.fn().mockResolvedValue(null)}
        restore={restore}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Restore Gardener" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      messages["admin.manageRoles.restore.unread"]
    );
    expect(restore).not.toHaveBeenCalled();
  });

  it("never offers an owner the Evaluator role, which the Owner grant does not give", () => {
    render(
      <RestoreRolesNotice
        address={MEMBER}
        roles={["owner", "steward", "gardener"]}
        revokedRoles={[]}
        check={vi.fn()}
        restore={vi.fn()}
      />
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/Missing/)).not.toBeInTheDocument();
  });

  it("points a viewer who cannot grant a missing role to an owner", () => {
    render(
      <RestoreRolesNotice
        address={MEMBER}
        roles={["owner"]}
        revokedRoles={[]}
        allowedRoles={["steward"]}
        check={vi.fn()}
        restore={vi.fn()}
      />
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText(messages["admin.manageRoles.restore.ownerOnly"])).toBeInTheDocument();
  });

  it("offers nothing for a sub-role revoked on purpose, or while the history is unread", () => {
    const { rerender } = render(
      <RestoreRolesNotice
        address={MEMBER}
        roles={["steward", "gardener"]}
        revokedRoles={["evaluator"]}
        check={vi.fn()}
        restore={vi.fn()}
      />
    );
    expect(screen.queryByText(/Missing/)).not.toBeInTheDocument();

    rerender(
      <RestoreRolesNotice
        address={MEMBER}
        roles={["steward", "gardener"]}
        check={vi.fn()}
        restore={vi.fn()}
      />
    );
    expect(screen.queryByText(/Missing/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
