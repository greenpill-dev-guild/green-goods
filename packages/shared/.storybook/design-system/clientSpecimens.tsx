/**
 * Specimen sets shared by the App and Website pages: the same shared primitives
 * render on both surfaces, only the rules they are graded against differ.
 */
import {
  RiAddLine,
  RiArrowRightLine,
  RiCloseLine,
  RiDeleteBinLine,
  RiLinkM,
  RiNotification3Line,
  RiShareLine,
} from "@remixicon/react";
import { type CSSProperties, useState } from "react";
import { Button, type ButtonEmphasis, type ButtonTone } from "../../src/components/Button";
import { Chip } from "../../src/components/Chip";
import {
  NativeSelect,
  Switch,
  TextInput,
  Textarea,
} from "../../src/components/Form/ControlPrimitives";
import { FormattedAmountInput } from "../../src/components/Form/FormattedAmountInput";
import { IconButton } from "../../src/components/IconButton";
import { Row, Specimen, TokenTable } from "./measure";
import { APP, APP_SIZES, type AppSize, WEBSITE } from "./rules";

export type ClientRules = typeof APP | typeof WEBSITE;

const EMPHASES: ButtonEmphasis[] = ["primary", "secondary", "tertiary"];
const TONES: ButtonTone[] = ["default", "danger", "warning"];
const SIZE_LABEL: Record<AppSize, string> = {
  lg: "lg · 48",
  md: "md · 44",
  sm: "sm · 40",
  compact: "compact · 32",
};

/** Swaps the resting corner token for the pressed one, so the press morph shows at rest. */
export const PRESSED: CSSProperties = {
  ["--gg-button-radius" as string]: "var(--gg-button-radius-pressed)",
};

/** Every emphasis × tone at one size, graded as one set. */
export function ButtonMatrix({ rules, size }: { rules: ClientRules; size: AppSize }) {
  return (
    <Specimen
      title={`Emphasis × tone · ${SIZE_LABEL[size]}`}
      target=".gg-button"
      all
      expect={rules.button(size)}
      wide
    >
      <div className="grid w-full gap-3" style={{ gridTemplateColumns: "repeat(3, max-content)" }}>
        {TONES.map((tone) =>
          EMPHASES.map((emphasis) => (
            <div key={`${tone}-${emphasis}`}>
              <Button emphasis={emphasis} tone={tone} size={size}>
                {tone === "default"
                  ? { primary: "Create Garden", secondary: "Cancel", tertiary: "Show More" }[emphasis]
                  : tone === "danger"
                    ? { primary: "Remove Photo", secondary: "Leave Garden", tertiary: "Delete Draft" }[
                        emphasis
                      ]
                    : { primary: "Pause Pool", secondary: "Override", tertiary: "Dismiss" }[emphasis]}
              </Button>
            </div>
          ))
        )}
      </div>
    </Specimen>
  );
}

export function ButtonStates({ rules }: { rules: ClientRules }) {
  return (
    <Row>
      <Specimen title="loading (stays focusable)" expect={rules.button("md")}>
        <Button loading>Submitting Work</Button>
        <Button emphasis="secondary" loading>
          Saving
        </Button>
      </Specimen>
      <Specimen title="disabled" expect={rules.button("md")}>
        <Button disabled>Create Garden</Button>
        <Button emphasis="secondary" disabled>
          Cancel
        </Button>
        <Button emphasis="tertiary" disabled>
          Show More
        </Button>
      </Specimen>
      <Specimen
        title="pressed corner (simulated)"
        expect={{ radius: rules.cornerPressed, weight: rules.weight }}
        note="The resting corner token is swapped for the pressed one: one step tighter (DL-001, DL-026). No morph under reduced motion."
      >
        <div data-pressed-demo style={PRESSED} className="flex flex-wrap items-center gap-3">
          <Button>Create Garden</Button>
          <Button emphasis="secondary">Cancel</Button>
        </div>
      </Specimen>
      <Specimen title="leading and trailing icons" expect={rules.button("md")}>
        <Button leadingIcon={<RiAddLine className="h-4 w-4" aria-hidden="true" />}>Add Link</Button>
        <Button
          emphasis="secondary"
          trailingIcon={<RiArrowRightLine className="h-4 w-4" aria-hidden="true" />}
        >
          Continue
        </Button>
      </Specimen>
      <Specimen title="as a link (asChild)" target="a" expect={rules.button("md")}>
        <Button asChild emphasis="secondary">
          <a href="#buttons">Explore Gardens</a>
        </Button>
      </Specimen>
      <Specimen title="full width in a stack" target=".gg-button" all expect={rules.button("md")} wide>
        <div className="flex w-full max-w-sm flex-col gap-2">
          <Button className="w-full">Confirm Commitment</Button>
          <Button emphasis="secondary" className="w-full">
            Cancel
          </Button>
        </div>
      </Specimen>
    </Row>
  );
}

