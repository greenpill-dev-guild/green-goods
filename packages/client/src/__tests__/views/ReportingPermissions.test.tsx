/** @vitest-environment happy-dom */
// TEST-QUALITY: allow-small-test-file - Owner removal confirmation and import are separate UI authority boundaries.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { PermissionsView } from "../../views/Public/AgentReporting/PermissionsView";

type Props = Parameters<typeof PermissionsView>[0];
const ACCOUNT = "0x1f3a9c2b7d4e5f60718293a4b5c6d7e8f9012345";
const makeProps = (): Props => ({
  account: ACCOUNT,
  connecting: false,
  connectWallet: vi.fn(),
  connectPasskey: vi.fn(async () => {}),
  changeAccount: vi.fn(async () => {}),
  stage: "ready",
  permissions: [
    {
      permissionId: "0x12345678",
      signerAddress: ACCOUNT,
      active: true,
      nonce: 0,
      descriptor: null,
    },
  ],
  descriptors: [],
  error: null,
  scan: vi.fn(async () => {}),
  importDescriptor: vi.fn(() => false),
  exportDescriptors: vi.fn(() => "[]"),
  revoke: vi.fn(async () => {}),
});
const view = (props: Props) => (
  <MemoryRouter>
    <IntlProvider locale="en" messages={{}}>
      <HelmetProvider>
        <PermissionsView {...props} />
      </HelmetProvider>
    </IntlProvider>
  </MemoryRouter>
);

describe("owner permission removal", () => {
  it("requires explicit broad-removal confirmation and fences a changed account", () => {
    const props = makeProps();
    const { rerender } = render(view(props));
    fireEvent.click(screen.getByRole("button", { name: "Remove Account Permissions" }));
    const confirmation = screen.getByRole("dialog");
    expect(
      within(confirmation).getByText(/including permissions for other apps/)
    ).toBeInTheDocument();
    expect(props.revoke).not.toHaveBeenCalled();
    rerender(view({ ...props, account: "0x00000000000000000000000000000000000000b2" }));
    expect(
      within(confirmation).getByRole("button", { name: "Remove Account Permissions" })
    ).toBeDisabled();
    fireEvent.click(within(confirmation).getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Account Permissions" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Remove Account Permissions" })
    );
    expect(props.revoke).toHaveBeenCalledTimes(1);
  });

  it("imports a saved record without signing and permits checking an uncertain result", () => {
    const props = makeProps();
    const { rerender } = render(view(props));
    fireEvent.change(screen.getByRole("textbox", { name: "Saved permission record" }), {
      target: { value: '{"accountAddress":"saved"}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import Record" }));
    expect(props.importDescriptor).toHaveBeenCalledWith('{"accountAddress":"saved"}');
    expect(props.revoke).not.toHaveBeenCalled();
    rerender(view({ ...props, stage: "submitted", error: "outcome_unknown" }));
    expect(
      screen.queryByRole("button", { name: "Remove Account Permissions" })
    ).not.toBeInTheDocument();
    // The status card asks for another check, and the bar still offers it.
    expect(screen.getByText("Not confirmed yet")).toBeInTheDocument();
    expect(screen.getByText(/Check again first/)).toBeInTheDocument();
    const bar = screen.getByRole("region", { name: "Next step" });
    fireEvent.click(within(bar).getByRole("button", { name: "Check Permissions" }));
    expect(props.scan).toHaveBeenCalledTimes(1);
  });

  it("reports a rejected saved record on its field, not in the page's status", () => {
    render(view({ ...makeProps(), error: "wrong_account" }));
    const field = screen.getByRole("textbox", { name: "Saved permission record" });
    expect(field).toHaveAccessibleDescription(/belongs to another account/);
    // The status card still says where the check stands, and the bar holds only its act.
    expect(screen.getByText("Checked")).toBeInTheDocument();
    expect(screen.getAllByText(/belongs to another account/)).toHaveLength(1);
    expect(screen.getByRole("region", { name: "Next step" })).toHaveTextContent(
      /^Check Permissions$/
    );
  });
});
