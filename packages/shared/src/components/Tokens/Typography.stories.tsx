import type { Meta, StoryObj } from "@storybook/react";
import React from "react";

/**
 * Visual documentation of the Green Goods typography scale.
 *
 * Typography tokens are defined in `storybook.css` via `@theme` blocks and
 * consumed through Tailwind utility classes like `text-title-h1`,
 * `text-label-md`, `text-paragraph-sm`, and `text-subheading-xs`.
 *
 * Each token defines four properties: font-size, line-height, letter-spacing,
 * and font-weight -- bundled as a Tailwind `fontSize` shorthand.
 */

/* -------------------------------------------------------------------------- */
/*  Data                                                                       */
/* -------------------------------------------------------------------------- */

type TypographyToken = {
  name: string;
  className: string;
  size: string;
  lineHeight: string;
  letterSpacing: string;
  weight: number;
  sampleText: string;
};

const titles: TypographyToken[] = [
  {
    name: "title-h1",
    className: "text-title-h1",
    size: "56px",
    lineHeight: "64px",
    letterSpacing: "-0.01em",
    weight: 500,
    sampleText: "Heading One",
  },
  {
    name: "title-h2",
    className: "text-title-h2",
    size: "48px",
    lineHeight: "56px",
    letterSpacing: "-0.01em",
    weight: 500,
    sampleText: "Heading Two",
  },
  {
    name: "title-h3",
    className: "text-title-h3",
    size: "40px",
    lineHeight: "48px",
    letterSpacing: "-0.01em",
    weight: 500,
    sampleText: "Heading Three",
  },
  {
    name: "title-h4",
    className: "text-title-h4",
    size: "32px",
    lineHeight: "40px",
    letterSpacing: "-0.005em",
    weight: 500,
    sampleText: "Heading Four",
  },
  {
    name: "title-h5",
    className: "text-title-h5",
    size: "24px",
    lineHeight: "32px",
    letterSpacing: "0px",
    weight: 500,
    sampleText: "Heading Five",
  },
  {
    name: "title-h6",
    className: "text-title-h6",
    size: "20px",
    lineHeight: "28px",
    letterSpacing: "0px",
    weight: 500,
    sampleText: "Heading Six",
  },
];

const labels: TypographyToken[] = [
  {
    name: "label-xl",
    className: "text-label-xl",
    size: "24px",
    lineHeight: "32px",
    letterSpacing: "-0.015em",
    weight: 500,
    sampleText: "Extra Large Label",
  },
  {
    name: "label-lg",
    className: "text-label-lg",
    size: "18px",
    lineHeight: "24px",
    letterSpacing: "-0.015em",
    weight: 500,
    sampleText: "Large Label",
  },
  {
    name: "label-md",
    className: "text-label-md",
    size: "16px",
    lineHeight: "24px",
    letterSpacing: "-0.011em",
    weight: 500,
    sampleText: "Medium Label",
  },
  {
    name: "label-sm",
    className: "text-label-sm",
    size: "14px",
    lineHeight: "20px",
    letterSpacing: "-0.006em",
    weight: 400,
    sampleText: "Small Label",
  },
  {
    name: "label-xs",
    className: "text-label-xs",
    size: "12px",
    lineHeight: "16px",
    letterSpacing: "0px",
    weight: 500,
    sampleText: "Extra Small Label",
  },
];

const paragraphs: TypographyToken[] = [
  {
    name: "paragraph-xl",
    className: "text-paragraph-xl",
    size: "24px",
    lineHeight: "32px",
    letterSpacing: "-0.015em",
    weight: 400,
    sampleText: "Extra large paragraph text for hero sections and introductions.",
  },
  {
    name: "paragraph-lg",
    className: "text-paragraph-lg",
    size: "18px",
    lineHeight: "24px",
    letterSpacing: "-0.015em",
    weight: 400,
    sampleText: "Large paragraph text for prominent body copy and descriptions.",
  },
  {
    name: "paragraph-md",
    className: "text-paragraph-md",
    size: "16px",
    lineHeight: "24px",
    letterSpacing: "-0.011em",
    weight: 400,
    sampleText: "Medium paragraph text -- the default body size for most content.",
  },
  {
    name: "paragraph-sm",
    className: "text-paragraph-sm",
    size: "14px",
    lineHeight: "20px",
    letterSpacing: "-0.006em",
    weight: 400,
    sampleText: "Small paragraph text for secondary content and captions.",
  },
  {
    name: "paragraph-xs",
    className: "text-paragraph-xs",
    size: "12px",
    lineHeight: "16px",
    letterSpacing: "0px",
    weight: 400,
    sampleText: "Extra small paragraph text for footnotes and fine print.",
  },
];

const subheadings: TypographyToken[] = [
  {
    name: "subheading-md",
    className: "text-subheading-md",
    size: "16px",
    lineHeight: "24px",
    letterSpacing: "0.06em",
    weight: 500,
    sampleText: "MEDIUM SUBHEADING",
  },
  {
    name: "subheading-sm",
    className: "text-subheading-sm",
    size: "14px",
    lineHeight: "20px",
    letterSpacing: "0.06em",
    weight: 500,
    sampleText: "SMALL SUBHEADING",
  },
  {
    name: "subheading-xs",
    className: "text-subheading-xs",
    size: "12px",
    lineHeight: "16px",
    letterSpacing: "0.04em",
    weight: 500,
    sampleText: "EXTRA SMALL SUBHEADING",
  },
  {
    name: "subheading-2xs",
    className: "text-subheading-2xs",
    size: "11px",
    lineHeight: "12px",
    letterSpacing: "0.02em",
    weight: 500,
    sampleText: "2XS SUBHEADING",
  },
];

