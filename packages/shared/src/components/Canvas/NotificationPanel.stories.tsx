import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { IntlProvider } from "react-intl";
import {
  NotificationPanel,
  type NotificationPanelItem,
  type NotificationPanelTone,
} from "./NotificationPanel";

const meta: Meta<typeof NotificationPanel> = {
  title: "Shared/Canvas/NotificationPanel",
  component: NotificationPanel,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: [
          "**NotificationPanel** — list rendered inside the right-sheet bell. Anatomy",
          "aligned to `design_handoff_admin-revamp/screens/sheet-system.{jsx,css}`",
          "NOTIFICATIONS:",
          "",
          "- 36×36 colored icon wrapper per item (info / warn / critical)",
          "- Optional `unread` dot at the top-right of the icon wrapper",
          "- Title 13/600, body 12/400, meta 11/500 tabular-nums",
          "- `actionLabel` (when paired with `onSelect`) renders a tone-action labeled button",
          "  on the right ('Review' / 'View'); falling back to a quiet chevron when unset.",
          "",
          "**Accessibility**:",
          "- Tone color is supplemental — title text is the primary accessible label",
          '- Unread dot is announced via `aria-label="Unread"`, not via color alone',
          "- Row is a `<button>` when `onSelect` is set (full keyboard activation)",
          "- Focus ring uses `var(--tone-action, var(--green-800))`",
        ].join("\n"),
      },
    },
    a11y: {
      config: {
        rules: [
          { id: "color-contrast", enabled: true },
          { id: "button-name", enabled: true },
          { id: "aria-allowed-attr", enabled: true },
        ],
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof NotificationPanel>;

const Frame = ({ children }: { children: React.ReactNode }) => (
  <IntlProvider locale="en" messages={{}}>
    <div
      className="overflow-hidden border border-stroke-soft bg-bg-white-0"
      style={{ width: 360, height: 480, borderRadius: "var(--radius-sheet, 24px)" }}
    >
      {children}
    </div>
  </IntlProvider>
);

const baseItem = (
  id: string,
  title: string,
  description: string,
  meta: string,
  tone: NotificationPanelTone = "info"
): NotificationPanelItem => ({
  id,
  title,
  description,
  meta,
  tone,
  onSelect: fn(),
});

// --- core variants ---------------------------------------------------------

/** Mixed-tone roster matching handoff defaults (submission / flag / certified / system). */
export const Default: Story = {
  render: () => (
    <Frame>
      <NotificationPanel
        items={[
          {
            ...baseItem(
              "n1",
              "New submission pending review",
              'Maria Garcia submitted "Planted 50 native saplings" in Milpa Alta.',
              "2 min ago",
              "info"
            ),
            unread: true,
            actionLabel: "Review",
          },
          {
            ...baseItem(
              "n2",
              "Submission flagged",
              "Luis Hernández's “Pollinator strip seeded” was flagged for missing evidence.",
              "18 min ago",
              "warn"
            ),
            unread: true,
            actionLabel: "View",
          },
          {
            ...baseItem(
              "n3",
              "Action certified",
              "Marta Vega's “Greywater filter assembled” passed certification in Xochimilco.",
              "1h ago",
              "info"
            ),
          },
          {
            ...baseItem(
              "n4",
              "Submission rejected",
              "Photos missing — coordinator returned the entry for re-upload.",
              "Yesterday",
              "critical"
            ),
          },
        ]}
      />
    </Frame>
  ),
};

// --- tone-only variants ----------------------------------------------------

/** Info tone — neutral surface; default for everyday notifications. */
export const InfoTone: Story = {
  render: () => (
    <Frame>
      <NotificationPanel
        items={[
          baseItem("i1", "Daily digest ready", "10 actions reviewed yesterday.", "8h ago", "info"),
          baseItem(
            "i2",
            "Weekly report published",
            "October impact summary is live.",
            "Yesterday",
            "info"
          ),
        ]}
      />
    </Frame>
  ),
};

/** Warn tone — amber wrapper; flagged submissions and warnings. */
export const WarnTone: Story = {
  render: () => (
    <Frame>
      <NotificationPanel
        items={[
          baseItem(
            "w1",
            "Submission flagged",
            "Missing evidence on Pollinator strip submission.",
            "12 min ago",
            "warn"
          ),
          baseItem(
            "w2",
            "Garden capacity low",
            "Operator queue at 80% — consider adding reviewers.",
            "1h ago",
            "warn"
          ),
        ]}
      />
    </Frame>
  ),
};

/** Critical tone — red wrapper; rejections and errors. */
export const CriticalTone: Story = {
  render: () => (
    <Frame>
      <NotificationPanel
        items={[
          baseItem(
            "c1",
            "Submission rejected",
            "Photos missing — entry returned for re-upload.",
            "30 min ago",
            "critical"
          ),
          baseItem(
            "c2",
            "Vault deposit failed",
            "Network timeout — retry from Treasury → Vault.",
            "2h ago",
            "critical"
          ),
        ]}
      />
    </Frame>
  ),
};

// --- state variants --------------------------------------------------------

/** Unread-only roster — every row carries the tone-tinted dot at the icon wrapper top-right. */
export const WithUnreadDot: Story = {
  render: () => (
    <Frame>
      <NotificationPanel
        items={[
          {
            ...baseItem("u1", "New submission pending", "Maria Garcia · 2m ago", "2m", "info"),
            unread: true,
          },
          {
            ...baseItem("u2", "Submission flagged", "Luis Hernández · 18m ago", "18m", "warn"),
            unread: true,
          },
          {
            ...baseItem(
              "u3",
              "Vault deposit failed",
              "Network timeout — retry needed",
              "2h",
              "critical"
            ),
            unread: true,
          },
        ]}
      />
    </Frame>
  ),
};

/** Action-labeled rows — labeled tone-action button instead of chevron. */
export const WithActionLabels: Story = {
  render: () => (
    <Frame>
      <NotificationPanel
        items={[
          {
            ...baseItem(
              "a1",
              "Submission pending review",
              "Diego Flores · Milpa Alta",
              "5m ago",
              "info"
            ),
            actionLabel: "Review",
          },
          {
            ...baseItem("a2", "Action certified", "Marta Vega · Xochimilco", "1h ago", "info"),
            actionLabel: "View",
          },
        ]}
      />
    </Frame>
  ),
};

/** Loading state — inline spinner placeholder while items resolve. */
export const LoadingState: Story = {
  render: () => (
    <Frame>
      <NotificationPanel isLoading={true} />
    </Frame>
  ),
};

/** Empty state — inbox icon + reassuring copy when there are no notifications. */
export const EmptyState: Story = {
  render: () => (
    <Frame>
      <NotificationPanel items={[]} />
    </Frame>
  ),
};
