import type { Meta, StoryObj } from "@storybook/react";

const roles = [
  ["surface", "--m3-surface", "--bg-white-0"],
  ["surface-container-lowest", "--m3-surface-container-lowest", "--bg-white-0"],
  ["surface-container-low", "--m3-surface-container-low", "--bg-weak-50"],
  ["surface-container", "--m3-surface-container", "--bg-soft-200"],
  ["surface-container-high", "--m3-surface-container-high", "--bg-sub-300"],
  ["surface-container-highest", "--m3-surface-container-highest", "--bg-surface-800"],
  ["on-surface", "--m3-on-surface", "--text-strong-950"],
  ["on-surface-variant", "--m3-on-surface-variant", "--text-sub-600"],
  ["outline", "--m3-outline", "--stroke-sub-300"],
  ["outline-variant", "--m3-outline-variant", "--stroke-soft-200"],
  ["primary", "--m3-primary", "--primary-base"],
  ["primary-container", "--m3-primary-container", "Green Goods brand container"],
  ["error", "--m3-error", "--error-base"],
  ["state-hover/focus/pressed", "--m3-state-*", "--primary-alpha-*"],
];

const meta: Meta = {
  title: "Tokens/Material Roles",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Documentation-only alias map between Material 3 role names and Green Goods semantic tokens. Component authors should continue using Green Goods tokens directly; these aliases exist to make the Material baseline explicit.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const RoleMap: Story = {
  render: () => (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-3">
        {roles.slice(0, 6).map(([label, cssVar]) => (
          <div key={label} className="rounded-xl border border-stroke-soft bg-bg-white p-4 shadow-sm">
            <div
              className="h-16 rounded-lg border border-stroke-soft"
              style={{ backgroundColor: `rgb(var(${cssVar}))` }}
            />
            <p className="mt-3 text-sm font-medium text-text-strong">{label}</p>
            <p className="text-xs text-text-soft">{cssVar}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-stroke-soft bg-bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-bg-weak">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-text-sub">Material role</th>
              <th className="px-4 py-3 text-left font-medium text-text-sub">Alias</th>
              <th className="px-4 py-3 text-left font-medium text-text-sub">Green Goods source</th>
            </tr>
          </thead>
          <tbody>
            {roles.map(([label, cssVar, source]) => (
              <tr key={label} className="border-t border-stroke-soft">
                <td className="px-4 py-3 text-text-strong">{label}</td>
                <td className="px-4 py-3 text-text-sub">{cssVar}</td>
                <td className="px-4 py-3 text-text-sub">{source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  ),
};