const allGroups = [
  { label: "Titles", tokens: titles },
  { label: "Labels", tokens: labels },
  { label: "Paragraphs", tokens: paragraphs },
  { label: "Subheadings", tokens: subheadings },
];

/* -------------------------------------------------------------------------- */
/*  Rendering helpers                                                          */
/* -------------------------------------------------------------------------- */

function Specimen({ token }: { token: TypographyToken }) {
  return (
    <div className="flex items-baseline gap-6 py-4 border-b border-stroke-soft-200">
      <div className="flex-1 min-w-0">
        <div className={`${token.className} text-text-strong-950 truncate`}>{token.sampleText}</div>
      </div>
      <div className="shrink-0 text-right space-y-0.5">
        <div className="text-label-xs text-text-strong-950 font-mono">{token.className}</div>
        <div className="text-[10px] text-text-soft-400 font-mono">
          {token.size} / {token.lineHeight} / {token.letterSpacing} / {token.weight}
        </div>
      </div>
    </div>
  );
}

function TokenGroup({ label, tokens }: { label: string; tokens: TypographyToken[] }) {
  return (
    <section className="mb-10">
      <h3 className="text-label-lg text-text-strong-950 mb-2 pb-2 border-b-2 border-stroke-sub-300">
        {label}
      </h3>
      {tokens.map((t) => (
        <Specimen key={t.name} token={t} />
      ))}
    </section>
  );
}

function MetadataTable({ tokens }: { tokens: TypographyToken[] }) {
  return (
    <table className="w-full text-paragraph-xs text-text-sub-600 border-collapse">
      <thead>
        <tr className="text-left border-b border-stroke-sub-300">
          <th className="py-2 pr-4 text-label-xs text-text-strong-950">Token</th>
          <th className="py-2 pr-4 text-label-xs text-text-strong-950">Size</th>
          <th className="py-2 pr-4 text-label-xs text-text-strong-950">Line Height</th>
          <th className="py-2 pr-4 text-label-xs text-text-strong-950">Letter Spacing</th>
          <th className="py-2 text-label-xs text-text-strong-950">Weight</th>
        </tr>
      </thead>
      <tbody>
        {tokens.map((t) => (
          <tr key={t.name} className="border-b border-stroke-soft-200">
            <td className="py-1.5 pr-4 font-mono">{t.className}</td>
            <td className="py-1.5 pr-4">{t.size}</td>
            <td className="py-1.5 pr-4">{t.lineHeight}</td>
            <td className="py-1.5 pr-4">{t.letterSpacing}</td>
            <td className="py-1.5">{t.weight}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* -------------------------------------------------------------------------- */
/*  Meta                                                                       */
/* -------------------------------------------------------------------------- */

const meta: Meta = {
  title: "Design Tokens/Typography",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The typography scale provides consistent sizing, line-height, letter-spacing, and weight values. Four categories: Titles (h1-h6), Labels (xl-xs), Paragraphs (xl-xs), and Subheadings (md-2xs). Each resolves to a Tailwind `text-*` utility.",
      },
    },
  },
};
export default meta;
type Story = StoryObj;

/* -------------------------------------------------------------------------- */
/*  Stories                                                                     */
/* -------------------------------------------------------------------------- */

/** All typography specimens grouped by category. */
export const Default: Story = {
  render: () => (
    <div>
      <p className="text-paragraph-sm text-text-sub-600 mb-6">
        Typography tokens are defined in <code>storybook.css</code> and consumed as Tailwind
        utilities. Each token bundles size, line-height, letter-spacing, and weight.
      </p>
      {allGroups.map((g) => (
        <TokenGroup key={g.label} label={g.label} tokens={g.tokens} />
      ))}
    </div>
  ),
};

/** Title specimens h1 through h6 with full metadata. */
export const Headings: Story = {
  render: () => (
    <div>
      <TokenGroup label="Titles" tokens={titles} />
      <div className="mt-6">
        <h4 className="text-label-sm text-text-strong-950 mb-3">Reference Table</h4>
        <MetadataTable tokens={titles} />
      </div>
    </div>
  ),
};

/** Label specimens xl through xs with full metadata. */
export const Labels: Story = {
  render: () => (
    <div>
      <TokenGroup label="Labels" tokens={labels} />
      <div className="mt-6">
        <h4 className="text-label-sm text-text-strong-950 mb-3">Reference Table</h4>
        <MetadataTable tokens={labels} />
      </div>
    </div>
  ),
};

/** Paragraph specimens xl through xs with full metadata. */
export const Paragraphs: Story = {
  render: () => (
    <div>
      <TokenGroup label="Paragraphs" tokens={paragraphs} />
      <div className="mt-6">
        <h4 className="text-label-sm text-text-strong-950 mb-3">Reference Table</h4>
        <MetadataTable tokens={paragraphs} />
      </div>
    </div>
  ),
};

/** All tokens rendered with the Storybook dark theme toggled. */
export const DarkMode: Story = {
  render: () => (
    <div>
      <p className="text-paragraph-sm text-text-sub-600 mb-6">
        Typography tokens are theme-agnostic (sizes and weights stay the same). The text color comes
        from semantic <code>text-*</code> tokens, which flip automatically when{" "}
        <code>[data-theme=&quot;dark&quot;]</code> is active. Use the toolbar theme toggle to verify.
      </p>
      {allGroups.map((g) => (
        <TokenGroup key={g.label} label={g.label} tokens={g.tokens} />
      ))}
    </div>
  ),
};
