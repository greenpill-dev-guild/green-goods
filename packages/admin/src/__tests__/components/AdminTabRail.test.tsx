import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import { AdminTabRail } from "../../components/AdminTabRail";

describe("AdminTabRail", () => {
  it("keeps translated label descenders outside clipping containers", () => {
    render(
      <IntlProvider locale="es" messages={{}}>
        <AdminTabRail
          ariaLabel="Secciones de la comunidad"
          activeId="payouts"
          onChange={vi.fn()}
          tabs={[
            { id: "members", label: "Miembros" },
            { id: "coordination", label: "Coordinación" },
            { id: "endowment", label: "Dotación" },
            { id: "payouts", label: "Pagos" },
          ]}
        />
      </IntlProvider>
    );

    const label = screen.getByText("Pagos");
    expect(label).toHaveClass("whitespace-nowrap");
    expect(label).not.toHaveClass("overflow-hidden");
  });
});
