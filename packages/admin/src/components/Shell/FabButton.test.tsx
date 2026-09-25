/**
 * @vitest-environment jsdom
 */

import type { FabConfig } from "@green-goods/shared/components/Canvas/NavigationBar";
import enMessages from "@green-goods/shared/i18n/en";
import {
  type RemixiconComponentType,
  RiCloseLine,
  RiHandCoinLine,
  RiUserAddLine,
} from "@remixicon/react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
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

/** The drawn path of an icon, to tell which icon the FAB shows. */
function iconPath(Icon: RemixiconComponentType) {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<Icon />);
  return host.querySelector("path")?.getAttribute("d");
}

describe("FabButton", () => {
  it("shows its primary action's icon, and a close icon while the dial is open (DL-050)", async () => {
    const user = userEvent.setup();
    renderFab();

    const fab = screen.getByRole("button", { name: "Open Actions" });
    expect(fab.querySelector("path")?.getAttribute("d")).toBe(iconPath(RiUserAddLine));

    await user.click(fab);
    expect(fab.querySelector("path")?.getAttribute("d")).toBe(iconPath(RiCloseLine));
  });

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

  it("focuses the first action when every action is disabled", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <IntlProvider locale="en" messages={enMessages}>
        <FabButton
          config={{
            icon: RiUserAddLine,
            label: "Community actions",
            actions: [
              {
                id: "fund-payout-jar",
                icon: RiHandCoinLine,
                label: "Fund Cookie Jar",
                labelId: "cockpit.community.action.fundPayoutJar",
                disabled: true,
                disabledReasonId: "cockpit.community.action.fundPayoutJarNoJar",
                disabledReason: "This garden has no payout jar yet.",
              },
              {
                id: "add-member",
                icon: RiUserAddLine,
                label: "Add Member",
                labelId: "cockpit.community.action.addMember",
                disabled: true,
              },
            ],
            onAction,
          }}
          mobileFloating
        />
      </IntlProvider>
    );

    await user.click(screen.getByRole("button", { name: "Open Actions" }));
    expect(screen.getByRole("menuitem", { name: "Fund Cookie Jar" })).toHaveFocus();
  });

  it("keeps a disabled sole action inert and says why", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <IntlProvider locale="en" messages={enMessages}>
        <FabButton
          config={{
            icon: RiHandCoinLine,
            label: "Community actions",
            actions: [
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
          }}
          mobileFloating
        />
      </IntlProvider>
    );

    const sole = screen.getByRole("button", { name: "Fund Cookie Jar" });
    expect(sole).toHaveAttribute("aria-disabled", "true");
    expect(sole).toHaveAccessibleDescription("This garden has no payout jar yet.");
    // Touch has no hover, so the pill says why in place.
    expect(within(sole).getByText("This garden has no payout jar yet.")).toBeInTheDocument();
    await user.click(sole);
    expect(onAction).not.toHaveBeenCalled();
  });
});
