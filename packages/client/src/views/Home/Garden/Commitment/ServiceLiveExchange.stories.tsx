import { useServiceIssuerOperations } from "@green-goods/shared/commitment-pooling";
import { resetHookMocks } from "../../../../../../shared/.storybook/moduleMocks";
import type { Meta, StoryObj } from "@storybook/react";
import { fn, mocked, userEvent, within, expect } from "storybook/test";
import {
  issuerStoryAssets,
  issuerStorySnapshot,
  ISSUER_STORY_ADDRESS,
} from "@/views/Profile/serviceIssuerStoryFixtures";
import { ServiceLiveExchange } from "./ServiceLiveExchange";

/** Fictional picker only. Its route is unconfigured, so choosing it cannot submit a live swap. */
const meta: Meta<typeof ServiceLiveExchange> = {
  title: "Client/Garden/ServiceLiveExchange",
  component: ServiceLiveExchange,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  beforeEach: ({ args }) => {
    mocked(args.onRefresh).mockReset().mockResolvedValue(undefined);
    const refuse = fn(async () => {
      throw new Error("Fictional Storybook operation unavailable");
    });
    mocked(useServiceIssuerOperations).mockReturnValue({
      snapshot: {
        data: {
          ...issuerStorySnapshot(),
          actor: {
            ...issuerStorySnapshot().actor,
            routeId: "fictional-story",
            poolId: "fictional-local",
          },
        },
        isLoading: false,
        isError: false,
        refetch: fn().mockResolvedValue(undefined),
      },
      quote: { mutateAsync: refuse },
      review: { mutateAsync: refuse },
      execute: { mutateAsync: refuse },
      reconcile: { mutateAsync: refuse },
    } as unknown as ReturnType<typeof useServiceIssuerOperations>);
    return resetHookMocks(useServiceIssuerOperations);
  },
  argTypes: { choices: { control: false } },
  args: {
    account: ISSUER_STORY_ADDRESS,
    choices: [
      {
        key: "fictional-local",
        routeId: "fictional-story",
        poolId: "fictional-local",
        poolName: "Fictional local garden",
        input: issuerStoryAssets[0]!,
        output: issuerStoryAssets[1]!,
        held: 1_000_000n,
        requiredOutput: 2_000_000n,
      },
    ],
    onClose: fn(),
    onRefresh: fn(),
  },
};
export default meta;
type Story = StoryObj<typeof ServiceLiveExchange>;
export const ChooseExchange: Story = {
  play: async ({ canvasElement }) => {
    const ui = within(canvasElement.ownerDocument.body);
    await userEvent.selectOptions(ui.getByRole("combobox"), "fictional-local");
    await expect(ui.getByText(/Vouchers Needed for This Service/)).toBeVisible();
  },
};
