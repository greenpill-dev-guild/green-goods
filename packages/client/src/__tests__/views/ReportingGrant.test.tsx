/** @vitest-environment happy-dom */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  failure: null,
  savedPasskey: false,
  canFindAccount: false,
  changeAccount: vi.fn(async () => true),
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

  const heading = () => screen.getByRole("heading", { level: 1 });
  const press = (name: string) => fireEvent.click(within(bar()).getByRole("button", { name }));
  const submitName = (name: string) => {
    const field = screen.getByLabelText(/Account name/);
    fireEvent.change(field, { target: { value: name } });
    fireEvent.submit(field.closest("form") as HTMLFormElement);
  };

  it("opens on two doors where the browser remembers no passkey, and neither opens a prompt", () => {
    const props = link();
    render(view(props));
    expect(heading()).toHaveTextContent("New to Green Goods?");
    expect(acts()).toEqual(["Create Account", "I Have an Account"]);
    press("I Have an Account");
    expect(acts()).toEqual(["Use Passkey", "Use Wallet"]);
    expect(props.connectPasskey).not.toHaveBeenCalled();
    expect(props.createAccount).not.toHaveBeenCalled();
  });

  it("asks a passkey this browser does not remember for its account's name before any prompt", () => {
    const props: Props = { ...link(), canFindAccount: true };
    render(view(props));
    press("I Have an Account");
    press("Use Passkey");
    expect(props.connectPasskey).not.toHaveBeenCalled();
    expect(heading()).toHaveTextContent("Find Your Account");
    expect(acts()).toEqual(["Find Account", "Back"]);
    submitName(" afo.eth ");
    expect(props.connectPasskey).toHaveBeenCalledWith("afo.eth");
    expect(props.createAccount).not.toHaveBeenCalled();
    // Back returns to the acts it came from, never to a new account.
    press("Back");
    expect(acts()).toEqual(["Use Passkey", "Use Wallet"]);
  });

  it("opens a remembered passkey's prompt at once, with the other ways in as links", () => {
    const props: Props = { ...link(), savedPasskey: true, canFindAccount: true };
    render(view(props));
    expect(acts()).toEqual(["Use Passkey", "Use Wallet"]);
    expect(screen.getByRole("button", { name: "New here? Create an account" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Another account? Find it by name" })).toBeVisible();
    press("Use Passkey");
    expect(props.connectPasskey).toHaveBeenCalledWith();
  });

  it("creates an account only from the create screen's own act", () => {
    const props = link();
    render(view(props));
    press("Create Account");
    // The door opens the screen; the account is made by the name's own submit.
    expect(props.createAccount).not.toHaveBeenCalled();
    expect(heading()).toHaveTextContent("Create Your Account");
    expect(acts()).toEqual(["Create Account", "Back"]);
    submitName("ada");
    expect(props.createAccount).toHaveBeenCalledWith("ada");
    expect(props.connectPasskey).not.toHaveBeenCalled();
    press("Back");
    expect(acts()).toEqual(["Create Account", "I Have an Account"]);
  });

  it.each([
    ["prompt_closed", "existing", /prompt closed\. Try again, or use another way in/],
    ["passkey_not_here", "existing", /isn't on this device\. Try another way in/],
    ["no_saved_passkey", "existing", /No passkey is saved in this browser/],
    ["not_created", "create", /no account was made\. Try again/],
    ["name_taken", "create", /name is taken\. Pick another, or go back if it's yours/],
    ["name_not_found", "find", /No account has that name\. Check the spelling, or go back/],
    // A failure the page has no words for is said in the account layer's own.
    ["other", "find", /^That passkey is for a different account\.$/],
  ] as const)("says what to do after %s, and creates nothing because of it", (reason, initialEntry, says) => {
    const props: Props = {
      ...link(),
      savedPasskey: true,
      initialEntry,
      failure: { reason, spoken: "That passkey is for a different account." },
    };
    render(view(props));
    expect(screen.getByRole("alert")).toHaveTextContent(says);
    expect(props.createAccount).not.toHaveBeenCalled();
    expect(props.connectPasskey).not.toHaveBeenCalled();
  });

  it("drops a failed attempt's words once the person moves to another screen", () => {
    const failure = { reason: "prompt_closed", spoken: "Sign in was cancelled." } as const;
    render(view({ ...link(), savedPasskey: true, failure }));
    expect(screen.getByRole("alert")).toHaveTextContent(/prompt closed/);
    fireEvent.click(screen.getByRole("button", { name: "New here? Create an account" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(heading().parentElement).toHaveTextContent(/Pick a name and keep it safe/);
  });

  it("says before any press that this browser cannot open a passkey prompt, and keeps the wallet", () => {
    render(view({ ...link(), passkeyUnavailable: true }));
    expect(screen.getByText(/Passkeys don't work here/)).toHaveAttribute("role", "status");
    expect(within(bar()).getByRole("button", { name: "Use Passkey" })).toBeDisabled();
    expect(within(bar()).getByRole("button", { name: "Use Wallet" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "New here? Create an account" })).toBeDisabled();
  });

  it("puts the act of the in-app pair first", () => {
    render(view({ ...link(), stage: "intro", purpose: null, inAppBrowser: true }));
    expect(acts()).toEqual(["Open in Browser", "Continue Here"]);
  });

  it("lets go of the account this browser brought, so the chat can link another", () => {
    // The page starts on whichever account the browser last used. The step offers the way out.
    const connected: Props = { ...link(), account: ACCOUNT };
    render(view(connected));
    expect(acts()).toEqual(["Sign to Continue"]);
    fireEvent.click(screen.getByRole("button", { name: /^Not 0x.+\? Use a different account$/ }));
    expect(connected.changeAccount).toHaveBeenCalledTimes(1);
    // The same act is with the account in the sheet, where signing out of the page also lives.
    fireEvent.click(screen.getByRole("button", { name: "Account and Help" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Use a Different Account" })
    );
    expect(connected.changeAccount).toHaveBeenCalledTimes(2);
  });

  it("keeps the account once its code is on screen, and while a join is being sent", () => {
    // The code belongs to the account that proved it, so nothing here offers to swap it.
    const { rerender } = render(
      view({
        ...link(),
        stage: "pairing",
        account: ACCOUNT,
        linkedAccount: ACCOUNT,
        pairingCode: "481516",
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "Account and Help" }));
    expect(
      within(screen.getByRole("dialog")).queryByRole("button", { name: "Use a Different Account" })
    ).not.toBeInTheDocument();
    // A join on its way to the chain is signed by the connected account: it stays connected.
    rerender(
      view({
        ...link(),
        stage: "linked",
        account: `0x${"9".repeat(40)}`,
        linkedAccount: ACCOUNT,
        communityOffer: { address: ACCOUNT, name: "Community Garden", chainId: 42161 },
        joinSending: true,
      })
    );
    expect(
      screen.queryByRole("button", { name: /Use a different account$/i })
    ).not.toBeInTheDocument();
  });

  it("offers no search by name where there is nothing to search", () => {
    // Without the passkey server a name cannot be looked up; a publish link never creates one.
    const props: Props = { ...link(), purpose: "publish_work" };
    render(view(props));
    expect(acts()).toEqual(["Use Passkey", "Use Wallet"]);
    expect(screen.queryByRole("button", { name: /Find it by name/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Create an account/ })).not.toBeInTheDocument();
    // The passkey act is all there is to try, and its failure then says what to do.
    press("Use Passkey");
    expect(props.connectPasskey).toHaveBeenCalledWith();
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
    // Being told to switch comes with the way to do it.
    fireEvent.click(screen.getByRole("button", { name: /^Not 0x.+\? Use a different account$/ }));
    expect(joining.changeAccount).toHaveBeenCalledTimes(1);
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

describe("focus when the step changes", () => {
  const title = () => screen.getByRole("heading", { level: 1 });
  const opened = (): Props => ({
    ...makeProps(),
    stage: "intro",
    purpose: null,
    grant: null,
    account: null,
    sessionAccount: null,
  });
  const onAccountStep = (): Props => ({ ...opened(), stage: "connect", purpose: "link_account" });
  /** As a browser does it: the control takes focus, then is pressed. */
  const press = (control: HTMLElement) => {
    control.focus();
    fireEvent.click(control);
  };
  /** Long enough for the page to have moved focus, had it meant to. */
  const settled = () => act(() => new Promise<void>((done) => setTimeout(done, 0)));

  it("goes to the new step's title once the act the person pressed is gone", async () => {
    const { rerender } = render(view(opened()));
    await settled();
    // Opening the page moves nothing.
    expect(document.body).toHaveFocus();

    press(within(bar()).getByRole("button", { name: "Continue" }));
    rerender(view(onAccountStep()));
    await waitFor(() => expect(title()).toHaveFocus());
    expect(title()).toHaveTextContent("New to Green Goods?");
    // The page can give its title focus. The Tab key passes it by.
    expect(title()).toHaveAttribute("tabindex", "-1");

    // A screen inside a step replaces its acts too.
    press(within(bar()).getByRole("button", { name: "Create Account" }));
    await waitFor(() => expect(title()).toHaveFocus());
    expect(title()).toHaveTextContent("Create Your Account");
  });

  it("stays where it is when the page changes by itself, or the act pressed is still there", async () => {
    // A send that settles is no one's act.
    const { rerender } = render(view({ ...review(), stage: "submitted" }));
    rerender(view({ ...review(), stage: "published" }));
    await settled();
    expect(document.body).toHaveFocus();

    // A press that only starts something leaves its act in place, and focus on it.
    const waiting = { ...onAccountStep(), savedPasskey: true };
    rerender(view(waiting));
    const passkey = within(bar()).getByRole("button", { name: "Use Passkey" });
    press(passkey);
    rerender(view({ ...waiting, connecting: true }));
    await settled();
    expect(passkey).toHaveFocus();
  });

  it("is left in the account sheet while that is open", async () => {
    const { rerender } = render(view(opened()));
    press(within(bar()).getByRole("button", { name: "Continue" }));
    press(screen.getByRole("button", { name: "Account and Help" }));
    const sheet = screen.getByRole("dialog");
    const close = within(sheet).getAllByRole("button")[0];
    close.focus();
    rerender(view(onAccountStep()));
    await settled();
    expect(close).toHaveFocus();
    // The open sheet hides the page from assistive technology, so the title is found by its id.
    expect(document.getElementById("ceremony-title")).toHaveTextContent("New to Green Goods?");
  });
});
