/**
 * ComposeCommitment — making a commitment.
 *
 * The other surface nothing mounted. What matters here is that a member cannot
 * place something nobody could recognise, that the last screen says what
 * placing it does to other people rather than reading the form back, and that
 * the whole thing works with no signal.
 *
 * @vitest-environment jsdom
 */

import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../test-utils";

const VIEWER = "0x1111111111111111111111111111111111111111" as const;
const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;

const mockUseOffline = vi.fn();
const mockUsePools = vi.fn();
const mockEnqueue = vi.fn();

vi.mock("@green-goods/shared", async () => {
  const actual = await vi.importActual<typeof import("@green-goods/shared")>("@green-goods/shared");
  return {
    ...actual,
    DEFAULT_CHAIN_ID: 42161,
    usePrimaryAddress: () => VIEWER,
    useCommitmentPools: () => mockUsePools(),
    useCommitmentJobs: () => ({
      enqueue: mockEnqueue,
      isPending: false,
      error: null,
      viewer: VIEWER,
    }),
    useOffline: () => mockUseOffline(),
  };
});

const { ComposeCommitment } = await import("../../views/Home/Garden/Compose");

const render = () =>
  renderWithProviders(
    <MemoryRouter initialEntries={[`/home/${GARDEN}/commitments/new`]}>
      <Routes>
        <Route path="/home/:id/commitments/new" element={<ComposeCommitment />} />
      </Routes>
    </MemoryRouter>
  );

/** Walk the first two beats with a usable answer. */
async function fillWhat(user: ReturnType<typeof userEvent.setup>, title = "Compost workshop") {
  await user.click(screen.getByRole("button", { name: "Next" }));
  await user.type(screen.getByLabelText("Name it"), title);
  await user.clear(screen.getByLabelText("How many"));
  await user.type(screen.getByLabelText("How many"), "3");
  await user.type(screen.getByLabelText("Of what"), "hours");
}

describe("ComposeCommitment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOffline.mockReturnValue({ isOnline: true });
    mockUsePools.mockReturnValue({ pools: [{ poolId: 7n, openSeasonCycleId: null }] });
    mockEnqueue.mockResolvedValue("job-1");
  });

  it("asks which side of the exchange this is, before anything else", () => {
    render();
    expect(screen.getByText("What are you doing?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Offering something/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Asking for something/ })).toBeInTheDocument();
  });

  it("will not let a member place something nobody could recognise", async () => {
    const user = userEvent.setup();
    render();
    await user.click(screen.getByRole("button", { name: "Next" }));

    // The name is what neighbours see in the pool; without it the row can only
    // describe the record back to them.
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    await user.type(screen.getByLabelText("Name it"), "Compost workshop");
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    await user.type(screen.getByLabelText("Of what"), "hours");
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("says what is missing rather than only disabling the control", async () => {
    const user = userEvent.setup();
    render();
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText(/Give it a name/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Name it"), "Compost workshop");
    expect(screen.getByText(/Say what you are counting/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Of what"), "hours");
    expect(screen.queryByText(/Give it a name/i)).not.toBeInTheDocument();
  });

  it("takes the wording of each beat from the side they chose", async () => {
    const user = userEvent.setup();
    render();
    await user.click(screen.getByRole("button", { name: /Asking for something/ }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("What are you asking for?")).toBeInTheDocument();
  });

  it("says what placing it does to other people, not what was typed", async () => {
    const user = userEvent.setup();
    render();
    await fillWhat(user);
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("Before you place this")).toBeInTheDocument();
    expect(screen.getByText(/you can no longer withdraw it/i)).toBeInTheDocument();
  });

  it("warns that it will wait when the phone has no signal", async () => {
    const user = userEvent.setup();
    mockUseOffline.mockReturnValue({ isOnline: false });
    render();
    await fillWhat(user);
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText(/will wait on your phone/i)).toBeInTheDocument();
  });

  it("refuses to place into a garden with no pool", async () => {
    const user = userEvent.setup();
    mockUsePools.mockReturnValue({ pools: [] });
    render();
    await fillWhat(user);
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText(/no pool to place it in yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Place this commitment" })).toBeDisabled();
  });

  it("queues the commitment with the member's own words attached", async () => {
    const user = userEvent.setup();
    render();
    await fillWhat(user);
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Place this commitment" }));

    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    const call = mockEnqueue.mock.calls[0]?.[0] as {
      act: string;
      payload: {
        metadataCID: string;
        metadata: { title: string };
        unitLabel: string;
        targetUnits: bigint;
        direction: number;
      };
    };
    expect(call.act).toBe("create");
    expect(call.payload.metadata.title).toBe("Compost workshop");
    // The words travel with the job; the executor publishes them, so composing
    // never needs a connection.
    expect(call.payload.metadataCID).toBe("");
    expect(call.payload.unitLabel).toBe("hours");
    expect(call.payload.targetUnits).toBe(3n);
    expect(call.payload.direction).toBe(0);
  });

  it("tells a member on a dead connection that it is saved, not sent", async () => {
    const user = userEvent.setup();
    mockUseOffline.mockReturnValue({ isOnline: false });
    render();
    await fillWhat(user);
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Place this commitment" }));

    expect(await screen.findByText("Saved on this phone")).toBeInTheDocument();
  });

  it("stays on the review when the commitment could not be queued", async () => {
    const user = userEvent.setup();
    mockEnqueue.mockRejectedValue(new Error("no sender"));
    render();
    await fillWhat(user);
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Place this commitment" }));

    // A failed enqueue must not read as success; the member keeps their draft.
    expect(screen.queryByText("It is on its way")).not.toBeInTheDocument();
    expect(screen.getByText("Before you place this")).toBeInTheDocument();
  });
});
