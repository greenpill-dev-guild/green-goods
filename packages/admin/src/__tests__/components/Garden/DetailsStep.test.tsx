/**
 * @vitest-environment happy-dom
 */
// TEST-QUALITY: allow-small-test-file - the Web name field's availability states are this file's one subject, and a fourth case would repeat one of the three

import { default as enMessages } from "@green-goods/shared/i18n/en.json";
import {
  resetCreateGardenStore,
  useCreateGardenStore,
} from "@green-goods/shared/stores/useCreateGardenStore";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockUseSlugAvailability } = vi.hoisted(() => ({
  mockUseSlugAvailability: vi.fn(),
}));

vi.mock("@green-goods/shared/hooks/ens/useSlugAvailability", () => ({
  useSlugAvailability: (slug: string | undefined) => mockUseSlugAvailability(slug),
}));

import { DetailsStep } from "../../../components/Garden/CreateGardenSteps/DetailsStep";

const TAKEN = enMessages["app.garden.create.slugTaken"];
const UNCHECKED = enMessages["app.garden.create.slugUnchecked"];

/** What the availability query looks like to the field once a check has settled. */
function availability(state: { data: boolean | undefined; isError: boolean }) {
  mockUseSlugAvailability.mockReturnValue({ ...state, isFetching: false });
}

function renderWebNameField() {
  render(
    <IntlProvider locale="en" messages={enMessages}>
      <DetailsStep showValidation={false} />
    </IntlProvider>
  );
  return screen.getByRole("textbox", { name: "Web name" });
}

describe("components/Garden/CreateGardenSteps/DetailsStep", () => {
  beforeEach(() => {
    mockUseSlugAvailability.mockReset();
    resetCreateGardenStore();
    useCreateGardenStore.getState().setField("slug", "river-garden");
  });

  it("says a name the chain couldn't be asked about is unchecked, not taken", () => {
    availability({ data: undefined, isError: true });

    const field = renderWebNameField();

    expect(mockUseSlugAvailability).toHaveBeenCalledWith("river-garden");
    expect(field).toHaveAccessibleDescription(UNCHECKED);
    expect(field).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByText(TAKEN)).not.toBeInTheDocument();
  });

  it("still says a name the chain reports as taken is taken", () => {
    availability({ data: false, isError: false });

    const field = renderWebNameField();

    expect(field).toHaveAccessibleDescription(TAKEN);
    expect(field).toHaveAttribute("aria-invalid", "true");
  });

  it("keeps the chain's taken answer when a later check fails", () => {
    availability({ data: false, isError: true });

    const field = renderWebNameField();

    expect(field).toHaveAccessibleDescription(TAKEN);
    expect(screen.queryByText(UNCHECKED)).not.toBeInTheDocument();
  });
});
