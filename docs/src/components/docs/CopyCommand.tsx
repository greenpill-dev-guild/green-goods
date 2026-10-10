import {RiCheckLine, RiFileCopyLine} from "@remixicon/react";
import {useEffect, useRef, useState} from "react";

import styles from "./styles.module.css";

type CopyCommandProps = {
  /** The exact text the button copies; rendered as code. */
  command: string;
};

type CopyState = "idle" | "copied" | "failed";

/**
 * An inline command with its own copy button, for commands that live in table cells where a
 * fenced block cannot. The Markdown twins render the same command as a plain code span
 * (docs/scripts/llms.mjs), so agents reading the twin see the command, not the tag.
 */
export function CopyCommand({command}: CopyCommandProps) {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setState("copied");
    } catch {
      // No secure context or permission: the reader sees the failure and can select the text.
      setState("failed");
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 1500);
  };

  const feedback = state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "";
  return (
    <span className={styles.copyCommand}>
      <code>{command}</code>
      <button
        type="button"
        className={`clean-btn ${styles.copyCommandButton}`}
        onClick={copy}
        aria-label={`Copy ${command}`}
        title="Copy command"
      >
        {state === "copied" ? (
          <RiCheckLine size={14} aria-hidden="true" />
        ) : (
          <RiFileCopyLine size={14} aria-hidden="true" />
        )}
        <span role="status" className={styles.copyCommandStatus}>
          {feedback}
        </span>
      </button>
      {feedback ? (
        <span className={styles.copyCommandFeedback} aria-hidden="true">
          {feedback}
        </span>
      ) : null}
    </span>
  );
}
