/**
 * Storybook only: the walkthrough shell for clickable journeys. A journey story draws one real
 * page and moves it through its steps; the player frames that story at a device's width beside a
 * panel that names the flows, who the reader is, the step and what it shows. The two talk by
 * `postMessage` inside one origin, so the framed page is the story itself: its sheets, dialogs
 * and media queries behave as they do at that width. Nothing here is product UI.
 */
import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useWindowEvent } from "../src/hooks/utils/useEventListener";

const STEP_MESSAGE = "gg-journey:step";
const GO_MESSAGE = "gg-journey:go";
const EMBED_PARAM = "journeyEmbed";

/** What the panel says about one step. */
export interface JourneyStepNote {
  caption: string;
  /** The other person's act that moves the journey on, as the panel's button. */
  next?: string;
}

export interface JourneyFlow {
  id: string;
  title: string;
  /** Who the reader is in this flow. */
  who: string;
  /** The journey story the stage frames, by Storybook id. */
  story: string;
  steps: readonly JourneyStepNote[];
  /** Waits and recovery states the main path leaves out: a step of this flow's story. */
  sideStates?: readonly { label: string; step: number }[];
  /** More of the story's args, as Storybook's URL writes them (`name:value;name:value`). */
  args?: string;
  /** A flow of waits and recovery, listed apart from the main paths. */
  side?: boolean;
}

export interface JourneyWidth {
  label: string;
  width: number;
  /** A device's height; a page that fills the stage leaves it out. */
  height?: number;
}

/** Whether this window is a journey story framed by the player. */
function isEmbedded(): boolean {
  if (typeof window === "undefined" || window.parent === window) return false;
  return new URLSearchParams(window.location.search).has(EMBED_PARAM);
}

/**
 * A journey story's side of the player: reports its step, and follows the panel's Back and
 * Next. Returns whether the story is framed, so it can leave its own narration band out.
 */
export function useJourneyEmbed(index: number, count: number, go: (index: number) => void) {
  const embedded = useMemo(isEmbedded, []);
  useEffect(() => {
    if (embedded)
      window.parent.postMessage({ type: STEP_MESSAGE, index, count }, window.location.origin);
  }, [embedded, index, count]);
  useWindowEvent("message", (event) => {
    if (!embedded || event.origin !== window.location.origin || event.source !== window.parent)
      return;
    const data = event.data as { type?: string; index?: number } | null;
    if (data?.type !== GO_MESSAGE || !Number.isInteger(data.index)) return;
    go(Math.max(0, Math.min(count - 1, data.index as number)));
  });
  return embedded;
}

/** Opens a story from inside one: in the manager when it is there, else the bare preview. */
function openStory(story: string) {
  const top = window.top ?? window;
  const inManager = top !== window && !isEmbedded();
  if (inManager) top.location.search = `?path=/story/${story}`;
  else window.location.search = `?id=${story}&viewMode=story`;
}

