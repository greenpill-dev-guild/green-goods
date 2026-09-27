import {
  buildEnvelope,
  type OperationView,
  type ResourceView,
  resolveReportingDeployment,
} from "@green-goods/shared/modules/agent-reporting";
import type { Meta, StoryObj } from "@storybook/react";
import { HelmetProvider } from "react-helmet-async";
import { FocusedSiteHeader } from "@/components/Navigation/FocusedSiteHeader";
import { CeremonyView } from "./CeremonyView";
import ReportingPermissionsPage from "./PermissionsPage";
import { RecoveryView } from "./RecoveryView";

const ACCOUNT = "0x1f3a9c2b7d4e5f60718293a4b5c6d7e8f9012345";
const noop = () => {};
const asyncNoop = async () => {};

const envelope = buildEnvelope(resolveReportingDeployment(42161), {
  kind: "work",
  operationId: "op-story",
  revision: 4,
  chainId: 42161,
  accountAddress: ACCOUNT,
  gardenAddress: "0x00000000000000000000000000000000000000c2",
  clientWorkId: "cw-story",
  actionDefinitionDigest: `0x${"12".repeat(32)}`,
  fields: {
    actionUID: "7",
    title: "Planted baobab seedlings",
    feedback: "Planted twelve baobab seedlings along the fence and watered them.",
    metadata: "bafkreimetadata",
    media: ["bafkreiphoto1", "bafkreiphoto2"],
  },
  media: [],
  metadataDigest: `0x${"34".repeat(32)}`,
});

const operation: OperationView = {
  operationId: "op-story",
  kind: "work",
  state: "prepared",
  authorizationMode: "owner",
  attemptVersion: 0,
  envelope,
  attempt: null,
  transactionHash: null,
  attestationUid: null,
  failureCode: null,
};

const resource: ResourceView = {
  ok: true,
  kind: "draft",
  resourceId: "draft-story",
  revision: 4,
  state: "publishing",
  gardenLabel: "TAS Hub",
  title: "Planted baobab seedlings",
  lines: [
    { label: "Activity", value: "Tree planting" },
    { label: "Time spent", value: "3 h" },
    {
      label: "Description",
      value: "Planted twelve baobab seedlings along the fence and watered them.",
    },
    { label: "Seedlings planted", value: "12" },
    { label: "Species", value: "Baobab" },
  ],
  evidence: [
    { assetId: "a1", mime: "image/jpeg", digest: "d1" },
    { assetId: "a2", mime: "image/jpeg", digest: "d2" },
  ],
  summaryDigest: `0x${"78".repeat(32)}`,
  operation,
};

type Props = Parameters<typeof CeremonyView>[0];
const base: Props = {
  stage: "intro",
  purpose: null,
  channelLabel: "WhatsApp",
  pairingCode: null,
  resource: null,
  operation: null,
  issues: [],
  error: null,
  account: null,
  connecting: false,
  connectWallet: noop,
  connectPasskey: asyncNoop,
  start: asyncNoop,
  prove: asyncNoop,
  publish: asyncNoop,
  leave: asyncNoop,
};

const meta: Meta<typeof CeremonyView> = {
  title: "Client/Public/AgentReporting/Ceremony",
  component: CeremonyView,
  args: base,
  decorators: [
    (Story) => (
      <HelmetProvider>
        <div className="min-h-screen bg-bg-white-0">
          <FocusedSiteHeader />
          <Story />
        </div>
      </HelmetProvider>
    ),
  ],
  parameters: {
    // The focused shell renders without the website surface: app corners for fields and buttons.
    surface: "app",
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "`/agent/reporting/:requestId` — the browser step of a chat report or review. One " +
          "step at a time under the focused header: continue, prove the account, pair through " +
          "the chat, check the exact frozen publication, sign, then follow it to the chain.",
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof CeremonyView>;

export const Intro: Story = {};
export const Connect: Story = { args: { stage: "connect", purpose: "publish_work" } };
export const ProveConnected: Story = {
  args: { stage: "connect", purpose: "publish_work", account: ACCOUNT },
};
export const Pairing: Story = {
  args: { stage: "pairing", purpose: "link_account", pairingCode: "481516", account: ACCOUNT },
};
export const Review: Story = {
  args: { stage: "review", purpose: "publish_work", account: ACCOUNT, resource, operation },
};
export const ReviewWrongAccount: Story = {
  args: {
    ...Review.args,
    account: "0x00000000000000000000000000000000000000b2",
  },
};
export const Submitted: Story = {
  args: { ...Review.args, stage: "submitted", operation: { ...operation, state: "reconciling" } },
};
export const Published: Story = { args: { ...Review.args, stage: "published" } };
export const NotSent: Story = { args: { ...Review.args, stage: "not_sent" } };
export const OutcomeUnknown: Story = {
  args: { ...Submitted.args, error: "outcome_unknown" },
};
export const Unavailable: Story = { args: { stage: "unavailable", error: "expired" } };

export const RecoveryCode: StoryObj<typeof RecoveryView> = {
  render: () => (
    <RecoveryView
      stage="code"
      channelLabel="WhatsApp"
      recoveredAccount={ACCOUNT}
      error="wrong_code"
      account={ACCOUNT}
      connecting={false}
      connectWallet={noop}
      connectPasskey={asyncNoop}
      start={asyncNoop}
      prove={asyncNoop}
      confirmCode={asyncNoop}
      apply={asyncNoop}
    />
  ),
};

export const RecoveryConfirm: StoryObj<typeof RecoveryView> = {
  render: () => (
    <RecoveryView
      stage="confirm"
      channelLabel="WhatsApp"
      recoveredAccount={ACCOUNT}
      error={null}
      account={ACCOUNT}
      connecting={false}
      connectWallet={noop}
      connectPasskey={asyncNoop}
      start={asyncNoop}
      prove={asyncNoop}
      confirmCode={asyncNoop}
      apply={asyncNoop}
    />
  ),
};

export const Permissions: Story = { render: () => <ReportingPermissionsPage /> };
