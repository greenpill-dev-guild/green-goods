/**
 * @vitest-environment jsdom
 */

import type { FabConfig } from "@green-goods/shared/components/Canvas/NavigationBar";
import enMessages from "@green-goods/shared/i18n/en";
import { RiHandCoinLine, RiUserAddLine } from "@remixicon/react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import { FabButton } from "./FabButton";

function renderFab(onAction = vi.fn()) {
  const config: FabConfig = {
    icon: RiUserAddLine,
    label: "Community actions",
    actions: [
      {
        id: "add-member",
        icon: RiUserAddLine,
        label: "Add Member",
        labelId: "cockpit.community.action.addMember",
      },
      {
        id: "fund-payout-jar",
        icon: RiHandCoinLine,
        label: "Fund Cookie Jar",
        labelId: "cockpit.community.action.fundPayoutJar",
        disabled: true,
        disabledReasonId: "cockpit.community.action.fundPayoutJarNoJar",
        disabledReason: "This garden has no payout jar yet.",
      },
    ],
    onAction,
  };
  render(
    <IntlProvider locale="en" messages={enMessages}>
      <FabButton config={config} mobileFloating />
    </IntlProvider>
  );
  return { onAction };
}

describe("FabButton", () => {
  it("keeps a disabled action reachable, inert, and saying why", async () => {
    const user = userEvent.setup();
    const { onAction } = renderFab();

    await user.click(screen.getByRole("button", { name: "Open Actions" }));
    const add = screen.getByRole("menuitem", { name: "Add Member" });
    const fund = screen.getByRole("menuitem", { name: "Fund Cookie Jar" });
    expect(add).toHaveFocus();

    // Arrow keys reach the disabled action, which names its reason.
    await user.keyboard("{ArrowDown}");
    expect(fund).toHaveFocus();
    expect(fund).toHaveAttribute("aria-disabled", "true");
    expect(fund).toHaveAccessibleDescription("This garden has no payout jar yet.");
    expect(within(fund).getByText("This garden has no payout jar yet.")).toBeInTheDocument();

    await user.keyboard("{Enter}");
    await user.click(fund);
    expect(onAction).not.toHaveBeenCalled();
  });
});
