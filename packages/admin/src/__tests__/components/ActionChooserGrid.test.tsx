/**
 * @vitest-environment jsdom
 */

import { type Action, Capital, Domain } from "@green-goods/shared";
import ptMessages from "@green-goods/shared/i18n/pt.json";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import { ActionChooserGrid } from "@/views/Garden/components/ActionChooserGrid";

function makeAction(
  id: string,
  slug: string,
  title: string,
  description: string,
  domain: Domain
): Action {
  return {
    id,
    slug,
    title,
    description,
    domain,
    startTime: 0,
    endTime: 0,
    instructions: "",
    capitals: [Capital.SOCIAL],
    media: [],
    createdAt: 0,
    inputs: [],
    mediaInfo: { title: "Evidence", required: true, minImageCount: 1 },
  };
}

const ACTIONS: Action[] = [
  makeAction(
    "solar",
    "solar.energy_uptime_check",
    "Energy & Uptime Check",
    "Record energy generation data and system uptime. Document meter readings and any issues affecting performance.",
    Domain.SOLAR
  ),
  makeAction(
    "agro",
    "agro.maintenance_activity",
    "Maintenance Activity",
    "Document routine garden maintenance activities including watering, weeding, mulching, fencing, and pest management.",
    Domain.AGRO
  ),
  makeAction(
    "edu",
    "edu.deliver_session",
    "Workshop Delivered",
    "Document a completed educational workshop or session. Record delivered duration, facilitator count, and format details.",
    Domain.EDU
  ),
  makeAction(
    "waste",
    "waste.sorting_breakdown",
    "Sorting & Breakdown",
    "Document waste sorting results with per-category weight breakdown. Uses a repeater for category-by-category entries.",
    Domain.WASTE
  ),
];

describe("ActionChooserGrid", () => {
  it("localizes canonical action titles and descriptions across all four domains", () => {
    render(
      <IntlProvider locale="pt" messages={ptMessages}>
        <ActionChooserGrid
          actions={ACTIONS}
          selectedActionId=""
          onSelect={vi.fn()}
          groupLabel="Ação"
        />
      </IntlProvider>
    );

    expect(screen.getByText("Verificação de energia e disponibilidade")).toBeInTheDocument();
    expect(screen.getByText("Atividade de manutenção")).toBeInTheDocument();
    expect(screen.getByText("Oficina realizada")).toBeInTheDocument();
    expect(screen.getByText("Triagem e detalhamento")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Documente os resultados da triagem de resíduos com a divisão do peso por categoria. Use uma lista repetível para entradas categoria por categoria."
      )
    ).toBeInTheDocument();
    expect(screen.queryByText("Energy & Uptime Check")).not.toBeInTheDocument();
    expect(screen.queryByText("Sorting & Breakdown")).not.toBeInTheDocument();
  });
});
