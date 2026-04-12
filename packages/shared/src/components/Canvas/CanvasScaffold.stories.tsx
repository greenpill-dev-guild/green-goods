import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import {
  RiCheckLine,
  RiClipboardLine,
  RiFileList3Line,
  RiInboxLine,
  RiMedalLine,
} from "@remixicon/react";
import {
  CanvasEmptyStateShell,
  CanvasMetaStrip,
  CanvasMobileActionSlot,
  CanvasSheetFrame,
  CanvasStageTabRail,
  CanvasWorkbenchList,
  CanvasWorkbenchRow,
} from "./CanvasScaffold";

const meta = {
  title: "Canvas/CanvasScaffold",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Gallery: Story = {
  render: () => (
    <div className="min-h-screen space-y-8 bg-bg-weak p-6">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-text-sub">Meta strip</h3>
        <CanvasMetaStrip
          items={[
            { id: "garden", label: "Civic Garden" },
            { id: "freshness", value: "2m", label: "since refresh" },
          ]}
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-text-sub">Stage rail</h3>
        <CanvasStageTabRail
          ariaLabel="Hub stages"
          activeId="work"
          onChange={fn()}
          tabs={[
            { id: "work", label: "Work", icon: RiCheckLine, count: 8 },
            { id: "assess", label: "Assess", icon: RiFileList3Line, count: 3 },
            { id: "certify", label: "Certify", icon: RiMedalLine, count: 2 },
            { id: "history", label: "History", icon: RiClipboardLine },
          ]}
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-text-sub">Workbench list</h3>
        <CanvasWorkbenchList>
          <CanvasWorkbenchRow
            eyebrow="Work"
            title="Compost delivery and resident training"
            description="Action 42 · 0x1234...5678"
            meta={["Pending", "5m ago"]}
            statusLabel="Pending"
            statusTone="pending"
            leadingIcon={RiInboxLine}
            onClick={fn()}
          />
          <CanvasWorkbenchRow
            eyebrow="Certify"
            title="Seasonal growing assessment"
            description="Ready for mint handoff."
            meta={["Impact", "1h ago"]}
            statusLabel="Ready to certify"
            statusTone="certify"
            leadingIcon={RiMedalLine}
            selected
            onClick={fn()}
          />
        </CanvasWorkbenchList>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-text-sub">Empty shell</h3>
        <CanvasEmptyStateShell>
          <p className="max-w-md text-center text-sm text-text-sub">
            No work is waiting here yet. Route-specific guidance should sit inside the shell, not
            outside it.
          </p>
        </CanvasEmptyStateShell>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-text-sub">Sheet frame</h3>
        <div className="max-w-md rounded-[1.5rem] bg-bg-white p-4 shadow-[var(--edge-rest)]">
          <CanvasSheetFrame>
            <div className="rounded-2xl bg-bg-soft p-4 text-sm text-text-sub">
              Shared sheet content framing for Hub inspectors.
            </div>
          </CanvasSheetFrame>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-text-sub">Mobile primary action slot</h3>
        <div className="max-w-md">
          <CanvasMobileActionSlot
            action={{
              icon: RiInboxLine,
              label: "Submit work",
              onClick: fn(),
            }}
            className="mx-0"
          />
        </div>
      </section>
    </div>
  ),
};
