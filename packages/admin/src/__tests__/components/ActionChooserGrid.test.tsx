/**
 * @vitest-environment happy-dom
 */

import { type Action, Capital, Domain } from "@green-goods/shared/types/domain";
import ptMessages from "@green-goods/shared/i18n/pt.json";
import { fireEvent, render, screen } from "@testing-library/react";
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
  it("titles canonical actions in the cockpit's words across all four domains", () => {
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

    const group = screen.getByRole("radiogroup", { name: "Ação" });
    expect(group).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /Verificação de energia e disponibilidade/ })
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Atividade de manutenção/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Oficina realizada/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Triagem e detalhamento/ })).toBeInTheDocument();
    expect(screen.queryByText("Energy & Uptime Check")).not.toBeInTheDocument();
    expect(screen.queryByText("Sorting & Breakdown")).not.toBeInTheDocument();
  });

  it("chooses an action by id, and treats an empty selection as nothing chosen", () => {
    const onSelect = vi.fn();
    render(
      <IntlProvider locale="pt" messages={ptMessages}>
        <ActionChooserGrid
          actions={ACTIONS}
          selectedActionId=""
          onSelect={onSelect}
          groupLabel="Ação"
        />
      </IntlProvider>
    );

    const radios = screen.getAllByRole("radio");
    expect(radios.every((radio) => radio.getAttribute("aria-checked") === "false")).toBe(true);
    expect(radios[0]).toHaveAttribute("tabindex", "0");
    fireEvent.click(screen.getByRole("radio", { name: /Oficina realizada/ }));
    expect(onSelect).toHaveBeenCalledWith("edu");
  });
});
