import type { Meta, StoryObj } from "@storybook/react";
import { RiUploadCloudLine } from "@remixicon/react";
import { fn } from "storybook/test";
import { AdminButton } from "../AdminButton";
import { AdminLinearProgress } from "../AdminLinearProgress";
import { ActionFlowShell } from "./ActionFlowShell";

function FormPreview({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="space-y-1.5">
          <div className="h-3 w-28 rounded bg-bg-weak" />
          <div className="h-10 w-full rounded-lg border border-stroke-soft bg-bg-white" />
        </div>
      ))}
    </div>
  );
}

function ProgressFooter({ busy, label }: { busy?: boolean; label?: string }) {
  return (
    <>
      <div className="min-w-0 flex-1" aria-live="polite">
        {busy ? (
          <div className="space-y-1.5">
            <AdminLinearProgress ariaLabel={label} />
            <p className="truncate text-sm text-text-sub">{label}</p>
          </div>
        ) : null}
      </div>
      <div className="flex gap-2">
        <AdminButton type="button" variant="text" disabled={busy} onClick={fn()}>
          Cancel
        </AdminButton>
        <AdminButton
          type="button"
          variant="filled"
          loading={busy}
          disabled={busy}
          leadingIcon={<RiUploadCloudLine />}
          onClick={fn()}
        >
          Submit
        </AdminButton>
      </div>
    </>
  );
}

const meta: Meta<typeof ActionFlowShell> = {
  title: "Admin/Shell/ActionFlowShell",
  component: ActionFlowShell,
  tags: ["autodocs"],
  decorators: [
    // Height-bounded box so the pinned footer behaves as it does inside the
    // centered 2xl AdminDialog (flow variant) that hosts these flows.
    (Story) => (
      <div className="h-[640px] w-full max-w-3xl overflow-hidden rounded-xl border border-stroke-soft bg-[rgb(var(--m3-surface))]">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          'Shared chrome for admin action flows: pinned header (back-arrow + context + title), one scrolling body, and an optional pinned footer. Solid surfaces only — no glass — per the Controlled Chrome boundary. Renders inside a centered AdminDialog (size="2xl" variant="flow"), a bottom-sheet on mobile; it is the only title bar in the flow.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ActionFlowShell>;

// Configure phase: in-flow back-arrow + pinned footer with idle progress slot.
export const Configure: Story = {
  args: {
    title: "Submit work",
    context: "Aiyeloja Family Garden",
    backLabel: "Back to action selection",
    onBack: fn(),
    layout: "dialog",
    children: <FormPreview rows={4} />,
    footer: <ProgressFooter />,
  },
};

// Execute: footer shows the linear progress bar + staged label; controls disabled.
export const Submitting: Story = {
  args: {
    ...Configure.args,
    children: <FormPreview rows={4} />,
    footer: <ProgressFooter busy label="Uploading photos…" />,
  },
};

// Qualify phase: no back-arrow (first phase), no footer — selection auto-advances.
export const QualifyPhase: Story = {
  args: {
    title: "Submit work",
    context: "Aiyeloja Family Garden",
    layout: "dialog",
    children: (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-28 rounded-lg border border-stroke-soft bg-bg-white" />
        ))}
      </div>
    ),
  },
};

// Long body to exercise body-only scroll with pinned header + footer.
export const ScrollingBody: Story = {
  args: {
    ...Configure.args,
    children: <FormPreview rows={12} />,
    footer: <ProgressFooter />,
  },
};

// Mobile route layout: no reserved close-button space (route owns exit).
export const PageLayout: Story = {
  args: {
    ...Configure.args,
    layout: "page",
  },
};
