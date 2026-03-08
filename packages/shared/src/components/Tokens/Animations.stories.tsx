import type { Meta, StoryObj } from "@storybook/react";
import React, { useCallback, useEffect, useRef, useState } from "react";

/**
 * Visual documentation and interactive playground for the Green Goods
 * animation system.
 *
 * Animations are defined as `@keyframes` in `storybook.css` and consumed
 * via CSS utility classes (`.animate-fade-in-up`, `.toast-enter`, etc.)
 * or Tailwind `animate-*` shorthand tokens.
 *
 * All animations respect `prefers-reduced-motion: reduce` via the global
 * media query rule.
 */

/* -------------------------------------------------------------------------- */
/*  Data                                                                       */
/* -------------------------------------------------------------------------- */

type AnimationToken = {
  name: string;
  className: string;
  duration: string;
  easing: string;
  description: string;
  /** keyframes name for reference */
  keyframes: string;
};

const animations: AnimationToken[] = [
  {
    name: "Accordion Down",
    className: "animate-accordion-down",
    duration: "0.2s",
    easing: "ease-out",
    keyframes: "accordion-down",
    description: "Expands from height:0 with a blur+contrast effect for smooth reveal.",
  },
  {
    name: "Accordion Up",
    className: "animate-accordion-up",
    duration: "0.2s",
    easing: "ease-out",
    keyframes: "accordion-up",
    description: "Collapses to height:0 with a blur+contrast exit effect.",
  },
  {
    name: "Spring Bump",
    className: "animate-spring-bump",
    duration: "0.56s",
    easing: "ease-in-out",
    keyframes: "spring-bump",
    description: "Scale 0.8 -> 1.1 -> 0.95 -> 1.0 spring overshoot micro-interaction.",
  },
  {
    name: "Fade In Up",
    className: "animate-fade-in-up",
    duration: "0.4s",
    easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    keyframes: "fade-in-up",
    description: "Fade in while translating up 20px. Used for staggered list items.",
  },
  {
    name: "Fade In Scale",
    className: "animate-fade-in-scale",
    duration: "0.3s",
    easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    keyframes: "fade-in-scale",
    description: "Fade in with a subtle scale(0.95 -> 1) for card/element entrances.",
  },
  {
    name: "Toast Enter",
    className: "toast-enter",
    duration: "0.35s",
    easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    keyframes: "toastSlideInRight",
    description: "Slides in from right with opacity transition for toast notifications.",
  },
  {
    name: "Toast Exit",
    className: "toast-exit",
    duration: "0.3s",
    easing: "cubic-bezier(0.4, 0, 1, 1)",
    keyframes: "toastSlideOutRight",
    description: "Slides out to the right with opacity fade for toast dismissal.",
  },
  {
    name: "Modal Backdrop",
    className: "modal-backdrop-enter",
    duration: "0.3s",
    easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    keyframes: "modalBackdropFadeIn",
    description: "Fades in backdrop overlay with a blur(0 -> 4px) transition.",
  },
  {
    name: "Modal Slide In",
    className: "modal-slide-enter",
    duration: "0.4s",
    easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    keyframes: "modalSlideIn",
    description: "Slides up from bottom with a slight overshoot at 60% for modals.",
  },
];

/* -------------------------------------------------------------------------- */
/*  Rendering helpers                                                          */
/* -------------------------------------------------------------------------- */

function AnimationCard({ animation }: { animation: AnimationToken }) {
  return (
    <div className="flex items-start gap-4 py-4 border-b border-stroke-soft-200">
      <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <div className="w-6 h-6 rounded bg-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-label-sm text-text-strong-950 font-medium">{animation.name}</div>
        <div className="text-paragraph-xs text-text-sub-600 mt-0.5">{animation.description}</div>
        <div className="flex gap-4 mt-2">
          <span className="text-[10px] text-text-soft-400 font-mono">.{animation.className}</span>
          <span className="text-[10px] text-text-soft-400">{animation.duration}</span>
          <span className="text-[10px] text-text-soft-400">{animation.easing}</span>
        </div>
      </div>
    </div>
  );
}

