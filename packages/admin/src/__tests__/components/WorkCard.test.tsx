/**
 * WorkCard Component Tests
 * @vitest-environment jsdom
 */

import type { EASWork } from "@green-goods/shared/types/eas-responses";
import pt from "@green-goods/shared/i18n/pt.json";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { WorkCard } from "@/views/Hub/components/WorkCard";

vi.mock("@green-goods/shared/hooks/blockchain/useEnsName", () => ({
  useEnsName: () => ({ data: undefined }),
}));

describe("WorkCard", () => {
  it("localizes canonical action titles in Portuguese", () => {
    const work = {
      id: "0xwork",
      title: "Maintenance Activity",
      actionUID: 1,
      gardenerAddress: "0x1111111111111111111111111111111111111111",
      gardenAddress: "0x2222222222222222222222222222222222222222",
      feedback: "",
      metadata: "{}",
      media: [],
      createdAt: Date.now() / 1000,
      status: "pending",
    } as EASWork & { status: "pending" };

    render(
      <IntlProvider locale="pt" messages={pt}>
        <MemoryRouter>
          <WorkCard work={work} />
        </MemoryRouter>
      </IntlProvider>
    );

    expect(screen.getByText("Atividade de manutenção")).toBeInTheDocument();
    expect(screen.queryByText("Maintenance Activity")).not.toBeInTheDocument();
  });
});
