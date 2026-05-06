// packages/shared/src/__tests__/components/Canvas/NotificationPanel.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import { NotificationPanel } from "../../../components/Canvas/NotificationPanel";

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <IntlProvider
      locale="en"
      messages={{
        "app.common.loading": "Loading...",
        "cockpit.notifications.empty.description":
          "Work submissions, assessments, and system alerts will appear here.",
        "cockpit.notifications.empty.title": "No notifications",
      }}
    >
      {ui}
    </IntlProvider>
  );
}

describe("NotificationPanel", () => {
  it("renders loading state", () => {
    renderWithIntl(<NotificationPanel isLoading />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading...");
  });

  it("renders empty state when there are no items", () => {
    renderWithIntl(<NotificationPanel />);

    expect(screen.getByText("No notifications")).toBeInTheDocument();
    expect(screen.getByText(/Work submissions/)).toBeInTheDocument();
  });

  it("renders notification items and calls item actions", () => {
    const onSelect = vi.fn();

    renderWithIntl(
      <NotificationPanel
        items={[
          {
            id: "work-critical",
            title: "3 work submissions need review",
            description: "Garden One",
            meta: "5 minutes ago",
            tone: "critical",
            onSelect,
          },
          {
            id: "impact",
            title: "Impact report minted",
            description: "Hypercert created",
          },
        ]}
      />
    );

    expect(screen.getByText("3 work submissions need review")).toBeInTheDocument();
    expect(screen.getByText("Garden One")).toBeInTheDocument();
    expect(screen.getByText("5 minutes ago")).toBeInTheDocument();
    expect(screen.getByText("Impact report minted")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /3 work submissions need review/i }));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
