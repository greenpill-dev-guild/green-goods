/**
 * @vitest-environment jsdom
 */

import {
  type RemixiconComponentType,
  RiCloseLine,
  RiHandCoinLine,
  RiUserAddLine,
} from "@remixicon/react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import type { FabConfig } from "../../components/Canvas/NavigationBar";
import { FabButton } from "../../components/Canvas/NavigationBarFab";
import enMessages from "../../i18n/en.json";

/** The drawn path of an icon, to tell which icon the FAB shows. */
function iconPath(Icon: RemixiconComponentType) {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<Icon />);
  return host.querySelector("path")?.getAttribute("d");
}

describe("NavigationBarFab", () => {
  it("shows its primary action's icon, and a close icon while the dial is open (DL-050)", async () => {
    const user = userEvent.setup();
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
        },
      ],
      onAction: vi.fn(),
    };
    render(
      <IntlProvider locale="en" messages={enMessages}>
        <FabButton config={config} mobileFloating />
      </IntlProvider>
    );

    const fab = screen.getByRole("button", { name: "Open Actions" });
    expect(fab.querySelector("path")?.getAttribute("d")).toBe(iconPath(RiUserAddLine));

    await user.click(fab);
    expect(fab.querySelector("path")?.getAttribute("d")).toBe(iconPath(RiCloseLine));
    expect(fab.querySelector("svg")?.getAttribute("class") ?? "").not.toContain("rotate");
    // The close glyph is named for what it does now.
    expect(fab).toHaveAccessibleName("Close Actions");
  });
});
