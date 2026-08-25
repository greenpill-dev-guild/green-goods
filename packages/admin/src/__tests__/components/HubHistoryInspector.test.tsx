/**
 * @vitest-environment jsdom
 */

import type { ActivityEvent } from "@green-goods/shared/hooks/admin-ui/hub/hub.utils";
import ptMessages from "@green-goods/shared/i18n/pt";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { describe, expect, it } from "vitest";
import { HubHistoryInspector } from "@/views/Hub/components/HubHistoryInspector";

const EVENT: ActivityEvent = {
  id: "work-1",
  category: "work",
  title: "Infrastructure Milestone - 2026-07-07T16:36:37.231Z",
  description: "Aprovado",
  timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000,
  href: "/hub/history/work-1",
  itemId: "work-1",
};

describe("HubHistoryInspector", () => {
  it("localizes the milestone title and the event age in Portuguese", () => {
    render(
      <IntlProvider locale="pt" messages={ptMessages}>
        <HubHistoryInspector event={EVENT} />
      </IntlProvider>
    );

    expect(
      screen.getByText("Marco de infraestrutura - 2026-07-07T16:36:37.231Z")
    ).toBeInTheDocument();
    expect(screen.queryByText(/Infrastructure Milestone/)).not.toBeInTheDocument();

    expect(screen.getByText("há 3 dias")).toBeInTheDocument();
    expect(screen.queryByText("3 days ago")).not.toBeInTheDocument();
  });
});
