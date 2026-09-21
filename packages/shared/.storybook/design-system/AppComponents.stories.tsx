import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { withInstalledPwa } from "../decorators";
import {
  ButtonMatrix,
  ButtonStates,
  Chips,
  Fields,
  HitAreas,
  IconButtons,
} from "./clientSpecimens";
import { Page, Section, StoryLink } from "./measure";
import { APP, APP_SIZES, STORY_LINKS } from "./rules";

const meta = {
  title: "Design System/App/Components",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    surface: "app",
    docs: {
      description: {
        component:
          "The installed app's control family: the shared Button (every emphasis × tone × size × state), IconButton, Chip, and the field primitives, rendered on the app surface and measured live against the app rules (16px corner, 12px pressed, weight 400, 48 / 44 / 40 / 32 with a 48px hit area on the short sizes, 16px fields).",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every emphasis, tone, size, and state of the shared family on the app surface. */
export const Buttons: Story = {
  tags: ["storybook-ci"],
  render: () => (
    <Page
      title="Installed app · Components"
      lede="One primitive family, one corner. Every specimen is the shared component measured in this browser; chips read green while the app rules hold."
    >
      <Section id="buttons" title="Button" lede={APP.rules[0]}>
        {APP_SIZES.map((size) => (
          <div key={size} style={{ marginBottom: 12 }}>
            <ButtonMatrix rules={APP} size={size} />
          </div>
        ))}
        <ButtonStates rules={APP} />
        <div className="sb-ds-links" style={{ marginTop: 12 }}>
          <StoryLink id={STORY_LINKS.sharedButton}>Shared/Primitives/Button</StoryLink>
        </div>
      </Section>
      <Section id="icon-buttons" title="IconButton" lede="A circle at the same four sizes; the accessible name is required. Tertiary is transparent until hover, secondary outlined, primary filled.">
        <IconButtons rules={APP} />
        <div className="sb-ds-links" style={{ marginTop: 12 }}>
          <StoryLink id={STORY_LINKS.sharedIconButton}>Shared/Primitives/IconButton</StoryLink>
        </div>
      </Section>
      <Section id="chips" title="Chip" lede="A 32px capsule toggle with a 44px hit area; a selected chip takes the action fill with white text (DL-017).">
        <Chips rules={APP} />
        <div className="sb-ds-links" style={{ marginTop: 12 }}>
          <StoryLink id={STORY_LINKS.sharedChip}>Shared/Primitives/Chip</StoryLink>
        </div>
      </Section>
      <Section id="fields" title="Fields" lede="TextInput, Textarea, NativeSelect, Switch, and FormattedAmountInput: a 16px rounded rectangle on the same height steps as the buttons, so a field and its action line up (DL-022, DL-023).">
        <Fields rules={APP} />
        <div className="sb-ds-links" style={{ marginTop: 12 }}>
          <StoryLink id={STORY_LINKS.sharedControls}>Shared/Form/ControlPrimitives</StoryLink>
          <StoryLink id={STORY_LINKS.sharedAmount}>Shared/Form/FormattedAmountInput</StoryLink>
        </div>
      </Section>
      <Section id="hit-areas" title="Hit areas">
        <HitAreas rules={APP} />
      </Section>
    </Page>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const px = (value: string) => Number.parseFloat(value);
    // Every button except the specimen that simulates the pressed corner.
    const buttons = Array.from(
      canvasElement.querySelectorAll<HTMLElement>(".gg-button[data-emphasis]")
    ).filter((button) => !button.closest("[data-pressed-demo]"));
    await expect(buttons.length).toBeGreaterThan(30);
    for (const button of buttons) {
      // The compact size keeps the corner's proportion: 12px on 32px (DL-038).
      await expect(px(getComputedStyle(button).borderTopLeftRadius)).toBe(
        button.dataset.size === "compact" ? 12 : 16
      );
      await expect(getComputedStyle(button).fontWeight).toBe("400");
    }
    const compact = canvas.getAllByRole("button", { name: "Compact 32" })[0];
    await expect(compact.getBoundingClientRect().height).toBe(32);
    await expect(px(getComputedStyle(compact, "::after").height)).toBe(48);
    const field = canvas.getByRole("textbox", { name: "Medium field" });
    await expect(field.getBoundingClientRect().height).toBe(44);
    await expect(px(getComputedStyle(field).borderTopLeftRadius)).toBe(16);
  },
};

/** The same family inside the installed-PWA frame, at phone width. */
export const InPhoneFrame: Story = {
  decorators: [withInstalledPwa({ heightClassName: "min-h-[480px]" })],
  render: () => (
    <div className="flex flex-col gap-4 p-4">
      <ButtonMatrix rules={APP} size="md" />
      <HitAreas rules={APP} />
    </div>
  ),
};
