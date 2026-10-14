import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { Route, Routes } from "react-router-dom";
import { expect, within } from "storybook/test";

import { withRouter } from "../../../../../../shared/.storybook/decorators";
import { PromiseGroupLine } from "./PromiseGroupNote";

/** The line sits on a promise's page, and its link is relative to that route. */
const withPromiseRoute: Decorator = (Story) => (
  <Routes>
    <Route path="/home/:id/commitments/:commitmentId" element={<Story />} />
  </Routes>
);

/**
 * The one line a copy's own page gains (PRD-1029 c5): it is one of several
 * separate promises, the reader's is confirmed on its own, and See the Group
 * goes back to the rest.
 */
const meta: Meta<typeof PromiseGroupLine> = {
  title: "Client/Commitments/PromiseGroupLine",
  component: PromiseGroupLine,
  tags: ["autodocs", "storybook-ci"],
  globals: { viewport: { value: "mobile" } },
  decorators: [
    withPromiseRoute,
    withRouter(["/home/garden/commitments/104"]),
    (Story) => (
      <div className="max-w-sm p-4">
        <Story />
      </div>
    ),
  ],
  args: { count: 10, yours: true, to: "../group/story-water-survey?copy=104" },
};

export default meta;
type Story = StoryObj<typeof PromiseGroupLine>;

/** The reader's own copy: confirmed on its own, whatever the other nine do. */
export const Yours: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("One of 10 separate promises. Yours is confirmed on its own.")
    ).toBeVisible();
    // The link names this copy, so the group still opens after a reload.
    await expect(canvas.getByRole("link", { name: "See the Group" })).toHaveAttribute(
      "href",
      "/home/garden/commitments/group/story-water-survey?copy=104"
    );
  },
};

/** Somebody else's copy: only that it is one of several. */
export const SomeoneElses: Story = {
  args: { yours: false },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("One of 10 separate promises.")).toBeVisible();
  },
};
