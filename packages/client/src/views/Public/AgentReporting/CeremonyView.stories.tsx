import en from "@green-goods/shared/i18n/en";
import es from "@green-goods/shared/i18n/es";
import pt from "@green-goods/shared/i18n/pt";
import {
  buildEnvelope,
  type OperationView,
  type ResourceView,
  resolveReportingDeployment,
} from "@green-goods/shared/modules/agent-reporting";
import { Confidence, VerificationMethod } from "@green-goods/shared/types/domain";
import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { HelmetProvider } from "react-helmet-async";
import { IntlProvider } from "react-intl";
import { expect, waitFor, within } from "storybook/test";
import { FocusedShell } from "@/components/Navigation/FocusedSiteHeader";
import {
  FIXTURE_IMAGE_AGROFORESTRY,
  FIXTURE_IMAGE_BANNER,
  STORYBOOK_NOW_SECONDS,
} from "../../../../../shared/.storybook/fixtures";
import { CeremonyView } from "./CeremonyView";

const ACCOUNT = "0x1f3a9c2b7d4e5f60718293a4b5c6d7e8f9012345";
const noop = () => {};
const asyncNoop = async () => {};

const envelope = buildEnvelope(resolveReportingDeployment(42161), {
  kind: "work",
  operationId: "op-story",
  revision: 4,
  chainId: 42161,
  accountAddress: ACCOUNT,
  gardenAddress: "0xF7b892886998DAe960D64a9db488336684F137A0",
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
  linkedAccount: null,
  inAppBrowser: false,
  passkeyUnavailable: false,
  linkCopied: false,
  openInBrowser: asyncNoop,
  communityOffer: null,
  joinFailure: null,
  joinSending: false,
  skipCommunity: noop,
  joinCommunity: asyncNoop,
  lastFailure: null,
  createAccount: async () => true,
  accountKind: null,
  sessionAccount: null,
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

const MESSAGES = { en, es, pt } as const;
type Locale = keyof typeof MESSAGES;

/** Stories pick a language through `parameters.locale`; the global decorator stays English. */
const withLocale: Decorator = (Story, context) => {
  const locale = (context.parameters.locale as Locale | undefined) ?? "en";
  return (
    <IntlProvider locale={locale} messages={MESSAGES[locale]}>
      <Story />
    </IntlProvider>
  );
};

const meta: Meta<typeof CeremonyView> = {
  title: "Client/Public/AgentReporting/Ceremony",
  component: CeremonyView,
  tags: ["autodocs"],
  args: base,
  decorators: [
    // The focused PublicShell branch: the top bar, then the page in `main`. Storybook pads every
    // story by its `--gg-space-md`; the negative margin takes exactly that back (a rem margin
    // would grow with the text size), so the page meets the viewport's edges as it does in the
    // browser and lines up with its two bars.
    (Story) => (
      <HelmetProvider>
        <div className="m-[calc(var(--gg-space-md)*-1)]">
          <FocusedShell>
            <Story />
          </FocusedShell>
        </div>
      </HelmetProvider>
    ),
    // Outermost, so the header speaks the story's language too.
    withLocale,
  ],
  parameters: {
    // The focused shell renders without the website surface: app corners for fields and buttons.
    surface: "app",
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "`/agent/reporting/:requestId` — the browser step of a chat report or review, drawn " +
          "with the app's flow parts: the named steps, the step's heading card, the work " +
          "review's Media and Details, the promise page's facts for a permission's limits, the " +
          "work page's stacked notices once a request is sent, and Submit Work's fixed bar. " +
          "The bar keeps its place from the first step to the outcome: the step's act, or " +
          "where the step stands when there is nothing to press.",
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof CeremonyView>;

export const Intro: Story = {};
export const Opening: Story = { args: { stage: "opening" } };
export const Loading: Story = {
  args: { stage: "loading", purpose: "publish_work", account: ACCOUNT, sessionAccount: ACCOUNT },
};
export const Connect: Story = { args: { stage: "connect", purpose: "publish_work" } };
export const ProveConnected: Story = {
  args: { stage: "connect", purpose: "publish_work", account: ACCOUNT },
};
/** The prompt is open: the heading card points at it, in the same two lines. */
export const Proving: Story = { args: { ...ProveConnected.args, stage: "proving" } };
/** A problem on a screen with no status card is said in the heading card. */
export const ConnectDeclined: Story = { args: { ...ProveConnected.args, error: "declined" } };
/** Linking an account asks for one signature, then a code sent in chat. */
export const LinkConnect: Story = { args: { stage: "connect", purpose: "link_account" } };
export const CreateAccount: Story = {
  args: { stage: "connect", purpose: "link_account", initialCreate: true },
};
export const CreateAccountSpanish: Story = {
  ...CreateAccount,
  parameters: { locale: "es" },
};
export const CreateAccountPortuguese: Story = {
  ...CreateAccount,
  parameters: { locale: "pt" },
};
export const Join: Story = {
  args: {
    stage: "pairing",
    purpose: "link_account",
    account: ACCOUNT,
    accountKind: "passkey",
    linkedAccount: ACCOUNT,
    pairingCode: "481516",
    communityOffer: {
      address: "0xF7b892886998DAe960D64a9db488336684F137A0",
      name: "Community Garden",
      chainId: 42161,
    },
  },
};
export const JoinSpanish: Story = { ...Join, parameters: { locale: "es" } };
export const JoinPortuguese: Story = { ...Join, parameters: { locale: "pt" } };
/** A chat that is linked already: joining is all that is left, so no code is promised. */
export const JoinLinked: Story = {
  args: { ...Join.args, stage: "linked", accountKind: "wallet", pairingCode: null },
};
/** The invitation is for the linked account: with another one connected, joining is switched off. */
export const JoinWrongAccount: Story = {
  args: { ...JoinLinked.args, account: "0x9c2b7d4e5f60718293a4b5c6d7e8f90123451f3a" },
};
/** A browser the Agent recognized, with no account connected: it connects one before joining. */
export const JoinDisconnected: Story = {
  args: { ...JoinLinked.args, account: null, accountKind: null },
};
/** A sign-in that failed says so in the account layer's own words. */
export const ConnectFailed: Story = {
  args: { ...LinkConnect.args, lastFailure: "Sign in was cancelled." },
};
export const InAppStart: Story = { args: { stage: "intro", inAppBrowser: true } };
export const InAppStartSpanish: Story = {
  ...InAppStart,
  parameters: { locale: "es" },
};
export const InAppStartPortuguese: Story = {
  ...InAppStart,
  parameters: { locale: "pt" },
};
export const Pairing: Story = {
  args: { stage: "pairing", purpose: "link_account", pairingCode: "481516", account: ACCOUNT },
};
export const Linked: Story = { args: { ...Pairing.args, stage: "linked", pairingCode: null } };
export const Review: Story = {
  args: {
    stage: "review",
    purpose: "publish_work",
    account: ACCOUNT,
    sessionAccount: ACCOUNT,
    resource,
    operation,
  },
};
export const ReviewDisconnected: Story = { args: { ...Review.args, account: null } };
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
/** What failed keeps the status card's title, so it still says nothing was sent. */
export const ReviewOffline: Story = { args: { ...Review.args, error: "offline" } };
export const Signing: Story = { args: { ...Review.args, stage: "signing" } };
export const ReviewDecision: Story = {
  args: { ...Review.args, purpose: "review_decision", resource: { ...resource, kind: "review" } },
};
export const DecisionRecorded: Story = { args: { ...ReviewDecision.args, stage: "published" } };
export const Submitted: Story = {
  args: { ...Review.args, stage: "submitted", operation: { ...operation, state: "reconciling" } },
};
export const Published: Story = { args: { ...Review.args, stage: "published" } };
export const NotSent: Story = { args: { ...Review.args, stage: "not_sent" } };
export const OutcomeUnknown: Story = {
  args: { ...Submitted.args, error: "outcome_unknown" },
};
export const Unavailable: Story = { args: { stage: "unavailable", error: "expired" } };
export const Failed: Story = { args: { ...Review.args, stage: "failed" } };
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
    schemaUID: envelope.schemaUID,
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
/** The permission flow's account step, before and after an account is connected. */
export const GrantConnect: Story = { args: { stage: "connect", purpose: "grant_reporting" } };
export const GrantConnected: Story = {
  args: { stage: "connect", purpose: "grant_reporting", account: ACCOUNT },
};
export const GrantPrepare: Story = {
  args: {
    stage: "grant_ready",
    purpose: "grant_reporting",
    account: ACCOUNT,
    sessionAccount: ACCOUNT,
    grant,
  },
};
export const GrantPreparing: Story = { args: { ...GrantPrepare.args, stage: "loading" } };
/** The longest step: the permission and its first report. The act stays in reach throughout. */
export const GrantReady: Story = {
  args: { ...GrantPrepare.args, resource, operation },
  tags: ["storybook-ci"],
  globals: { viewport: { value: "mobile" } },
  play: async ({ canvasElement }) => {
    const view = canvasElement.ownerDocument.defaultView as Window;
    const region = within(canvasElement).getByRole("region", { name: "Next step" });
    const act = within(region).getByRole("button", { name: "Allow and Publish" });
    const inReach = () => {
      const { top, bottom } = act.getBoundingClientRect();
      return top >= 0 && bottom <= view.innerHeight;
    };
    // The bar is fixed to the viewport's bottom edge and a spacer of its height holds the end of
    // the page clear.
    const bar = region.querySelector<HTMLElement>('[data-component="FlowBar"]') as HTMLElement;
    const spacer = canvasElement.querySelector<HTMLElement>(
      '[data-component="CeremonyBarSpacer"]'
    ) as HTMLElement;
    await expect(view.getComputedStyle(bar).position).toBe("fixed");
    await waitFor(() =>
      expect(spacer.getBoundingClientRect().height).toBe(bar.getBoundingClientRect().height)
    );
    await expect(bar.getBoundingClientRect().bottom).toBe(view.innerHeight);
    const end = view.document.documentElement.scrollHeight - view.innerHeight;
    await expect(inReach()).toBe(true);
    view.scrollTo({ top: end / 2, behavior: "instant" });
    await expect(inReach()).toBe(true);
    view.scrollTo({ top: end, behavior: "instant" });
    await expect(inReach()).toBe(true);
    // At the end of the page the last of the content, the permission's last limit, clears the bar.
    const last = within(canvasElement).getByText("Maximum total sponsored cost");
    await expect(last.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      bar.getBoundingClientRect().top
    );
    view.scrollTo({ top: 0, behavior: "instant" });
  },
};
export const GrantSigning: Story = { args: { ...GrantReady.args, stage: "grant_signing" } };
export const GrantSubmitted: Story = {
  args: { ...GrantReady.args, stage: "grant_submitted", grant: { ...grant, state: "enabling" } },
};
export const GrantOutcomeUnknown: Story = {
  args: { ...GrantSubmitted.args, error: "outcome_unknown" },
};
export const GrantActive: Story = {
  args: {
    ...GrantReady.args,
    stage: "grant_active",
    grant: { ...grant, state: "active", submissionsUsed: 1 },
  },
};
export const GrantWrongAccount: Story = {
  args: { ...GrantReady.args, account: "0x00000000000000000000000000000000000000b2" },
};
/** Long Portuguese labels in the action bar and the permission summary. */
export const GrantReadyPortuguese: Story = {
  args: GrantReady.args,
  parameters: { locale: "pt" },
};
/** Two connect choices with long Spanish labels. */
export const ConnectSpanish: Story = {
  args: Connect.args,
  parameters: { locale: "es" },
};
const reviewEnvelope = buildEnvelope(resolveReportingDeployment(42161), {
  kind: "review",
  operationId: "review-story",
  revision: 1,
  chainId: 42161,
  accountAddress: ACCOUNT,
  gardenAddress: envelope.gardenAddress,
  reviewContentDigest: `0x${"34".repeat(32)}`,
  fields: {
    actionUID: "7",
    workUID: `0x${"12".repeat(32)}`,
    approved: true,
    feedback: "Seedlings planted and watered as reported.",
    confidence: Confidence.HIGH,
    verificationMethod: VerificationMethod.HUMAN,
    reviewNotesCID: "",
  },
});
const reviewOperation: OperationView = {
  ...operation,
  operationId: "review-story",
  kind: "review",
  envelope: reviewEnvelope,
};
export const GrantReview: Story = {
  args: {
    ...GrantReady.args,
    purpose: "grant_review",
    operation: reviewOperation,
    resource: {
      ...resource,
      kind: "review",
      operation: reviewOperation,
      lines: [
        { label: "Decision", value: "Approve" },
        { label: "Confidence", value: "High" },
        { label: "Feedback", value: "Seedlings planted and watered as reported." },
      ],
      evidence: [],
    },
    grant: {
      ...grant,
      purpose: "review",
      policy: {
        ...grant.policy,
        purpose: "review",
        schemaUID: reviewEnvelope.schemaUID,
        validUntil: (STORYBOOK_NOW_SECONDS + 60 * 60) * 1000,
      },
    },
  },
};
