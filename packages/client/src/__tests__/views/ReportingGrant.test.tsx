/** @vitest-environment happy-dom */
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  buildEnvelope,
  resolveReportingDeployment,
} from "@green-goods/shared/modules/agent-reporting";
import { HelmetProvider } from "react-helmet-async";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { FocusedShell } from "../../components/Navigation/FocusedSiteHeader";
import { CeremonyView } from "../../views/Public/AgentReporting/CeremonyView";

type Props = Parameters<typeof CeremonyView>[0];
const ACCOUNT = "0x1f3a9c2b7d4e5f60718293a4b5c6d7e8f9012345";
const envelope = buildEnvelope(resolveReportingDeployment(42161), {
  kind: "work",
  operationId: "op-test",
  revision: 1,
  chainId: 42161,
  accountAddress: ACCOUNT,
  gardenAddress: ACCOUNT,
  clientWorkId: "work-test",
  actionDefinitionDigest: `0x${"12".repeat(32)}`,
  fields: {
    actionUID: "7",
    title: "Seedlings",
    feedback: "Watered seedlings",
    metadata: "bafkmetadata",
    media: [],
  },
  media: [],
  metadataDigest: `0x${"34".repeat(32)}`,
});
const operation: NonNullable<Props["operation"]> = {
  operationId: "op-test",
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
const resource: NonNullable<Props["resource"]> = {
  ok: true,
  kind: "draft",
  resourceId: "draft-test",
  revision: 1,
  state: "publishing",
  gardenLabel: "Aiyeloja Family Garden",
  title: "Watered seedlings",
  lines: [{ label: "Description", value: "Watered twelve seedlings" }],
  evidence: [],
  summaryDigest: `0x${"34".repeat(32)}`,
  operation,
};
const makeProps = (): Props => ({
  stage: "grant_ready",
  purpose: "grant_reporting",
  channelLabel: "Telegram",
  pairingCode: null,
  linkedAccount: null,
  inAppBrowser: false,
  passkeyUnavailable: false,
  linkCopied: false,
  openInBrowser: vi.fn(async () => {}),
  communityOffer: null,
  joinFailure: null,
  joinSending: false,
  skipCommunity: vi.fn(),
  joinCommunity: vi.fn(async () => {}),
  lastFailure: null,
  createAccount: vi.fn(async () => true),
  accountKind: null,
  sessionAccount: ACCOUNT,
  resource: null,
  operation: null,
  issues: [],
  error: null,
  account: ACCOUNT,
  connecting: false,
  connectWallet: vi.fn(),
  connectPasskey: vi.fn(async () => {}),
  start: vi.fn(async () => {}),
  prove: vi.fn(async () => {}),
  publish: vi.fn(async () => {}),
  installGrant: vi.fn(async () => {}),
  leave: vi.fn(async () => {}),
  grant: {
    grantId: "g-test",
    purpose: "reporting",
    state: "proposed",
    version: 1,
    policy: {
      version: 1,
      purpose: "reporting",
      chainId: 42161,
      account: ACCOUNT,
      gardenAddress: ACCOUNT,
      easAddress: envelope.call.to,
      schemaUID: envelope.schemaUID,
      signerAddress: ACCOUNT,
      moduleRef: "fixture",
      validAfter: 1_800_000_000_000,
      validUntil: 1_800_086_400_000,
      maxSubmissions: 5,
      gasCap: 1_000_000,
      gasCostCapWei: "1000000000000000",
    },
    policyDigest: `0x${"12".repeat(32)}`,
    permissionId: "0x12345678",
    submissionsUsed: 0,
    revocationDescriptor: null,
  },
});
// The page as the route draws it: inside the focused shell, whose top bar holds its steps and
// whose sheet holds its account.
const view = (props: Props) => (
  <MemoryRouter>
    <IntlProvider locale="en" messages={{}}>
      <HelmetProvider>
        <FocusedShell>
          <CeremonyView {...props} />
        </FocusedShell>
      </HelmetProvider>
    </IntlProvider>
  </MemoryRouter>
);
const review = (): Props => ({
  ...makeProps(),
  stage: "review",
  purpose: "publish_work",
  grant: null,
  resource,
  operation,
});
const bar = () => screen.getByRole("region", { name: "Next step" });
/** The status card: the one place the page says where the request stands or what is wrong. */
const status = () => screen.getByText(/./, { selector: '[data-component="CeremonyStageNotice"]' });

describe("first publication permission ceremony", () => {
  it("prepares only after an explicit click and says the step asks for no signature", () => {
    const props = makeProps();
    render(view(props));
    expect(props.installGrant).not.toHaveBeenCalled();
    expect(status()).toHaveTextContent(/This step doesn't ask you to/);
    fireEvent.click(screen.getByRole("button", { name: "Prepare First Report" }));
    expect(props.installGrant).toHaveBeenCalledTimes(1);
    expect(props.publish).not.toHaveBeenCalled();
  });
  it("shows the first frozen report and its consumed allowance before the allow-and-publish action", () => {
    const props = { ...makeProps(), resource, operation };
    render(view(props));
    expect(screen.getByText("Watered twelve seedlings")).toBeInTheDocument();
    expect(screen.getByText(/Counts as 1 of the 5 publications/)).toBeInTheDocument();
    expect(screen.getByText("24 hours")).toBeInTheDocument();
    expect(screen.getByText("0.001 ETH")).toBeInTheDocument();
    expect(screen.getByText("Total gas allowance")).toBeInTheDocument();
    expect(screen.getByText("Maximum total sponsored cost")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Allow and Publish" }));
    expect(props.installGrant).toHaveBeenCalledTimes(1);
  });
  it.each([
    ["wrong account", /Switch to 0x1f3a/],
    ["unprepared envelope", /Preparing the exact publication/],
  ] as const)("disables owner authorization for %s and the act names why", (reason, why) => {
    const props = {
      ...makeProps(),
      resource,
      operation,
      ...(reason === "wrong account"
        ? { account: "0x00000000000000000000000000000000000000b2" as const }
        : { operation: { ...operation, envelope: null } }),
    };
    render(view(props));
    const act = within(bar()).getByRole("button", { name: "Allow and Publish" });
    expect(act).toBeDisabled();
    // The status card says why, and the act carries it as its description.
    expect(status()).toHaveTextContent(why);
    expect(act).toHaveAccessibleDescription(why);
  });
  it("keeps an uncertain activation distinct from sent confirmation and removes the signing action", () => {
    render(
      view({
        ...makeProps(),
        resource,
        operation,
        stage: "grant_submitted",
        error: "outcome_unknown",
      })
    );
    expect(screen.getByRole("heading", { level: 1, name: "Your Permission" })).toBeInTheDocument();
    expect(screen.getByText("May already be sent")).toBeInTheDocument();
    expect(within(bar()).getByText("Checking whether the request was sent")).toBeInTheDocument();
    expect(within(bar()).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/Waiting for the network/)).not.toBeInTheDocument();
  });
});

describe("ceremony action bar", () => {
  it("holds the step's act and nothing else", () => {
    render(view({ ...makeProps(), resource, operation }));
    expect(within(bar()).getAllByRole("button")).toHaveLength(1);
    expect(bar()).toHaveTextContent(/^Allow and Publish$/);
    expect(within(bar()).queryByRole("link")).not.toBeInTheDocument();
  });

  it.each([
    ["a publication under review", review()],
    ["a first report under a permission", { ...makeProps(), resource, operation }],
  ])("offers no further send for %s while its outcome is unknown", (_, props) => {
    render(view({ ...props, error: "outcome_unknown" }));
    expect(within(bar()).queryByRole("button")).not.toBeInTheDocument();
    expect(within(bar()).getByText(/Checking whether/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Publish|Allow/ })).not.toBeInTheDocument();
    expect(status()).toHaveTextContent(/Don't send it again/);
    expect(props.publish).not.toHaveBeenCalled();
    expect(props.installGrant).not.toHaveBeenCalled();
  });

  it("explains a publication the page refuses to sign in the status card", () => {
    render(view({ ...review(), issues: ["wrong_chain"] }));
    const act = within(bar()).getByRole("button", { name: "Publish" });
    expect(act).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(/Can't sign this/);
    expect(act).toHaveAccessibleDescription(/won't sign/);
  });

  it.each([
    ["intro", "Continue"],
    ["pairing", "Waiting for your chat"],
    ["review", "Publish"],
    ["submitted", "Waiting for the network"],
    ["published", "Published"],
  ] as const)("keeps the bar in its place at %s, with an act or where the request stands", (stage, says) => {
    render(view({ ...review(), stage }));
    expect(bar()).toHaveTextContent(new RegExp(`^${says}$`));
  });
});

describe("where a ceremony says what is wrong", () => {
  it("uses the heading card on a screen with no status card, and adds no band for it", () => {
    render(view({ ...review(), stage: "intro", error: "offline" }));
    const heading = screen.getByRole("heading", { level: 1, name: "Continue From Your Chat" });
    const said = screen.getByText(/couldn't be reached/);
    expect(heading.parentElement).toContainElement(said);
    expect(document.querySelector('[data-component="CeremonyStageNotice"]')).toBeNull();
    expect(within(bar()).queryByText(/couldn't be reached/)).not.toBeInTheDocument();
  });

  it("keeps the status card's title when a request under review fails, so it still reads as unsent", () => {
    render(view({ ...review(), error: "offline" }));
    expect(screen.getByText("Not sent yet")).toBeInTheDocument();
    expect(status()).toHaveTextContent(/couldn't be reached/);
    expect(within(bar()).getByRole("button", { name: "Publish" })).toBeEnabled();
  });
});

describe("linking an account", () => {
  const link = (): Props => ({
    ...makeProps(),
    stage: "connect",
    purpose: "link_account",
    grant: null,
    sessionAccount: null,
    account: null,
  });
  /** The bar's acts in their own order: the first is the one the bar draws on the right. */
  const acts = () =>
    within(bar())
      .getAllByRole("button")
      .map((act) => act.textContent);

  it("says a failed sign-in in the account layer's own words, and the page stays up", () => {
    render(view({ ...link(), lastFailure: "Sign in was cancelled." }));
    expect(screen.getByRole("alert")).toHaveTextContent("Sign in was cancelled.");
    expect(acts()).toEqual(["Use Passkey", "Use Wallet"]);
  });

  it("puts the act of each new pair first", () => {
    const { rerender } = render(view({ ...link(), initialCreate: true }));
    expect(acts()).toEqual(["Create Account", "Back"]);
    rerender(view({ ...link(), stage: "intro", purpose: null, inAppBrowser: true }));
    expect(acts()).toEqual(["Open in Browser", "Continue Here"]);
  });

  it("invites the linked account to join, and never signs with another one", () => {
    const joining: Props = {
      ...link(),
      stage: "linked",
      linkedAccount: ACCOUNT,
      communityOffer: { address: ACCOUNT, name: "Community Garden", chainId: 42161 },
    };
    // A browser the Agent recognized may have no account connected: it connects one first.
    const { rerender } = render(view(joining));
    expect(acts()).toEqual(["Use Passkey", "Use Wallet"]);
    rerender(view({ ...joining, account: `0x${"9".repeat(40)}` }));
    expect(within(bar()).getByRole("button", { name: "Join Garden" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(/Switch to 0x1f3a/i);
    rerender(view({ ...joining, account: ACCOUNT, accountKind: "passkey" }));
    expect(acts()).toEqual(["Join Garden", "Not Now"]);
    // The chat is linked already, so nothing asks for a code.
    expect(screen.getByText("Then go back to your chat")).toBeInTheDocument();
    expect(screen.queryByText(/send the code/)).not.toBeInTheDocument();
    fireEvent.click(within(bar()).getByRole("button", { name: "Join Garden" }));
    expect(joining.joinCommunity).toHaveBeenCalledTimes(1);
  });
});

describe("top bar", () => {
  it("shows the flow's steps only while there is a step to take", () => {
    const { rerender } = render(view(review()));
    const banner = screen.getByRole("banner");
    expect(within(banner).getByText("Review").closest("li")).toHaveAttribute(
      "aria-current",
      "step"
    );
    for (const stage of ["submitted", "published", "not_sent"] as const) {
      rerender(view({ ...review(), stage }));
      expect(within(banner).queryByRole("list")).not.toBeInTheDocument();
    }
    rerender(view({ ...review(), stage: "intro", purpose: null }));
    expect(within(banner).queryByRole("list")).not.toBeInTheDocument();
  });

  it("marks a signed-in page on the profile button and keeps the account's acts in its sheet", () => {
    const props = { ...makeProps(), resource, operation };
    const { rerender } = render(view({ ...props, stage: "connect", sessionAccount: null }));
    expect(screen.getByRole("button", { name: "Account and Help" })).toBeInTheDocument();
    rerender(view(props));
    // Neither act is on the page; both are with the account.
    expect(screen.queryByRole("button", { name: "Sign Out of This Page" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Account and Help, signed in" }));
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByText("Signed in to this page")).toBeInTheDocument();
    expect(within(sheet).getByRole("link", { name: /Manage Permissions/ })).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole("button", { name: "Sign Out of This Page" }));
    expect(props.leave).toHaveBeenCalledTimes(1);
  });
});
