import type { Meta, StoryObj } from "@storybook/react";
import { RiArrowRightLine, RiSearchLine } from "@remixicon/react";
import { CardBase, CardContent, CardDescription, CardHeader, CardTitle } from "../Cards";
import { FormInput } from "../Form/FormInput";
import { FormTextarea } from "../Form/FormTextarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../Form/Select";
import { iconButtonIconVariants, iconButtonVariants } from "./foundation";

const meta = {
  title: "Tokens/Foundation",
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const ControlsAndChrome: Story = {
  render: () => (
    <div className="grid gap-6 lg:grid-cols-2">
      <CardBase size="auto">
        <CardHeader>
          <CardTitle>Control Scale</CardTitle>
          <CardDescription>Shared inputs, textarea, and select sizing.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FormInput id="foundation-input-sm" label="Small input" placeholder="40px" />
          <FormInput id="foundation-input-md" label="Medium input" placeholder="44px" />
          <FormTextarea
            id="foundation-textarea-lg"
            label="Large textarea"
            placeholder="48px control with expanded content area"
          />
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Small select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="shared">Shared foundation</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </CardBase>

      <CardBase size="auto">
        <CardHeader>
          <CardTitle>Icon Buttons And Cards</CardTitle>
          <CardDescription>Shared icon-button and card shell contract.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className={iconButtonVariants({ size: "sm" })}
              aria-label="Search"
            >
              <RiSearchLine className={iconButtonIconVariants({ size: "sm" })} />
            </button>
            <button
              type="button"
              className={iconButtonVariants({ size: "md" })}
              aria-label="Search"
            >
              <RiSearchLine className={iconButtonIconVariants({ size: "md" })} />
            </button>
            <button type="button" className={iconButtonVariants({ size: "lg" })} aria-label="Next">
              <RiArrowRightLine className={iconButtonIconVariants({ size: "lg" })} />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <CardBase size="sm">
              <CardContent>Compact card spacing</CardContent>
            </CardBase>
            <CardBase size="md" interactive>
              <CardContent>Interactive card shell</CardContent>
            </CardBase>
          </div>
        </CardContent>
      </CardBase>
    </div>
  ),
};