export function IconButtons({ rules }: { rules: ClientRules }) {
  return (
    <Row>
      {APP_SIZES.map((size) => (
        <Specimen
          key={size}
          title={`tertiary / secondary / primary · ${SIZE_LABEL[size]}`}
          target=".gg-icon-button"
          all
          expect={rules.iconButton(size)}
        >
          <IconButton aria-label="Share" size={size} icon={<RiShareLine />} />
          <IconButton aria-label="Close" size={size} emphasis="secondary" icon={<RiCloseLine />} />
          <IconButton aria-label="Add" size={size} emphasis="primary" icon={<RiAddLine />} />
        </Specimen>
      ))}
      <Specimen title="danger · md" target=".gg-icon-button" all expect={rules.iconButton("md")}>
        <IconButton aria-label="Remove" tone="danger" icon={<RiDeleteBinLine />} />
        <IconButton
          aria-label="Delete"
          tone="danger"
          emphasis="primary"
          icon={<RiDeleteBinLine />}
        />
      </Specimen>
      <Specimen title="with badge · compact" expect={rules.iconButton("compact")}>
        <IconButton
          aria-label="Notifications, 3 unread"
          size="compact"
          emphasis="secondary"
          icon={<RiNotification3Line />}
          badge={
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-action px-1 text-[10px] font-semibold text-primary-action-foreground">
              3
            </span>
          }
        />
      </Specimen>
      <Specimen title="loading / disabled · md" target=".gg-icon-button" all expect={rules.iconButton("md")}>
        <IconButton aria-label="Recording" loading icon={<RiShareLine />} />
        <IconButton aria-label="Share" disabled icon={<RiShareLine />} />
      </Specimen>
    </Row>
  );
}

export function Chips({ rules }: { rules: ClientRules }) {
  const [selected, setSelected] = useState("offers");
  return (
    <Row>
      <Specimen title="toggle · compact 32" target=".gg-chip" all expect={rules.chip("compact")}>
        <Chip selected={selected === "all"} onClick={() => setSelected("all")}>
          All
        </Chip>
        <Chip selected={selected === "offers"} onClick={() => setSelected("offers")}>
          Offers
        </Chip>
        <Chip selected={selected === "requests"} onClick={() => setSelected("requests")}>
          Requests
        </Chip>
      </Specimen>
      <Specimen title="radio group · sm 40" target=".gg-chip" all expect={rules.chip("sm")}>
        <div role="radiogroup" aria-label="Domain" className="flex flex-wrap gap-2">
          <Chip role="radio" size="sm" selected>
            Agroforestry
          </Chip>
          <Chip role="radio" size="sm">
            Solar
          </Chip>
        </div>
      </Specimen>
      <Specimen title="icon and disabled" target=".gg-chip" all expect={rules.chip("compact")}>
        <Chip leadingIcon={<RiLinkM className="h-4 w-4" aria-hidden="true" />}>Linked</Chip>
        <Chip disabled>Archived</Chip>
      </Specimen>
    </Row>
  );
}

