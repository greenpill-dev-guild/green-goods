import messages from "@green-goods/shared/i18n/en.json";
import type { Address } from "@green-goods/shared/types/domain";
import type { GardenRole } from "@green-goods/shared/utils/blockchain/garden-roles";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RestoreRolesNotice } from "@/components/Garden/RestoreRolesNotice";
import { renderWithProviders as render } from "../../test-utils";

const MEMBER = "0x2222222222222222222222222222222222222222" as Address;
// What the press reads: the roles the chain lacks, and every role the history records now.
const answer = (lacking: GardenRole[], recordedRoles: GardenRole[]) => ({ lacking, recordedRoles });

describe("RestoreRolesNotice", () => {
  it("restores only the roles the chain still lacks, in one action that names them", async () => {
    // The chain answers which of the asked roles they lack: not Owner, and only Evaluator.
    const check = vi.fn().mockResolvedValue(answer(["owner", "evaluator"], ["steward"]));
    const restore = vi.fn().mockResolvedValue(true);
    render(
      <RestoreRolesNotice
        address={MEMBER}
        roles={["steward"]}
        recordedRoles={["steward"]}
        check={check}
        restore={restore}
      />
    );

    expect(
      screen.getByText("Missing Evaluator and Gardener, which their Steward role includes.")
    ).toBeInTheDocument();
    // Without a batch, each role takes its own signature, and the row says so before the press.
    expect(screen.getByText("Up to 2 signatures")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Restore Evaluator and Gardener" }));

    // The giving Steward role and the Owner hat are read too, so nothing goes to an owner.
    expect(check).toHaveBeenCalledWith(MEMBER, ["steward", "owner", "evaluator", "gardener"]);
    // The indexed list lagged a Gardener grant: only Evaluator goes to the wallet.
    await waitFor(() =>
      expect(restore).toHaveBeenCalledWith(MEMBER, ["evaluator"], expect.any(Function))
    );
    // Only Evaluator was sent, so the line counts one role.
    expect(await screen.findByRole("status")).toHaveTextContent("Role restored.");
    expect(screen.getByRole("button", { name: "Restore Evaluator and Gardener" })).toBeDisabled();
  });

  it("asks the wallet for nothing and says so when the chain already has every role", async () => {
    const restore = vi.fn();
    const onRosterStale = vi.fn();
    render(
      <RestoreRolesNotice
        address={MEMBER}
        roles={["owner", "steward"]}
        recordedRoles={["owner", "steward"]}
        check={vi.fn().mockResolvedValue(answer([], ["owner", "steward"]))}
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
        recordedRoles={["steward", "evaluator"]}
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

  it("offers an owner only Gardener, never the Evaluator the Owner grant does not give", () => {
    render(
      <RestoreRolesNotice
        address={MEMBER}
        roles={["owner", "steward"]}
        recordedRoles={["owner", "steward"]}
        check={vi.fn()}
        restore={vi.fn()}
        signaturesFor={() => 1}
      />
    );
    expect(screen.getByText("1 signature")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Restore Gardener" })).toBeInTheDocument();
    expect(screen.queryByText(/Evaluator/)).not.toBeInTheDocument();
  });

  it("points a viewer who cannot grant a missing role to an owner or steward", () => {
    render(
      <RestoreRolesNotice
        address={MEMBER}
        roles={["owner"]}
        recordedRoles={["owner"]}
        allowedRoles={["steward"]}
        check={vi.fn()}
        restore={vi.fn()}
      />
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(
      screen.getByText("Ask a garden owner or steward to restore this role.")
    ).toBeInTheDocument();
  });

  it("offers nothing for a sub-role ever granted, or while the history is unread", () => {
    const { rerender } = render(
      <RestoreRolesNotice
        address={MEMBER}
        roles={["steward", "gardener"]}
        recordedRoles={["steward", "evaluator", "gardener"]}
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

  it("sends nothing when the giving role is gone by the time the chain is read", async () => {
    const restore = vi.fn();
    const onRosterStale = vi.fn();
    render(
      <RestoreRolesNotice
        address={MEMBER}
        roles={["steward", "gardener"]}
        recordedRoles={["steward", "gardener"]}
        check={vi
          .fn()
          .mockResolvedValue(answer(["steward", "owner", "evaluator"], ["steward", "gardener"]))}
        restore={restore}
        onRosterStale={onRosterStale}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Restore Evaluator" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      messages["admin.manageRoles.restore.changed"]
    );
    expect(restore).not.toHaveBeenCalled();
    expect(onRosterStale).toHaveBeenCalledTimes(1);
  });

  it("starts fresh when a different gap appears after a nothing-missing answer", async () => {
    const props = {
      address: MEMBER,
      check: vi.fn().mockResolvedValue(answer(["owner"], ["steward"])),
      restore: vi.fn(),
    };
    const { rerender } = render(
      <RestoreRolesNotice {...props} roles={["steward", "gardener"]} recordedRoles={["steward"]} />
    );
    await userEvent.click(screen.getByRole("button", { name: "Restore Evaluator" }));
    expect(await screen.findByRole("status")).toBeInTheDocument();

    rerender(<RestoreRolesNotice {...props} roles={["steward"]} recordedRoles={["steward"]} />);
    expect(screen.getByRole("button", { name: "Restore Evaluator and Gardener" })).toBeEnabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("offers a former owner whose Steward came from the Owner grant no Evaluator", () => {
    render(
      <RestoreRolesNotice
        address={MEMBER}
        roles={["steward", "gardener"]}
        recordedRoles={["owner", "steward", "gardener"]}
        check={vi.fn()}
        restore={vi.fn()}
      />
    );

    expect(screen.queryByText(/Missing/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("sends nothing to a steward who became an owner after the list was read", async () => {
    const restore = vi.fn();
    render(
      <RestoreRolesNotice
        address={MEMBER}
        roles={["steward", "gardener"]}
        recordedRoles={["steward", "gardener"]}
        // Owner is no longer missing: someone made them an owner a moment ago.
        check={vi.fn().mockResolvedValue(answer(["evaluator"], ["steward", "gardener"]))}
        restore={restore}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Restore Evaluator" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      messages["admin.manageRoles.restore.changed"]
    );
    expect(restore).not.toHaveBeenCalled();
  });

  it("sends nothing when the history read at the press records an Owner grant since the list", async () => {
    const restore = vi.fn();
    const onRosterStale = vi.fn();
    render(
      <RestoreRolesNotice
        address={MEMBER}
        roles={["steward", "gardener"]}
        recordedRoles={["steward", "gardener"]}
        // Another tab made them an owner and took it back: their Steward now came from an Owner grant.
        check={vi
          .fn()
          .mockResolvedValue(answer(["owner", "evaluator"], ["owner", "steward", "gardener"]))}
        restore={restore}
        onRosterStale={onRosterStale}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Restore Evaluator" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      messages["admin.manageRoles.restore.changed"]
    );
    expect(restore).not.toHaveBeenCalled();
    expect(onRosterStale).toHaveBeenCalledTimes(1);
  });

  it("holds the dialog for the run and sends nothing once the dialog has moved on", async () => {
    let settle: (value: ReturnType<typeof answer> | null) => void = () => undefined;
    const check = vi.fn(
      () => new Promise<ReturnType<typeof answer> | null>((resolve) => (settle = resolve))
    );
    const restore = vi.fn();
    let live = true;
    const end = vi.fn();
    const startRun = vi.fn(() => ({ live: () => live, end }));
    render(
      <RestoreRolesNotice
        address={MEMBER}
        roles={["steward", "gardener"]}
        recordedRoles={["steward", "gardener"]}
        check={check}
        restore={restore}
        startRun={startRun}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Restore Evaluator" }));
    expect(startRun).toHaveBeenCalledTimes(1);
    expect(end).not.toHaveBeenCalled();

    live = false;
    settle(answer(["owner", "evaluator"], ["steward", "gardener"]));

    await waitFor(() => expect(end).toHaveBeenCalledTimes(1));
    expect(restore).not.toHaveBeenCalled();
  });

  it("says the roles could not be checked when the check itself throws", async () => {
    const restore = vi.fn();
    render(
      <RestoreRolesNotice
        address={MEMBER}
        roles={["steward", "evaluator"]}
        recordedRoles={["steward", "evaluator"]}
        check={vi.fn().mockRejectedValue(new Error("rpc down"))}
        restore={restore}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Restore Gardener" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      messages["admin.manageRoles.restore.unread"]
    );
    expect(restore).not.toHaveBeenCalled();
  });

  it("says not every role landed when the grant fails, and still releases the hold", async () => {
    const end = vi.fn();
    render(
      <RestoreRolesNotice
        address={MEMBER}
        roles={["steward"]}
        recordedRoles={["steward"]}
        check={vi.fn().mockResolvedValue(answer(["owner", "evaluator", "gardener"], ["steward"]))}
        restore={vi.fn().mockRejectedValue(new Error("user rejected"))}
        startRun={() => ({ live: () => true, end })}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Restore Evaluator and Gardener" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      messages["admin.manageRoles.restore.failed"]
    );
    expect(end).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Restore Evaluator and Gardener" })).toBeEnabled();
  });
});
