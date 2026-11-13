// TEST-QUALITY: allow-small-test-file - HomeJournal.test.tsx stands the + in as a marker, and these cases need the real component with its pool and access reads mocked.
/**
 * Offer or Ask on Home (DL-181): the garden page's + over Home's journal. It reads the garden's
 * pool as the garden page does, shows to the readers that pool's Promises tab shows it to, and
 * opens the composer as the next page. The pool and access reads are mocked; the router and
 * the app's own page-to-page navigation run for real.
 *
 * @vitest-environment happy-dom
 */

import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, within } from "../test-utils";

const GARDEN = "0x5000000000000000000000000000000000000001";

const mocks = vi.hoisted(() => ({
  pools: [] as Array<{ poolId: bigint; garden: string }>,
  canCreate: true,
  poolsRead: vi.fn(),
  accessRead: vi.fn(),
}));

vi.mock("@green-goods/shared/hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => "0xb0b0000000000000000000000000000000000002",
}));
vi.mock("@green-goods/shared/hooks/commitment-pooling/useCommitmentPooling", () => ({
  useCommitmentPools: (input: unknown) => {
    mocks.poolsRead(input);
    return { pools: mocks.pools };
  },
}));
vi.mock("@green-goods/shared/hooks/client-ui/pool/useGardenPoolController", () => ({
  usePoolAccess: (pool: unknown) => {
    mocks.accessRead(pool);
    return { canCreate: mocks.canCreate, stewardsPool: false };
  },
}));

const { OfferOrAsk } = await import("../../views/Home/Journal/OfferOrAsk");
const { HomeShownContext } = await import("../../views/Home/Journal/homeShown");

function Composer() {
  const { pathname, search } = useLocation();
  return <p data-testid="composer">{pathname + search}</p>;
}

function renderOnHome({ shown = true } = {}) {
  return renderWithProviders(
    <MemoryRouter initialEntries={["/home"]}>
      <Routes>
        <Route
          path="/home"
          element={
            <HomeShownContext value={shown}>
              <OfferOrAsk gardenId={GARDEN} />
            </HomeShownContext>
          }
        />
        <Route path="/home/:id/commitments/new" element={<Composer />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Home's Offer or Ask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pools = [{ poolId: 4n, garden: GARDEN.toLowerCase() }];
    mocks.canCreate = true;
  });

  it("shows the + to a reader the garden's pool takes, and a door opens the composer", async () => {
    const user = userEvent.setup();
    renderOnHome();
    // The garden's pool is the first the indexer lists for it, as on the garden page.
    expect(mocks.poolsRead).toHaveBeenCalledWith(expect.objectContaining({ garden: GARDEN }));
    expect(mocks.accessRead).toHaveBeenLastCalledWith(mocks.pools[0]);

    await user.click(screen.getByRole("button", { name: "Offer or Ask" }));
    const sheet = within(await screen.findByRole("dialog", { name: "Offer or Ask" }));
    await user.click(sheet.getByRole("button", { name: /^Ask/ }));
    expect(screen.getByTestId("composer")).toHaveTextContent(
      `/home/${GARDEN}/commitments/new?direction=request`
    );
  });

  it("draws no + for a reader the pool does not take, or while Home is out of sight", () => {
    mocks.canCreate = false;
    const { unmount } = renderOnHome();
    expect(screen.queryByRole("button", { name: "Offer or Ask" })).toBeNull();
    unmount();

    // A page Home opened is on screen: the + leaves with Home.
    mocks.canCreate = true;
    renderOnHome({ shown: false });
    expect(screen.queryByRole("button", { name: "Offer or Ask" })).toBeNull();
  });
});