export function Fields({ rules, website }: { rules: ClientRules; website?: boolean }) {
  const [amount, setAmount] = useState("12.5");
  const [on, setOn] = useState(true);
  return (
    <Row>
      <Specimen title="text · sm 40 / md 44 / lg 48" target=".gg-control" all wide>
        <div className="flex w-full max-w-md flex-col gap-2">
          <TextInput aria-label="Small field" controlSize="sm" placeholder="sm · 40px" />
          <TextInput aria-label="Medium field" placeholder="md · 44px" />
          <TextInput aria-label="Large field" controlSize="lg" placeholder="lg · 48px" />
        </div>
      </Specimen>
      <Specimen title="text · md states" target=".gg-control" all expect={rules.field("md")} wide>
        <div className="flex w-full max-w-md flex-col gap-2">
          <TextInput aria-label="Value" defaultValue="Rio Claro Community Garden" />
          <TextInput aria-label="Invalid" invalid defaultValue="0x00" />
          <TextInput aria-label="Disabled" disabled defaultValue="Disabled" />
        </div>
      </Specimen>
      <Specimen title="select · md 44" target=".gg-control" expect={rules.field("md")}>
        <NativeSelect aria-label="Domain" defaultValue="agro">
          <option value="agro">Agroforestry</option>
          <option value="solar">Solar</option>
        </NativeSelect>
      </Specimen>
      <Specimen title="textarea" target=".gg-control" expect={{ radius: 16, family: rules.family }}>
        <Textarea aria-label="Notes" placeholder="What did you observe?" rows={3} />
      </Specimen>
      <Specimen
        title="amount · md 44 with Max"
        targets={[
          { name: "input", selector: "input.gg-control", expect: rules.field("md") },
          { name: "action", selector: ".gg-button", expect: rules.button("md") },
        ]}
        wide
      >
        <div className="w-full max-w-sm">
          <FormattedAmountInput
            value={amount}
            onValueChange={setAmount}
            aria-label="Amount to deposit"
            startSlot={<span aria-hidden="true">$</span>}
            endSlot={
              <Button emphasis="secondary" type="button">
                Max
              </Button>
            }
          />
        </div>
      </Specimen>
      <Specimen title="switch" target='[role="switch"]'>
        <Switch aria-label="Open joining" checked={on} onCheckedChange={setOn} />
      </Specimen>
      {website ? (
        <>
          <Specimen title="editorial underline field" expect={WEBSITE.editorialField()}>
            <TextInput aria-label="Email" surface="editorial" placeholder="you@example.com" />
          </Specimen>
          <Specimen
            title="editorial display amount"
            target="input.gg-control"
            expect={WEBSITE.editorialField()}
            note="Display-size serif digits stay inside the 44px step (DL-023)."
          >
            <TextInput
              aria-label="Amount"
              surface="editorial"
              className="text-2xl"
              defaultValue="25.00"
            />
          </Specimen>
        </>
      ) : null}
    </Row>
  );
}

export function HitAreas({ rules }: { rules: ClientRules }) {
  return (
    <Specimen
      title="Hit areas (dashed): sm and compact reach 48px"
      targets={[
        {
          name: "buttons and icon buttons",
          selector: ".gg-button, .gg-icon-button",
          all: true,
          expect: { hit: rules.button("compact").hit },
        },
        { name: "chips", selector: ".gg-chip", all: true, expect: { hit: rules.chip().hit } },
      ]}
      note="The dashed box is the ::after pseudo-element each short control lays out for the finger (DL-023). Chips reach 44px, buttons and icon buttons 48px."
      wide
    >
      <div className="sb-show-hit flex flex-wrap items-center gap-5 py-3">
        <Button size="compact" emphasis="secondary">
          Compact 32
        </Button>
        <Button size="sm">Small 40</Button>
        <IconButton aria-label="Share" size="compact" emphasis="secondary" icon={<RiShareLine />} />
        <IconButton aria-label="Close" size="sm" icon={<RiCloseLine />} />
        <Chip>Chip 32</Chip>
      </div>
    </Specimen>
  );
}

export function ClientTokens({ rules, scopeSelector }: { rules: ClientRules; scopeSelector?: string }) {
  return (
    <TokenTable
      scopeSelector={scopeSelector}
      tokens={[
        { name: "--gg-button-radius", expected: `${rules.cornerRest}px`, note: "every emphasis" },
        { name: "--gg-button-radius-pressed", expected: `${rules.cornerPressed}px`, note: "while pressed" },
        { name: "--gg-button-weight", expected: String(rules.weight), note: "label weight" },
        { name: "--radius-squircle", expected: "12px", note: "the app's pressed corner, DesignMD rounded.squircle" },
        { name: "--radius-lg", expected: "16px", note: "fields, DesignMD rounded.lg" },
        { name: "--radius-md", expected: "8px", note: "tags and text badges, DesignMD rounded.md" },
        { name: "--radius-full", expected: "9999px", note: "chips" },
        { name: "--text-label-md", expected: "16px", note: "lg and md button labels" },
        { name: "--text-label-sm", expected: "14px", note: "sm and compact labels, chips" },
        { name: "--text-label-sm--font-weight", expected: "400", note: "the app's label weight" },
        { name: "--font-serif", note: "editorial serif (website)" },
      ]}
    />
  );
}