const CSS = `
.jp { display: grid; grid-template-columns: 340px minmax(0, 1fr); height: 100dvh; background: rgb(var(--neutral-200));
  color: rgb(var(--neutral-100)); font: 14px/20px system-ui, sans-serif; }
.jp * { box-sizing: border-box; }
.jp-rail { display: flex; flex-direction: column; gap: 16px; padding: 20px; background: rgb(var(--neutral-900));
  overflow-y: auto; }
.jp-head h1 { margin: 0; color: rgb(var(--neutral-0)); font-size: 18px; line-height: 24px; font-weight: 600; }
.jp-head p { margin: 2px 0 0; color: rgb(var(--neutral-400)); font-size: 12px; line-height: 16px; }
.jp-label { margin: 0 0 6px; color: rgb(var(--neutral-400)); font-size: 11px; line-height: 16px; font-weight: 600;
  letter-spacing: 0.06em; text-transform: uppercase; }
.jp-flows { display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 0; list-style: none; }
.jp-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 36px;
  padding: 6px 14px; border: 1px solid rgb(var(--neutral-700)); border-radius: 9999px; background: transparent;
  color: inherit; font: inherit; font-weight: 500; cursor: pointer; }
.jp-btn:hover:not(:disabled) { background: rgb(var(--neutral-800)); }
.jp-btn:disabled { opacity: 0.4; cursor: default; }
.jp-btn:focus-visible, .jp-flow:focus-visible { outline: 2px solid rgb(var(--neutral-100)); outline-offset: 2px; }
.jp-btn[data-primary] { border-color: rgb(var(--green-300)); background: rgb(var(--green-300)); color: rgb(var(--neutral-900)); }
.jp-btn[data-primary]:hover:not(:disabled) { background: rgb(var(--green-400)); }
.jp .jp-btn[aria-pressed="true"] { border-color: rgb(var(--neutral-100)); background-color: rgb(var(--neutral-100)) !important;
  color: rgb(var(--neutral-900)) !important; }
.jp-flow { display: flex; gap: 10px; width: 100%; padding: 8px 10px; border: 0; border-radius: 10px;
  background: transparent; color: rgb(var(--neutral-300)); font: inherit; text-align: left; cursor: pointer; }
.jp-flow:hover { background: rgb(var(--neutral-800)); }
.jp-flow[aria-current="true"] { background: rgb(var(--neutral-775)); color: rgb(var(--neutral-0)); font-weight: 600; }
.jp-flow span:first-child { color: rgb(var(--neutral-400)); font-variant-numeric: tabular-nums; }
.jp-now { display: flex; flex-direction: column; gap: 8px; padding: 14px; border-radius: 14px;
  background: rgb(var(--neutral-850)); }
.jp-who { margin: 0; color: rgb(var(--green-300)); font-size: 12px; line-height: 16px; font-weight: 600; }
.jp-step { margin: 0; color: rgb(var(--neutral-400)); font-size: 12px; line-height: 16px; font-variant-numeric: tabular-nums; }
.jp-caption { margin: 0; min-height: 100px; color: rgb(var(--neutral-100)); font-size: 15px; line-height: 20px; }
.jp-move { margin: 0; min-height: 32px; color: rgb(var(--neutral-400)); font-size: 12px; line-height: 16px; }
.jp-row { display: flex; flex-wrap: wrap; gap: 8px; }
.jp-side { display: flex; flex-direction: column; gap: 4px; }
.jp-side summary { cursor: pointer; color: rgb(var(--neutral-400)); font-size: 12px; line-height: 20px; }
.jp-states .jp-flow { font-size: 12px; line-height: 16px; }
.jp-foot { margin-top: auto; display: flex; flex-direction: column; gap: 12px; }
.jp-stage { position: relative; min-width: 0; overflow: hidden; }
.jp-screen { position: absolute; top: 50%; left: 50%; transform-origin: center; border: 0;
  background: rgb(var(--neutral-0)); box-shadow: 0 0 0 1px rgb(var(--neutral-300)), 0 18px 40px rgb(var(--neutral-950) / 0.18); }
.jp-screen[data-device] { border-radius: 28px; }
@media (max-width: 899px) {
  .jp { grid-template-columns: 1fr; grid-template-rows: auto minmax(0, 1fr); }
  .jp-rail { max-height: 46dvh; }
  .jp-caption, .jp-move { min-height: 0; }
}
.jb { position: sticky; top: 0; z-index: 50; display: flex; flex-wrap: wrap; align-items: center;
  gap: 8px 16px; padding: 10px 16px; background: rgb(var(--neutral-900)); color: rgb(var(--neutral-100));
  font: 13px/18px system-ui, sans-serif; }
.jb p { margin: 0; flex: 1 1 280px; }
.jb small { display: block; color: rgb(var(--neutral-400)); font-size: 11px; line-height: 16px; }
`;

