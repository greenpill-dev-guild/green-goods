import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { AdminSelectableCard } from "./AdminSelectableCard";

const meta: Meta<typeof AdminSelectableCard> = {
  title: "Admin/Primitives/AdminSelectableCard",
  component: AdminSelectableCard,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: [
          "**AdminSelectableCard** — the admin card-shaped selector for richer choices.",
          "Use it for domain, theme, action-template, and similar choices that need",
          "a title plus supporting copy or metadata. Use `AdminTabRail` for exclusive",
          "mode switches and `AdminFilterChip` for compact filters.",
          "",
          "Selection semantics are explicit: the default toggle role exposes",
          '`aria-pressed`, and `selectionRole="radio"` exposes `aria-checked` inside',
          "a parent radiogroup.",
        ].join("\n"),
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof AdminSelectableCard>;

function ToggleGroupExample() {
  const [selected, setSelected] = useState("solar");

  return (
    <div className="grid max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
      {[
        ["solar", "Solar", "Track installations and energy production."],
        ["education", "Education", "Record workshops and training outcomes."],
      ].map(([id, title, description]) => (
        <AdminSelectableCard
          key={id}
          title={title}
          description={description}
          selected={selected === id}
          onClick={() => setSelected(id)}
        />
      ))}
    </div>
  );
}

function RadioCardsExample() {
  const [selected, setSelected] = useState("review");

  return (
    <div role="radiogroup" aria-label="Action type" className="grid max-w-2xl gap-2">
      {[
        ["review", "Review submission", "Check evidence and approve or return work."],
        ["attest", "Create Assessment", "Record a structured evaluation."],
      ].map(([id, title, description]) => (
        <AdminSelectableCard
          key={id}
          title={title}
          description={description}
          selected={selected === id}
          selectionRole="radio"
          onClick={() => setSelected(id)}
        />
      ))}
    </div>
  );
}

export const ToggleGroup: Story = {
  render: () => <ToggleGroupExample />,
};

export const RadioCards: Story = {
  render: () => <RadioCardsExample />,
};
