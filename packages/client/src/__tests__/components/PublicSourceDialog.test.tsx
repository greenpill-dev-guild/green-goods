import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { describe, expect, it } from "vitest";
import { PublicSourceDialog } from "../../components/Public/PublicSourceDialog";

describe("public source dialog keyboard", () => {
  it("cycles Tab and Shift+Tab within its controls", async () => {
    const user = userEvent.setup();
    render(
      <IntlProvider locale="en" messages={{}}>
        <a href="#behind">Behind the dialog</a>
        <PublicSourceDialog
          open
          title="Action"
          onClose={() => {}}
          sourceHref="https://example.org/source"
        >
          <button type="button">Read action</button>
        </PublicSourceDialog>
      </IntlProvider>
    );
    expect(document.activeElement).toHaveAccessibleName("Close");
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Read action" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "View Source" }));
    await user.tab();
    expect(document.activeElement).toHaveAccessibleName("Close");
    await user.tab({ shift: true });
    expect(document.activeElement).toHaveAccessibleName("View Source");
  });
});
