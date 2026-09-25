/** @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import { ConfidenceSelector } from "../../components/Form/ConfidenceSelector";
import { Confidence } from "../../types/domain";

function renderSelector(props: Partial<React.ComponentProps<typeof ConfidenceSelector>> = {}) {
  const onChange = vi.fn();
  const view = render(
    <IntlProvider locale="en" onError={() => undefined}>
      <ConfidenceSelector value={Confidence.NONE} onChange={onChange} {...props} />
    </IntlProvider>
  );
  return { ...view, onChange };
}

describe("ConfidenceSelector", () => {
  it("starts a required choice with nothing chosen and no None option", () => {
    const { onChange } = renderSelector({ required: true });

    const radios = screen.getAllByRole("radio");
    expect(radios.map((radio) => radio.textContent)).toEqual(["Low", "Medium", "High"]);
    expect(radios.every((radio) => radio.getAttribute("aria-checked") === "false")).toBe(true);
    // The group stays reachable by Tab while nothing is chosen.
    expect(radios.map((radio) => radio.tabIndex)).toEqual([0, -1, -1]);
    expect(screen.queryByText("Reasonably confident")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Medium confidence" }));
    expect(onChange).toHaveBeenCalledWith(Confidence.MEDIUM);
  });

  it("moves on from the focused chip when an arrow is pressed with nothing chosen", () => {
    const { onChange } = renderSelector({ required: true });
    const low = screen.getByRole("radio", { name: "Low confidence" });
    low.focus();

    fireEvent.keyDown(low, { key: "ArrowRight" });

    expect(onChange).toHaveBeenCalledWith(Confidence.MEDIUM);
  });

  it("shows the chosen level's hint once a level is chosen", () => {
    renderSelector({ required: true, value: Confidence.MEDIUM });

    expect(screen.getByRole("radio", { name: "Medium confidence" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByText("Reasonably confident")).toBeInTheDocument();
  });

  it("keeps None as a choice when a level is optional", () => {
    renderSelector();

    expect(screen.getByRole("radio", { name: "None confidence" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });
});
