import { useActions, useGardens } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import { useGardenCommitmentController } from "@green-goods/shared/hooks/client-ui/commitment/useGardenCommitmentController";
import {
  useCommitmentActivity,
  useCommitmentCycle,
} from "@green-goods/shared/hooks/commitment-pooling/useCommitmentPooling";
import { useGreenGoodsEnsName } from "@green-goods/shared/hooks/ens/useGreenGoodsEnsName";
import ptMessages from "@green-goods/shared/i18n/pt";
import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { IntlProvider } from "react-intl";
import { Route, Routes } from "react-router-dom";
import { expect, mocked, within } from "storybook/test";
import {
  AUTUMN_PLANTING,
  JOURNEY_CYCLE_NAMES,
  JOURNEY_GARDEN,
  JOURNEY_NAMES,
  PROMISE_PAGE_SEEDS,
  promisePageFixture,
} from "../../../../../../shared/.storybook/clientJourneyFixtures";
import {
  withAppPage,
  withRouter,
  withSeededQueryClient,
} from "../../../../../../shared/.storybook/decorators";
import { resetHookMocks } from "../../../../../../shared/.storybook/moduleMocks";
import { GardenCommitment } from "./GardenCommitment";

/** The page reads its garden and promise from the route, as the app mounts it. */
const withPromiseRoute: Decorator = (Story) => (
  <Routes>
    <Route path="/home/:id/commitments/:commitmentId" element={<Story />} />
  </Routes>
);

const withPortuguese: Decorator = (Story) => (
  <IntlProvider locale="pt" messages={ptMessages}>
    <Story />
  </IntlProvider>
);

/**
 * The page's controller, the history and place its sections read, and the
 * neighbours' names, for one stage of the fence repair.
 */
const atStage = (stage: Parameters<typeof promisePageFixture>[0]) => () => {
  const { controller, history } = promisePageFixture(stage);
  mocked(useGardenCommitmentController).mockReturnValue(controller);
  mocked(useCommitmentActivity).mockReturnValue({
    events: history,
    isError: false,
  } as unknown as ReturnType<typeof useCommitmentActivity>);
  mocked(useCommitmentCycle).mockReturnValue({
    cycle: AUTUMN_PLANTING,
  } as unknown as ReturnType<typeof useCommitmentCycle>);
  mocked(useGardens).mockReturnValue({
    data: [{ id: JOURNEY_GARDEN, name: "Riverside Commons Garden" }],
  } as unknown as ReturnType<typeof useGardens>);
  mocked(useActions).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useActions>);
  mocked(useGreenGoodsEnsName).mockImplementation(
    (address) =>
      ({ data: address ? (JOURNEY_NAMES[address.toLowerCase()] ?? null) : null }) as ReturnType<
        typeof useGreenGoodsEnsName
      >
  );
  mocked(useEnsName).mockReturnValue({ data: null } as ReturnType<typeof useEnsName>);
  return resetHookMocks(
    useGardenCommitmentController,
    useCommitmentActivity,
    useCommitmentCycle,
    useGardens,
    useActions,
    useGreenGoodsEnsName,
    useEnsName
  );
};

/**
 * A promise on its own page: the title that wraps, where it lives, one status
 * block, what was promised as labelled facts, progress and proof, its history,
 * and the acts on one row. Fictional data from the design frames.
 */
const meta: Meta<typeof GardenCommitment> = {
  title: "Client/Commitments/GardenCommitment",
  component: GardenCommitment,
  parameters: { layout: "fullscreen" },
  decorators: [
    withPromiseRoute,
    withRouter([`/home/${JOURNEY_GARDEN}/commitments/9`]),
    withSeededQueryClient([...JOURNEY_CYCLE_NAMES, ...PROMISE_PAGE_SEEDS]),
    withAppPage,
  ],
};

export default meta;
type Story = StoryObj<typeof GardenCommitment>;

/** Amara leads the repair and has proof to add: Link Work and Add Proof share one row. */
export const InProgress: Story = {
  tags: ["storybook-ci"],
  beforeEach: atStage("working"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Autumn Planting 2026")).toBeVisible();
    await expect(canvas.getByText("Riverside Commons Garden")).toBeVisible();
    // The status sentence names who confirms it, the same person the facts tag as steward.
    await expect(canvas.getByRole("region", { name: "Where this stands" })).toHaveTextContent(
      "send it to tomas to confirm"
    );
    await expect(canvas.getByText("Steward")).toBeVisible();
    // The title wraps rather than truncating: it never clips, however wide the page.
    const title = canvas.getByRole("heading", { level: 1 });
    await expect(getComputedStyle(title).whiteSpace).toBe("normal");
    await expect(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth);
    // The primary sits right of the secondary, both 48px, on one row.
    const link = canvas.getByRole("button", { name: "Link Work" });
    const proof = canvas.getByRole("button", { name: "Add Proof" });
    const [linkBox, proofBox] = [link.getBoundingClientRect(), proof.getBoundingClientRect()];
    await expect(linkBox.top).toBe(proofBox.top);
    await expect(proofBox.left).toBeGreaterThan(linkBox.left);
    await expect(proofBox.height).toBe(48);
    await expect(Math.abs(linkBox.width - proofBox.width)).toBeLessThanOrEqual(1);
  },
};

/** Sent today: nothing waits on Amara, so there is no bar, and History leads with the send. */
export const WaitingOnSteward: Story = {
  tags: ["storybook-ci"],
  beforeEach: atStage("waiting"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("button", { name: "Add Proof" })).toBeNull();
    const history = canvas.getByRole("region", { name: "History" });
    const lines = within(history).getAllByRole("listitem");
    await expect(lines[0]).toHaveTextContent("You sent it for confirmation");
    await expect(lines[0]).toHaveAttribute("data-latest", "true");
  },
};

/** Kept: one line says who confirmed it, never a second "It was kept" from the same transaction. */
export const Kept: Story = {
  tags: ["storybook-ci"],
  beforeEach: atStage("kept"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The sentence says who confirmed it, so no second "Confirmed by" line repeats it.
    const status = canvas.getByRole("region", { name: "Where this stands" });
    await expect(status).toHaveTextContent("tomas confirmed it was kept");
    await expect(status.querySelector("[data-component=ConfirmProvenance]")).toBeNull();
    const history = canvas.getByRole("region", { name: "History" });
    await expect(within(history).getByText(/confirmed it was kept/)).toBeVisible();
    await expect(within(history).queryByText("It was kept")).toBeNull();
  },
};

/** Portuguese labels: one row while both fit, the primary on top once they don't (D11). */
export const TwoActsInPortuguese: Story = {
  decorators: [withPortuguese],
  beforeEach: atStage("working"),
};
