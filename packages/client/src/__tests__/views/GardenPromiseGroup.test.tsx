/**
 * GardenPromiseGroup Tests — a group's page, wired to its controller.
 *
 * The choice of copy and the send are proven in Shared. These pin what the
 * page itself must wire: on the protocol pool the person chooses who takes it
 * up before the sheet, and that choice is what the act sends; Try Again after
 * a failed send asks for the same copy, never a new choice; and the copy a
 * link names reaches the controller.
 *
 * @vitest-environment happy-dom
 */

import userEvent from "@testing-library/user-event";
import type { PromiseGroupController } from "@green-goods/shared/hooks/client-ui/pool/usePromiseGroupController";
import type { Address } from "@green-goods/shared/types/domain";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { storyGroup } from "../../components/Features/Commitments/promiseGroupStoryFixtures";
import { GardenPromiseGroup } from "../../views/Home/Garden/PromiseGroup/GardenPromiseGroup";
import { renderWithProviders, screen, within } from "../test-utils";

const HER_GARDEN = "0x5555555555555555555555555555555555555555" as Address;
const SHE_STEWARDS = "0x6666666666666666666666666666666666666666" as Address;

const mockController = vi.fn();
vi.mock("@green-goods/shared/hooks/client-ui/pool/usePromiseGroupController", () => ({
  usePromiseGroupController: (input: unknown) => mockController(input),
}));

const start = vi.fn();
const retry = vi.fn();

function controller(overrides: Partial<PromiseGroupController> = {}): PromiseGroupController {
  const { group, sample } = storyGroup({ available: 4, inProgress: 3, kept: 3 });
  return {
    status: "ready",
    isOnline: true,
    group,
    sample,
    metadata: null,
    counts: group.counts,
    availabilityKnown: true,
    yours: [],
    bar: { act: "takeUp", hold: null },
    cap: null,
    isMember: true,
    claimNeedsContext: false,
    claimGardens: { member: [], stewarded: [] },
    garden: null,
    queueUnreadable: false,
    takeUp: { state: { step: "idle" }, start, confirm: vi.fn(), retry, reset: vi.fn() },
    refresh: vi.fn(),
    ...overrides,
  };
}

const render = (path = "/home/0xgarden/commitments/group/set-1") =>
  renderWithProviders(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/home/:id/commitments/group/:groupId" element={<GardenPromiseGroup />} />
      </Routes>
    </MemoryRouter>
  );

describe("GardenPromiseGroup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens the take-up sheet straight away on a garden pool", async () => {
    mockController.mockReturnValue(controller());
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole("button", { name: "Take Up One" }));
    const sheet = await screen.findByRole("dialog");
    await user.click(within(sheet).getByRole("button", { name: "Take Up One" }));

    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith(null);
  });

  it("on the protocol pool, sends in the context the person chose before the sheet", async () => {
    mockController.mockReturnValue(
      controller({
        claimNeedsContext: true,
        claimGardens: {
          member: [{ address: HER_GARDEN, name: "Mill Lane" }],
          stewarded: [{ address: SHE_STEWARDS, name: "River Farm" }],
        },
      })
    );
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole("button", { name: "Take Up One" }));
    const chooser = await screen.findByRole("dialog");
    await user.click(within(chooser).getByRole("radio", { name: /River Farm/ }));
    await user.click(within(chooser).getByRole("button", { name: "Continue" }));
    expect(start).not.toHaveBeenCalled();

    const sheet = await screen.findByRole("dialog");
    await user.click(within(sheet).getByRole("button", { name: "Take Up One" }));

    expect(start).toHaveBeenCalledWith({ kind: "garden", garden: SHE_STEWARDS });
  });

  it("tries the same copy again after a send that didn't go through", async () => {
    const failed = controller();
    mockController.mockReturnValue(failed);
    const user = userEvent.setup();
    const { rerender } = render();
    await user.click(screen.getByRole("button", { name: "Take Up One" }));

    mockController.mockReturnValue({
      ...failed,
      takeUp: {
        ...failed.takeUp,
        state: {
          step: "failed",
          copyId: 101n,
          context: { kind: "personal", garden: HER_GARDEN },
        },
      },
    });
    rerender(
      <MemoryRouter initialEntries={["/home/0xgarden/commitments/group/set-1"]}>
        <Routes>
          <Route path="/home/:id/commitments/group/:groupId" element={<GardenPromiseGroup />} />
        </Routes>
      </MemoryRouter>
    );
    const sheet = await screen.findByRole("dialog");
    await user.click(within(sheet).getByRole("button", { name: "Try Again" }));

    expect(retry).toHaveBeenCalledTimes(1);
    expect(start).not.toHaveBeenCalled();
  });

  it("passes the copy a link names, so a reload finds the same group", () => {
    mockController.mockReturnValue(controller());
    render("/home/0xgarden/commitments/group/set-1?copy=104");

    expect(mockController).toHaveBeenCalledWith(
      expect.objectContaining({ displayGroupId: "set-1", copyId: "104" })
    );
  });
});
