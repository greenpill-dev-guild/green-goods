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
const view = (props: Props) => (
  <MemoryRouter>
    <IntlProvider locale="en" messages={{}}>
      <HelmetProvider>
        <CeremonyView {...props} />
      </HelmetProvider>
    </IntlProvider>
  </MemoryRouter>
);

describe("first publication permission ceremony", () => {
  it("prepares only after an explicit click and explains that preparation needs no signature", () => {
    const props = makeProps();
    render(view(props));
    expect(props.installGrant).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Preparing the first item does not request a signature/)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Prepare First Report" }));
    expect(props.installGrant).toHaveBeenCalledTimes(1);
    expect(props.publish).not.toHaveBeenCalled();
  });
  it("shows the first frozen report and its consumed allowance before the allow-and-publish action", () => {
    const props = { ...makeProps(), resource, operation };
    render(view(props));
    expect(screen.getByText("Watered twelve seedlings")).toBeInTheDocument();
    expect(screen.getByText(/uses 1 of the 5 allowed publications/)).toBeInTheDocument();
    expect(screen.getByText("24 hours")).toBeInTheDocument();
    expect(screen.getByText("0.001 ETH")).toBeInTheDocument();
    expect(screen.getByText("Total gas allowance")).toBeInTheDocument();
    expect(screen.getByText("Maximum total sponsored cost")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Allow and Publish First Report" }));
    expect(props.installGrant).toHaveBeenCalledTimes(1);
  });
  it.each([
    ["wrong account", /isn't the account linked to your chat/],
    ["unprepared envelope", /Preparing the exact publication/],
  ] as const)("disables owner authorization for %s and says why beside it", (reason, why) => {
    const props = {
      ...makeProps(),
      resource,
      operation,
      ...(reason === "wrong account"
        ? { account: "0x00000000000000000000000000000000000000b2" as const }
        : { operation: { ...operation, envelope: null } }),
    };
    render(view(props));
    const bar = screen.getByRole("region", { name: "Next step" });
    expect(
      within(bar).getByRole("button", { name: "Allow and Publish First Report" })
    ).toBeDisabled();
    expect(within(bar).getByText(why)).toBeInTheDocument();
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
    expect(screen.getByRole("heading", { level: 1, name: "Your permission" })).toBeInTheDocument();
    expect(screen.getByText("May already be sent")).toBeInTheDocument();
    const bar = screen.getByRole("region", { name: "Next step" });
    expect(within(bar).getByText("Checking whether the request was sent")).toBeInTheDocument();
    expect(within(bar).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/publication sent/)).not.toBeInTheDocument();
  });
});

describe("ceremony action bar", () => {
  const review = (): Props => ({
    ...makeProps(),
    stage: "review",
    purpose: "publish_work",
    grant: null,
    resource,
    operation,
  });

  it("holds the step's act and its signing account, and keeps page utilities out of it", () => {
    render(view({ ...makeProps(), resource, operation }));
    const bar = screen.getByRole("region", { name: "Next step" });
    const [primary, ...others] = within(bar).getAllByRole("button");
    expect(primary).toHaveAccessibleName("Allow and Publish First Report");
    expect(others).toHaveLength(0);
    expect(within(bar).getByText(/From account 0x1f3a/)).toBeInTheDocument();
    expect(within(bar).queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Manage Permissions/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign Out of This Page" })).toBeInTheDocument();
  });

  it.each([
    ["a publication under review", review()],
    ["a first report under a permission", { ...makeProps(), resource, operation }],
  ])("offers no further send for %s while its outcome is unknown", (_, props) => {
    render(view({ ...props, error: "outcome_unknown" }));
    const bar = screen.getByRole("region", { name: "Next step" });
    expect(within(bar).queryByRole("button")).not.toBeInTheDocument();
    expect(within(bar).getByText(/Checking whether/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Publish|Allow/ })).not.toBeInTheDocument();
    expect(screen.getByText(/From account 0x1f3a/)).toBeInTheDocument();
    expect(props.publish).not.toHaveBeenCalled();
    expect(props.installGrant).not.toHaveBeenCalled();
  });

  it("explains a publication the page refuses to sign beside the disabled act", () => {
    render(view({ ...review(), issues: ["wrong_chain"] }));
    const bar = screen.getByRole("region", { name: "Next step" });
    expect(within(bar).getByRole("button", { name: "Publish" })).toBeDisabled();
    expect(within(bar).getByRole("alert")).toHaveTextContent(/refused to sign/);
  });

  it("shows a failure beside the act, or under the heading when the bar has no act", () => {
    const { rerender } = render(view({ ...makeProps(), stage: "intro", error: "offline" }));
    const bar = screen.getByRole("region", { name: "Next step" });
    expect(within(bar).getByRole("status")).toHaveTextContent(/couldn't be reached/);
    rerender(view({ ...makeProps(), stage: "failed", error: "offline" }));
    const settled = screen.getByRole("region", { name: "Next step" });
    expect(within(settled).queryByRole("button")).not.toBeInTheDocument();
    expect(within(settled).queryByText(/couldn't be reached/)).not.toBeInTheDocument();
    expect(screen.getByText(/couldn't be reached/)).toBeInTheDocument();
  });

  it.each([
    ["intro", "Continue"],
    ["pairing", "Waiting for your chat"],
    ["review", "Publish"],
    ["submitted", "Waiting for the network"],
    ["published", "Published"],
  ] as const)("keeps the bar in its place at %s, with an act or where the step stands", (stage, says) => {
    render(view({ ...review(), stage }));
    expect(screen.getByRole("region", { name: "Next step" })).toHaveTextContent(says);
  });
});
