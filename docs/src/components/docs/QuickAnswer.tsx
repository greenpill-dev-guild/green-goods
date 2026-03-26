import type {ReactNode} from "react";
import styles from "./styles.module.css";

type QuickAnswerProps = {
  question: string;
  children: ReactNode;
  openByDefault?: boolean;
};

export function QuickAnswer({question, children, openByDefault = true}: QuickAnswerProps) {
  return (
    <details className={styles.quickAnswer} open={openByDefault}>
      <summary>{question}</summary>
      <div className={styles.quickAnswerBody}>{children}</div>
    </details>
  );
}
