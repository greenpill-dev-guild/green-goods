import {
  useGardenJoinRequestAvailability,
  useGardenJoinRequests,
} from "@green-goods/shared/hooks/garden/useGardenJoinRequests";
import { GardenJoinRequestTransportError } from "@green-goods/shared/modules/garden-join-requests";
import type { GardenJoinRequestSelfRecord } from "@green-goods/shared/public-contracts/join-requests";
import type { Address } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { MemoryRouter } from "react-router-dom";
import { expect, fn, mocked, screen, userEvent, within } from "storybook/test";
import { GardenJoinRequestDialog } from "./GardenJoinRequestDialog";
import { resetHookMocks } from "../../../../../shared/.storybook/moduleMocks";

const GARDEN = "0x749f84ca070cd2f98d9353f49ece77c1a3fed532" as Address;
const ACCOUNT = "0x1111111111111111111111111111111111111111" as Address;
const IDLE = { isLoading: false, error: null };

type JoinRequests = ReturnType<typeof useGardenJoinRequests>;

function joinRequests(overrides: Partial<JoinRequests> = {}): JoinRequests {
  return {
    accountAddress: ACCOUNT,
    request: null,
    hasCheckedStatus: false,
    queue: [],
    nextCursor: undefined,
    rateLimitedRecently: false,
    statusState: IDLE,
    queueState: IDLE,
    mutationState: IDLE,
    checkStatus: fn(async () => null),
    submitRequest: fn(async () => undefined) as unknown as JoinRequests["submitRequest"],
    withdrawRequest: fn(async () => undefined) as unknown as JoinRequests["withdrawRequest"],
    loadQueue: fn(async () => undefined) as unknown as JoinRequests["loadQueue"],
    resolveRequest: fn(async () => undefined) as unknown as JoinRequests["resolveRequest"],
    ...overrides,
  };
}

function selfRequest(
  overrides: Partial<GardenJoinRequestSelfRecord> = {}
): GardenJoinRequestSelfRecord {
  return {
    id: "join-request-1",
    kind: "garden_membership",
    state: "pending",
    revision: 1,
    requestedVia: "garden_detail",
    requestedAt: "2026-09-10T12:00:00.000Z",
    expiresAt: "2026-09-24T12:00:00.000Z",
    canAskAgain: false,
    ...overrides,
  };
}

function withJoinRequests(overrides: Partial<JoinRequests> = {}) {
  return () => {
    mocked(useGardenJoinRequestAvailability).mockReturnValue(true);
    mocked(useGardenJoinRequests).mockReturnValue(joinRequests(overrides));
    return resetHookMocks(useGardenJoinRequestAvailability, useGardenJoinRequests);
  };
}

async function openSheet() {
  await userEvent.click(await screen.findByRole("button", { name: "Request to Join" }));
  return within(await screen.findByRole("dialog", { name: "Request to Join This Garden" }));
}

/**
 * A person outside a closed garden asks to join it. The sheet follows the request through each
 * state the garden stewards and the agent API can return, with the actions pinned in the shared
 * bar (DL-016). The data hook is mocked per story; the sheet itself is the real component.
 */
const meta: Meta<typeof GardenJoinRequestDialog> = {
  title: "Client/Sheets/Request to Join",
  component: GardenJoinRequestDialog,
  tags: ["autodocs", "storybook-ci"],
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile" } },
  args: { gardenAddress: GARDEN },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div className="min-h-[640px] p-4">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof GardenJoinRequestDialog>;

export const RequestForm: Story = {
  beforeEach: withJoinRequests(),
  play: async () => {
    const sheet = await openSheet();
    const send = sheet.getByRole("button", { name: "Send Request" });
    const check = sheet.getByRole("button", { name: "Check Request Status" });
    await expect(send).toBeDisabled();
    await expect(send.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      check.getBoundingClientRect().top
    );
    await userEvent.type(sheet.getByRole("textbox", { name: "Display name" }), "Ana");
    await expect(send).toBeEnabled();
  },
};

export const Sending: Story = {
  beforeEach: withJoinRequests({ mutationState: { isLoading: true, error: null } }),
  play: async () => {
    const sheet = await openSheet();
    const send = sheet.getByRole("button", { name: "Send Request" });
    await expect(send).toHaveAttribute("aria-busy", "true");
    await expect(sheet.getByRole("button", { name: "Check Request Status" })).toBeDisabled();
  },
};

export const CouldNotConfirm: Story = {
  beforeEach: withJoinRequests({
    submitRequest: fn(async () => {
      throw new GardenJoinRequestTransportError("timeout", undefined, undefined, true);
    }) as unknown as JoinRequests["submitRequest"],
  }),
  play: async () => {
    const sheet = await openSheet();
    await userEvent.type(sheet.getByRole("textbox", { name: "Display name" }), "Ana");
    await userEvent.click(sheet.getByRole("button", { name: "Send Request" }));
    await expect(
      await sheet.findByText(
        "We could not confirm whether your request was saved. Check its status before trying again."
      )
    ).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Send Request" })).toBeDisabled();
  },
};

export const RequestFailed: Story = {
  beforeEach: withJoinRequests({
    mutationState: {
      isLoading: false,
      error: new GardenJoinRequestTransportError("member", 409, "already_member"),
    },
  }),
  play: async () => {
    const sheet = await openSheet();
    await expect(sheet.getByText("You are already a member of this garden.")).toBeVisible();
  },
};

export const NoRequestYet: Story = {
  beforeEach: withJoinRequests({ hasCheckedStatus: true }),
  play: async () => {
    const sheet = await openSheet();
    await expect(sheet.getByText("You do not have a request for this garden yet.")).toBeVisible();
  },
};

export const Declined: Story = {
  beforeEach: withJoinRequests({
    hasCheckedStatus: true,
    request: selfRequest({
      state: "declined",
      resolvedAt: "2026-09-11T09:30:00.000Z",
      reason: "We are full for this season. Ask again in March.",
      canAskAgain: true,
    }),
  }),
  play: async () => {
    const sheet = await openSheet();
    await expect(sheet.getByText("This request was declined")).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Send Request" })).toBeVisible();
  },
};

export const Pending: Story = {
  beforeEach: withJoinRequests({ hasCheckedStatus: true, request: selfRequest() }),
  play: async () => {
    const sheet = await openSheet();
    await expect(sheet.getByText("Request awaiting review")).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Withdraw Request" })).toBeVisible();
    await expect(sheet.queryByRole("button", { name: "Send Request" })).not.toBeInTheDocument();
  },
};

export const Welcomed: Story = {
  beforeEach: withJoinRequests({
    hasCheckedStatus: true,
    request: selfRequest({ state: "welcomed", resolvedAt: "2026-09-11T09:30:00.000Z" }),
  }),
  play: async () => {
    const sheet = await openSheet();
    await expect(sheet.getByText("Welcome to the garden")).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Claim a Username" })).toBeVisible();
  },
};
