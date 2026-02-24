import type {ReactNode} from "react";
import {StatusBadge, type FeatureStatus} from "./StatusBadge";
import styles from "./styles.module.css";

type FeatureStateProps = {
  title: string;
  status: FeatureStatus;
  summary: string;
  children?: ReactNode;
};

export function FeatureState({title, status, summary, children}: FeatureStateProps) {
  return (
    <section className={styles.featureState}>
      <header className={styles.featureStateHeader}>
        <h3 className={styles.featureStateTitle}>{title}</h3>
        <StatusBadge status={status} />
      </header>
      <p className={styles.featureStateSummary}>{summary}</p>
      {children ? <div className={styles.featureStateBody}>{children}</div> : null}
    </section>
  );
}
