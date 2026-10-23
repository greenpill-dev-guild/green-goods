import type { Meta, StoryObj } from "@storybook/react";
import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useWindowEvent } from "../../hooks/utils/useEventListener";

/**
 * Visual documentation of the type roles: one set of names for every surface
 * (title, body, label, meta, and field text), each at the density of the
 * surface that draws it.
 *
 * The roles are the `type-*` utilities at the end of shared `theme.css`. They
 * read `--gg-type-<role>-size|line|weight|tracking`: `theme.css` holds the
 * installed app's values and admin `src/index.css` the cockpit's (mirrored for
 * Storybook in `surfaces.css`). Every specimen below reports what the browser
 * rendered, so the page cannot drift from the tokens.
 */

/* -------------------------------------------------------------------------- */
/*  Data                                                                       */
/* -------------------------------------------------------------------------- */

type TypeRole = {
  className: string;
  job: string;
  sampleText: string;
};

const roles: TypeRole[] = [
  {
    className: "type-title-lg",
    job: "Page, dialog, flow and step titles",
    sampleText: "Start a Season",
  },
  {
    className: "type-title-md",
    job: "Section, sheet and card titles",
    sampleText: "Approved Work",
  },
  {
    className: "type-title-sm",
    job: "Compact titles: work cards, list items, values",
    sampleText: "Seedling Transplant",
  },
  {
    className: "type-body",
    job: "Reading text",
    sampleText: "Approved work appears here once a steward confirms it.",
  },
  {
    className: "type-label",
    job: "Labels and actions",
    sampleText: "Submit Work",
  },
  {
    className: "type-label-sm",
    job: "Small labels, field labels and secondary lines",
    sampleText: "Time spent (hours)",
  },
  {
    className: "type-meta",
    job: "Metadata and supporting text",
    sampleText: "Submitted 3 days ago",
  },
  {
    className: "type-meta-sm",
    job: "Chips and the smallest supporting lines",
    sampleText: "Agroforestry",
  },
  {
    className: "type-field",
    job: "Field text and checkbox and choice labels",
    sampleText: "36 seedlings",
  },
];

/* -------------------------------------------------------------------------- */
/*  Rendering helpers                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Size / line height · weight · tracking, as the browser rendered them. It reads
 * again on resize, since field text changes size at 640px in the cockpit.
 */
function useRenderedType() {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState("");
  const read = useCallback(() => {
    if (!ref.current) return;
    const style = getComputedStyle(ref.current);
    const tracking = style.letterSpacing === "normal" ? "0" : style.letterSpacing;
    setValue(
      `${Number.parseFloat(style.fontSize)}/${Number.parseFloat(style.lineHeight)} · ${style.fontWeight} · ${tracking}`
    );
  }, []);
  useLayoutEffect(read, [read]);
  useWindowEvent("resize", read);
  return { ref, value };
}

function Specimen({ role }: { role: TypeRole }) {
  const { ref, value } = useRenderedType();
  return (
    <div className="min-w-0 space-y-1">
      <span ref={ref} className={`${role.className} block truncate text-text-strong-950`}>
        {role.sampleText}
      </span>
      <span className="block font-mono type-meta text-text-soft-400">{value}</span>
    </div>
  );
}

function RoleRow({ role }: { role: TypeRole }) {
  return (
    <div className="grid grid-cols-1 gap-3 border-b border-stroke-soft-200 py-4 md:grid-cols-[12rem_1fr_1fr] md:gap-6">
      <div className="min-w-0">
        <div className="font-mono type-label-sm text-text-strong-950">{role.className}</div>
        <div className="type-meta text-text-sub-600">{role.job}</div>
      </div>
      <Specimen role={role} />
      <div data-surface-scope="admin">
        <Specimen role={role} />
      </div>
    </div>
  );
}

function RoleTable() {
  return (
    <section>
      <div className="hidden grid-cols-[12rem_1fr_1fr] gap-6 border-b-2 border-stroke-sub-300 pb-2 md:grid">
        <span className="type-label-sm font-medium text-text-strong-950">Role</span>
        <span className="type-label-sm font-medium text-text-strong-950">Installed app</span>
        <span className="type-label-sm font-medium text-text-strong-950">Cockpit</span>
      </div>
      {roles.map((role) => (
        <RoleRow key={role.className} role={role} />
      ))}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Meta                                                                       */
/* -------------------------------------------------------------------------- */

const meta: Meta = {
  title: "Shared/Tokens/Typography",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The type roles: three titles, body, two labels, two meta sizes, and field text. Each is a `type-*` utility that keeps one name on every surface and takes the density of the surface that draws it: the installed app at 16px body, the cockpit at 14px. A weight, leading, or tracking utility on the same element adjusts a role.",
      },
    },
  },
};
export default meta;
type Story = StoryObj;

/* -------------------------------------------------------------------------- */
/*  Stories                                                                     */
/* -------------------------------------------------------------------------- */

/** Every role on the installed app and the cockpit, with the rendered values. */
export const Default: Story = {
  render: () => (
    <div className="space-y-6">
      <p className="max-w-2xl type-label-sm text-text-sub-600">
        Each role keeps one name on both surfaces and takes the density of the surface that draws
        it. The values under each specimen are what this browser rendered: size and line height in
        pixels, then weight and tracking. In the cockpit, field text is 16px on touch widths and
        14px from 640px.
      </p>
      <RoleTable />
    </div>
  ),
};

/** The same roles with the Storybook dark theme toggled. */
export const DarkMode: Story = {
  render: () => (
    <div className="space-y-6">
      <p className="max-w-2xl type-label-sm text-text-sub-600">
        Roles carry size, line height, weight and tracking, never color: text color comes from the
        semantic <code>text-*</code> tokens, which follow the theme. Use the toolbar theme toggle to
        compare.
      </p>
      <RoleTable />
    </div>
  ),
};