/** Trigger button that replays an animation on click by toggling the class. */
function TriggerButton({ animation }: { animation: AnimationToken }) {
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const play = useCallback(() => {
    setPlaying(false);
    // Force reflow to reset animation
    requestAnimationFrame(() => {
      setPlaying(true);
    });
  }, []);

  // Reset after animation completes
  useEffect(() => {
    if (!playing || !ref.current) return;

    const el = ref.current;
    const handler = () => setPlaying(false);
    el.addEventListener("animationend", handler);
    return () => el.removeEventListener("animationend", handler);
  }, [playing]);

  // Determine preview styling based on animation type
  const isToastExit = animation.className === "toast-exit";
  const isModal = animation.className.startsWith("modal");
  const isAccordion = animation.className.includes("accordion");

  return (
    <div className="flex flex-col items-center gap-3 w-52">
      <div className="w-full h-28 rounded-xl border border-stroke-soft-200 bg-bg-weak-50 flex items-center justify-center overflow-hidden relative">
        {isModal && animation.className.includes("backdrop") ? (
          <div
            ref={ref}
            className={`absolute inset-0 bg-black/20 ${playing ? animation.className : "opacity-0"}`}
            style={{ backdropFilter: playing ? undefined : "blur(0px)" }}
          />
        ) : isModal ? (
          <div
            ref={ref}
            className={`w-32 h-16 bg-bg-white-0 rounded-lg shadow-regular-md border border-stroke-soft-200 flex items-center justify-center ${playing ? animation.className : ""}`}
            style={playing ? undefined : { transform: "translate3d(0, 100%, 0)", opacity: 0 }}
          >
            <span className="text-[10px] text-text-soft-400">Modal</span>
          </div>
        ) : isAccordion ? (
          <div className="w-36 overflow-hidden">
            <div
              ref={ref}
              className={playing ? animation.className : ""}
              style={{
                height:
                  playing && animation.className.includes("up")
                    ? 0
                    : playing
                      ? 64
                      : animation.className.includes("up")
                        ? 64
                        : 0,
                overflow: "hidden",
              }}
            >
              <div className="h-16 bg-primary/20 rounded-lg flex items-center justify-center">
                <span className="text-[10px] text-text-soft-400">Content</span>
              </div>
            </div>
          </div>
        ) : (
          <div
            ref={ref}
            className={`w-12 h-12 rounded-lg bg-primary flex items-center justify-center ${playing ? animation.className : ""}`}
            style={
              !playing
                ? {
                    opacity: isToastExit ? 1 : undefined,
                    transform: isToastExit ? "translateX(0)" : undefined,
                  }
                : undefined
            }
          >
            <span className="text-[10px] text-white font-medium">Go</span>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={play}
        className="px-3 py-1.5 rounded-lg text-label-xs bg-bg-soft-200 text-text-strong-950 border border-stroke-soft-200 hover:bg-bg-sub-300 active:scale-95 transition-all"
      >
        Play {animation.name}
      </button>
      <div className="text-center space-y-0.5">
        <div className="text-[10px] text-text-soft-400 font-mono">.{animation.className}</div>
        <div className="text-[10px] text-text-soft-400">
          {animation.duration} {animation.easing}
        </div>
      </div>
    </div>
  );
}

/** Stagger demo showing multiple items entering in sequence. */
function StaggerDemo() {
  const [active, setActive] = useState(false);

  const replay = useCallback(() => {
    setActive(false);
    requestAnimationFrame(() => setActive(true));
  }, []);

  return (
    <div>
      <button
        type="button"
        onClick={replay}
        className="mb-4 px-4 py-2 rounded-lg text-label-sm bg-primary text-primary-foreground active:scale-95 transition-transform"
      >
        Replay Stagger
      </button>
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-12 rounded-lg bg-bg-soft-200 border border-stroke-soft-200 flex items-center px-4 ${active ? "stagger-item" : ""}`}
            style={{
              animationDelay: active ? `${i * 0.08}s` : undefined,
              opacity: active ? undefined : 0,
            }}
          >
            <span className="text-label-sm text-text-strong-950">Item {i + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Meta                                                                       */
/* -------------------------------------------------------------------------- */

const meta: Meta = {
  title: "Design Tokens/Animation",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The animation system covers accordions, spring micro-interactions, staggered list entrances, toast notifications, and modal transitions. All animations respect `prefers-reduced-motion: reduce`.",
      },
    },
  },
};
export default meta;
type Story = StoryObj;

/* -------------------------------------------------------------------------- */
/*  Stories                                                                     */
/* -------------------------------------------------------------------------- */

/** Gallery of all animation tokens with descriptions. */
export const Default: Story = {
  render: () => (
    <div>
      <p className="text-paragraph-sm text-text-sub-600 mb-6">
        Animations are defined as <code>@keyframes</code> in <code>storybook.css</code> and consumed
        via CSS classes. The global <code>prefers-reduced-motion</code> rule collapses all durations
        to near-zero for accessibility.
      </p>
      {animations.map((a) => (
        <AnimationCard key={a.name} animation={a} />
      ))}

      <div className="mt-8">
        <h3 className="text-label-lg text-text-strong-950 mb-4 pb-2 border-b border-stroke-soft-200">
          Stagger Items
        </h3>
        <p className="text-paragraph-xs text-text-sub-600 mb-4">
          The <code>.stagger-item</code> class uses <code>fade-in-up</code> with per-item{" "}
          <code>animation-delay</code> for sequential list entrance.
        </p>
        <StaggerDemo />
      </div>
    </div>
  ),
};

/** Interactive playground: click buttons to trigger each animation. */
export const Interactive: Story = {
  render: () => (
    <div>
      <p className="text-paragraph-sm text-text-sub-600 mb-6">
        Click any button below to replay its animation. The preview box shows the animation in
        isolation so you can observe timing and easing.
      </p>
      <div className="flex flex-wrap gap-6">
        {animations.map((a) => (
          <TriggerButton key={a.name} animation={a} />
        ))}
      </div>
    </div>
  ),
};

/** Animations rendered with dark theme for contrast verification. */
export const DarkMode: Story = {
  render: () => (
    <div>
      <p className="text-paragraph-sm text-text-sub-600 mb-6">
        Animations are theme-agnostic -- timing and easing stay constant. Colors come from semantic
        tokens that adapt automatically. Use the toolbar theme toggle to verify contrast.
      </p>
      <div className="flex flex-wrap gap-6">
        {animations.map((a) => (
          <TriggerButton key={a.name} animation={a} />
        ))}
      </div>
    </div>
  ),
};
