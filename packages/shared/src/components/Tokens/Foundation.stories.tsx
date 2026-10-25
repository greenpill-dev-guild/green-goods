import type { Meta, StoryObj } from "@storybook/react";
import { RiArrowRightLine, RiSearchLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { FormInput } from "../Form/FormInput";
import { FormTextarea } from "../Form/FormTextarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../Form/Select";
import { iconButtonIconVariants, iconButtonVariants } from "./foundation";

const meta = {
  title: "Shared/Tokens/Foundation",
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** A specimen panel on the one card surface (.gg-card). */
function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="gg-card flex flex-col gap-4 p-6">
      <header className="flex flex-col gap-1">
        <h3 className="type-title-sm text-text-strong">{title}</h3>
        <p className="type-meta text-text-sub">{description}</p>
      </header>
      {children}
    </section>
  );
}

export const ControlsAndChrome: Story = {
  render: () => (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Control Scale" description="Shared inputs, textarea, and select sizing.">
        <div className="flex flex-col gap-4">
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
        </div>
      </Panel>

      <Panel
        title="Icon Buttons And Cards"
        description="Shared icon-button and card shell contract."
      >
        <div className="flex flex-col gap-5">
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
            <div className="gg-card p-2">Compact card spacing</div>
            <button type="button" className="gg-card p-4 text-left">
              Interactive card shell
            </button>
          </div>
        </div>
      </Panel>
    </div>
  ),
};