function PlayerStyles() {
  return <style>{CSS}</style>;
}

/**
 * A journey story's own narration band, for when it is opened alone: the step, its caption,
 * Back, and the other person's act. The player's panel says the same and more.
 */
export function JourneyBand({
  who,
  index,
  count,
  step,
  onGo,
}: {
  who: string;
  index: number;
  count: number;
  step: JourneyStepNote;
  onGo: (index: number) => void;
}) {
  return (
    <div className="jb" data-component="JourneyBand">
      <PlayerStyles />
      <p>
        <small>
          {who} · Step {index + 1} of {count}
        </small>
        {step.caption}
      </p>
      <span className="jp-row">
        <button
          type="button"
          className="jp-btn"
          disabled={index === 0}
          onClick={() => onGo(index - 1)}
        >
          Back
        </button>
        {step.next ? (
          <button type="button" className="jp-btn" data-primary onClick={() => onGo(index + 1)}>
            {step.next}
          </button>
        ) : null}
      </span>
    </div>
  );
}

/** Fits the framed screen to the stage, keeping its own pixel width so the page lays out truly. */
function useStageFit(width: JourneyWidth) {
  const stage = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const node = stage.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setBox({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const margin = 24;
  const room = { width: Math.max(box.width - margin * 2, 1), height: Math.max(box.height - margin * 2, 1) };
  const scale = Math.min(1, room.width / width.width, width.height ? room.height / width.height : 1);
  // A page with no device height fills the stage, at the height that scale leaves it.
  const height = width.height ?? Math.round(room.height / scale);
  return { stage, scale, height };
}

export interface JourneyPlayerProps {
  /** The surface's name, as the panel's heading says it. */
  surface: string;
  flows: readonly JourneyFlow[];
  widths: readonly JourneyWidth[];
  /** The same flows on the other surface, by Storybook id. */
  counterpart?: { label: string; story: string };
  /** A note under the heading, such as what the data is. */
  note?: ReactNode;
}

/** The walkthrough: a panel of flows and the step in hand, beside the journey story it frames. */
export function JourneyPlayer({ surface, flows, widths, counterpart, note }: JourneyPlayerProps) {
  const [flowId, setFlowId] = useState(flows[0]!.id);
  const [index, setIndex] = useState(0);
  const [start, setStart] = useState(0);
  const [width, setWidth] = useState(widths[0]!);
  const frame = useRef<HTMLIFrameElement>(null);
  const flow = flows.find((entry) => entry.id === flowId)!;
  const main = flows.filter((entry) => !entry.side);
  const side = flows.filter((entry) => entry.side);
  const count = flow.steps.length + (flow.sideStates?.length ?? 0);
  const sideState = flow.sideStates?.find((state) => state.step === index);
  const step = flow.steps[index] ?? { caption: sideState?.label ?? "" };
  // The main paths hand on to each other; a side flow or a side state ends where it is.
  const nextFlow = flow.side ? undefined : main[main.indexOf(flow) + 1];
  const last = index >= flow.steps.length - 1;
  const { stage, scale, height } = useStageFit(width);

  useWindowEvent("message", (event) => {
    if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow)
      return;
    const data = event.data as { type?: string; index?: number } | null;
    if (data?.type === STEP_MESSAGE && Number.isInteger(data.index)) setIndex(data.index as number);
  });
  const go = (target: number) =>
    frame.current?.contentWindow?.postMessage(
      { type: GO_MESSAGE, index: target },
      window.location.origin
    );
  const openFlow = (id: string, at = 0) => {
    if (id === flowId) return go(at);
    setFlowId(id);
    setStart(at);
    setIndex(at);
  };
  const args = [`start:${start}`, flow.args].filter(Boolean).join(";");
  const src = `iframe.html?id=${flow.story}&viewMode=story&${EMBED_PARAM}=1&args=${args}`;
  const flowList = (entries: readonly JourneyFlow[], numbered: boolean) => (
    <ol className="jp-flows">
      {entries.map((entry, at) => (
        <li key={entry.id}>
          <button
            type="button"
            className="jp-flow"
            aria-current={entry.id === flowId}
            onClick={() => openFlow(entry.id)}
          >
            <span>{numbered ? at + 1 : "·"}</span>
            <span>{entry.title}</span>
          </button>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="jp" data-component="JourneyPlayer">
      <PlayerStyles />
      <aside className="jp-rail" aria-label="Walkthrough">
        <header className="jp-head">
          <h1>Voucher flows · {surface}</h1>
          <p>{note ?? "Real screens with demo data. Nothing signs or sends."}</p>
        </header>
        <nav aria-label="All flows">
          <p className="jp-label">All flows</p>
          {flowList(main, true)}
          {side.length ? (
            <details className="jp-side" open={flow.side}>
              <summary>Waits and recovery ({side.length})</summary>
              {flowList(side, false)}
            </details>
          ) : null}
        </nav>
        <section className="jp-now" aria-live="polite">
          <p className="jp-who">You are {flow.who}</p>
          <p className="jp-step">
            {sideState ? "Side state" : `Step ${index + 1} of ${flow.steps.length}`}
          </p>
          <p className="jp-caption">{step.caption}</p>
          <p className="jp-move">
            {step.next
              ? "Someone else moves next. Press their step below."
              : sideState
                ? "A state off the main path. Back returns to the walk."
                : last
                  ? "End of this flow."
                  : "Your move: act on the screen, or skip ahead."}
          </p>
          <div className="jp-row">
            <button
              type="button"
              className="jp-btn"
              disabled={index === 0}
              onClick={() => go(sideState ? flow.steps.length - 1 : index - 1)}
            >
              Back
            </button>
            {step.next ? (
              <button type="button" className="jp-btn" data-primary onClick={() => go(index + 1)}>
                {step.next}
              </button>
            ) : last || sideState ? (
              nextFlow ? (
                <button
                  type="button"
                  className="jp-btn"
                  data-primary
                  onClick={() => openFlow(nextFlow.id)}
                >
                  Next: {nextFlow.title}
                </button>
              ) : null
            ) : (
              <button
                type="button"
                className="jp-btn"
                disabled={index >= count - 1}
                onClick={() => go(index + 1)}
              >
                Skip
              </button>
            )}
          </div>
        </section>
        {flow.sideStates?.length ? (
          <details className="jp-side">
            <summary>Other states in this flow ({flow.sideStates.length})</summary>
            <ul className="jp-flows jp-states">
              {flow.sideStates.map((state) => (
                <li key={state.label}>
                  <button
                    type="button"
                    className="jp-flow"
                    aria-current={state.step === index}
                    onClick={() => go(state.step)}
                  >
                    <span>·</span>
                    <span>{state.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        <div className="jp-foot">
          <div>
            <p className="jp-label">Screen width</p>
            <div className="jp-row">
              {widths.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  className="jp-btn"
                  aria-pressed={option.label === width.label}
                  onClick={() => setWidth(option)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="jp-row">
            {counterpart ? (
              <button type="button" className="jp-btn" onClick={() => openStory(counterpart.story)}>
                {counterpart.label}
              </button>
            ) : null}
            <button type="button" className="jp-btn" onClick={() => openStory(flow.story)}>
              Open This Screen Alone
            </button>
          </div>
        </div>
      </aside>
      <div className="jp-stage" ref={stage}>
        <iframe
          ref={frame}
          key={`${flow.story}:${start}`}
          className="jp-screen"
          data-device={width.height ? "" : undefined}
          title={`${flow.title}, ${surface}`}
          src={src}
          style={{
            width: width.width,
            height,
            transform: `translate(-50%, -50%) scale(${scale})`,
          }}
        />
      </div>
    </div>
  );
}
