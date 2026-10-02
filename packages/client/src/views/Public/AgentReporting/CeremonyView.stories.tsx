import {
  buildEnvelope,
  type OperationView,
  type ResourceView,
  resolveReportingDeployment,
} from "@green-goods/shared/modules/agent-reporting";
import type { Meta, StoryObj } from "@storybook/react";
import { HelmetProvider } from "react-helmet-async";
import { FocusedSiteHeader } from "@/components/Navigation/FocusedSiteHeader";
import {
  FIXTURE_IMAGE_AGROFORESTRY,
  FIXTURE_IMAGE_BANNER,
  STORYBOOK_NOW_SECONDS,
} from "../../../../../shared/.storybook/fixtures";
import { CeremonyView } from "./CeremonyView";
import { PermissionsView } from "./PermissionsView";
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
  gardenLabel: "Aiyeloja Family Garden",
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
  channelLabel: "Telegram",
  pairingCode: null,
  resource: null,
  operation: null,
  grant: null,
  issues: [],
  error: null,
  account: null,
  connecting: false,
  connectWallet: noop,
  connectPasskey: asyncNoop,
  start: asyncNoop,
  prove: asyncNoop,
  publish: asyncNoop,
  installGrant: asyncNoop,
  leave: asyncNoop,
  evidenceUrl: (assetId) => (assetId === "a1" ? FIXTURE_IMAGE_AGROFORESTRY : FIXTURE_IMAGE_BANNER),
};

const meta: Meta<typeof CeremonyView> = {
  title: "Client/Public/AgentReporting/Ceremony",
  component: CeremonyView,
  tags: ["autodocs"],
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
export const Opening: Story = { args: { stage: "opening" } };
export const Loading: Story = { args: { stage: "loading", purpose: "publish_work" } };
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
export const ReviewLongContent: Story = {
  args: {
    ...Review.args,
    resource: {
      ...resource,
      title: "Planted and watered baobab seedlings along the garden's community boundary",
      lines: [
        ...resource.lines,
        { label: "Garden record", value: `https://example.com/garden/${"ayieloja".repeat(24)}` },
      ],
    },
  },
};
export const ReviewDisabled: Story = {
  args: { ...Review.args, issues: ["wrong_chain"], error: "envelope_mismatch" },
};
export const Signing: Story = { args: { ...Review.args, stage: "signing" } };
export const ReviewDecision: Story = {
  args: { ...Review.args, purpose: "review_decision", resource: { ...resource, kind: "review" } },
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
export const Failed: Story = { args: { stage: "failed", error: "offline" } };
export const Unsupported: Story = { args: { stage: "unsupported", purpose: "grant_reporting" } };

const grant: NonNullable<Props["grant"]> = {
  grantId: "grant-story",
  gardenLabel: "Aiyeloja Family Garden",
  purpose: "reporting",
  state: "proposed",
  version: 1,
  policy: {
    version: 1,
    purpose: "reporting",
    chainId: 42161,
    account: ACCOUNT,
    gardenAddress: "0xF7b892886998DAe960D64a9db488336684F137A0",
    easAddress: envelope.call.to,
    schemaUID: `0x${"11".repeat(32)}`,
    signerAddress: "0x00000000000000000000000000000000000000b2",
    moduleRef: "storybook-only",
    validAfter: STORYBOOK_NOW_SECONDS * 1000,
    validUntil: (STORYBOOK_NOW_SECONDS + 24 * 60 * 60) * 1000,
    maxSubmissions: 5,
    gasCap: 1_000_000,
    gasCostCapWei: "1000000000000000",
  },
  policyDigest: `0x${"56".repeat(32)}`,
  permissionId: "0x12345678",
  submissionsUsed: 0,
  revocationDescriptor: null,
};
export const GrantReady: Story = {
  args: { stage: "grant_ready", purpose: "grant_reporting", account: ACCOUNT, grant },
};
export const GrantSigning: Story = { args: { ...GrantReady.args, stage: "grant_signing" } };
export const GrantSubmitted: Story = {
  args: { ...GrantReady.args, stage: "grant_submitted", grant: { ...grant, state: "enabling" } },
};
export const GrantActive: Story = {
  args: {
    ...GrantReady.args,
    stage: "grant_active",
    grant: { ...grant, state: "active", submissionsUsed: 2 },
  },
};
export const GrantWrongAccount: Story = {
  args: { ...GrantReady.args, account: "0x00000000000000000000000000000000000000b2" },
};
export const GrantReview: Story = {
  args: {
    ...GrantReady.args,
    purpose: "grant_review",
    grant: {
      ...grant,
      purpose: "review",
      policy: {
        ...grant.policy,
        purpose: "review",
        validUntil: (STORYBOOK_NOW_SECONDS + 60 * 60) * 1000,
      },
    },
  },
};

export const RecoveryCode: StoryObj<typeof RecoveryView> = {
  render: () => (
    <RecoveryView
      stage="code"
      channelLabel="Telegram"
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
      channelLabel="Telegram"
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

type PermissionProps = Parameters<typeof PermissionsView>[0];
const permissionBase: PermissionProps = {
  account: null,
  connecting: false,
  connectWallet: noop,
  connectPasskey: asyncNoop,
  stage: "idle",
  permissions: [],
  descriptors: [],
  error: null,
  scan: asyncNoop,
  importDescriptor: () => false,
  exportDescriptors: () => "[]",
  revoke: asyncNoop,
};
const activePermissions: PermissionProps = {
  ...permissionBase,
  account: ACCOUNT,
  stage: "ready",
  permissions: [
    {
      permissionId: `0x${"12".repeat(4)}`,
      signerAddress: ACCOUNT,
      active: true,
      nonce: 0,
      descriptor: null,
    },
  ],
};
export const Permissions: Story = { render: () => <PermissionsView {...permissionBase} /> };
export const PermissionsActive: Story = {
  render: () => <PermissionsView {...activePermissions} />,
};
export const PermissionsLoading: Story = {
  render: () => <PermissionsView {...permissionBase} account={ACCOUNT} stage="inspecting" />,
};
export const PermissionsEmpty: Story = {
  render: () => <PermissionsView {...permissionBase} account={ACCOUNT} stage="ready" />,
};
export const PermissionsUnsupported: Story = {
  render: () => (
    <PermissionsView
      {...permissionBase}
      account={ACCOUNT}
      stage="failed"
      error="unsupported_account"
    />
  ),
};
export const PermissionsSubmitted: Story = {
  render: () => (
    <PermissionsView {...activePermissions} stage="submitted" error="outcome_unknown" />
  ),
};
export const PermissionsRevoked: Story = {
  render: () => (
    <PermissionsView
      {...activePermissions}
      stage="revoked"
      permissions={activePermissions.permissions.map((permission) => ({
        ...permission,
        active: false,
      }))}
    />
  ),
};
