/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import enMessages from "@green-goods/shared/i18n/en";

import { resetCreateGardenStore, useCreateGardenStore } from "@green-goods/shared";
import { ReviewStep } from "../../../components/Garden/CreateGardenSteps/ReviewStep";

const OPERATOR_AND_GARDENER = "0x1234567890123456789012345678901234567890";
const GARDENER = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";

describe("components/Garden/CreateGardenSteps/ReviewStep", () => {
  beforeEach(() => {
    resetCreateGardenStore();
    const store = useCreateGardenStore.getState();

    store.setField("name", "River Garden");
    store.setField("slug", "river-garden");
    store.setField("description", "Protecting the river delta");
    store.setField("location", "Portland, Oregon");
    store.addOperator(OPERATOR_AND_GARDENER);
    store.addGardener(OPERATOR_AND_GARDENER);
    store.addGardener(GARDENER);
  });

  it("shows unique planned member counts and makes action domains explicit", () => {
    render(
      <IntlProvider locale="en" messages={enMessages}>
        <ReviewStep />
      </IntlProvider>
    );

    expect(screen.getByText("2 unique members")).toBeInTheDocument();
    expect(screen.getByText("Not configured during deployment")).toBeInTheDocument();
  });
});
