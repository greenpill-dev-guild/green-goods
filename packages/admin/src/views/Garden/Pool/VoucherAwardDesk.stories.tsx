import { SERVICE_ISSUER_ROUTES, useVoucherAwards } from "@green-goods/shared/commitment-pooling";
import { useUser } from "@green-goods/shared/hooks/auth/useUser";
import type { Meta, StoryObj } from "@storybook/react";
import { fn, mocked } from "storybook/test";
import { resetHookMocks } from "../../../../../shared/.storybook/moduleMocks";
import { VoucherAwardDesk } from "./VoucherAwardDesk";
import { STORY_TECH_AND_SUN_VOUCHERS } from "./poolStoryVouchers";
const issuer = SERVICE_ISSUER_ROUTES[0]!.assets[0]!;
const account = "0x4444444444444444444444444444444444444444" as const;
const meta: Meta<typeof VoucherAwardDesk> = {
  title: "Admin/Pool/VoucherAwardDesk",
  component: VoucherAwardDesk,
  tags: ["autodocs"],
  argTypes: { reserve: { control: false } },
  args: {
    reserve: {
      ...STORY_TECH_AND_SUN_VOUCHERS.reserve!,
      issuer: { ...STORY_TECH_AND_SUN_VOUCHERS.reserve!.issuer, safe: issuer.ownerReserve },
    },
    disabled: false,
    onClose: fn(),
  },
  beforeEach: () => {
    const refuse = fn(async () => {
      throw new Error("Fictional Storybook operation unavailable");
    });
    const mutation = { isPending: false, mutateAsync: refuse };
    mocked(useUser).mockReturnValue({
      user: { id: account, wallet: { address: account } },
      ready: true,
      eoa: { address: account },
      smartAccountAddress: null,
      smartAccountClient: null,
      resolveSmartAccountClient: null,
      passkeyAccountProfile: null,
      authMode: "wallet",
      userName: null,
      ensName: null,
      externalWalletConnected: true,
      externalWalletAddress: account,
      primaryAddress: account,
    });
    mocked(useVoucherAwards).mockReturnValue({
      records: [],
      isLimited: false,
      load: mutation,
      prepare: mutation,
      send: mutation,
      recover: mutation,
      reconcile: mutation,
      directSigningAvailable: false,
    } as unknown as ReturnType<typeof useVoucherAwards>);
    return resetHookMocks(useUser, useVoucherAwards);
  },
};
export default meta;
type Story = StoryObj<typeof VoucherAwardDesk>;
/** Canonical reserve identity for discovery only; every operation is mocked and refuses. */
export const ExplicitLoad: Story = {};
