/** @vitest-environment happy-dom */
import { fireEvent, render, screen } from "@testing-library/react";
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
      screen.getByText("Preparing the first item does not request a signature.")
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Prepare first report" }));
    expect(props.installGrant).toHaveBeenCalledTimes(1);
    expect(props.publish).not.toHaveBeenCalled();
  });
  it("shows the first frozen report and its consumed allowance before the allow-and-publish action", () => {
    const props = { ...makeProps(), resource, operation };
    render(view(props));
    expect(screen.getByText("Watered twelve seedlings")).toBeInTheDocument();
    expect(screen.getByText(/uses 1 of the 5 allowed publications/)).toBeInTheDocument();
    expect(screen.getByText("0.001 ETH")).toBeInTheDocument();
    expect(screen.getByText("Total gas allowance")).toBeInTheDocument();
    expect(screen.getByText("Maximum total sponsored cost")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Allow and publish first report" }));
    expect(props.installGrant).toHaveBeenCalledTimes(1);
  });
  it.each([
    "wrong account",
    "unprepared envelope",
  ] as const)("disables owner authorization for %s", (reason) => {
    const props = {
      ...makeProps(),
      resource,
      operation,
      ...(reason === "wrong account"
        ? { account: "0x00000000000000000000000000000000000000b2" as const }
        : { operation: { ...operation, envelope: null } }),
    };
    render(view(props));
    expect(screen.getByRole("button", { name: "Allow and publish first report" })).toBeDisabled();
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
    expect(
      screen.getByRole("heading", { name: "Checking whether the request was sent" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Allow and publish first report" })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /publication sent/ })).not.toBeInTheDocument();
  });
});
