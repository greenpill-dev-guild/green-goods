import clsx from "clsx";
import type {ReactNode} from "react";
import styles from "./styles.module.css";

export type FeatureStatus =
  | "Live"
  | "Live (external source)"
  | "Implemented (activation pending indexing)"
  | "Implemented (activation pending deployment)"
  | "Planned";

type StatusBadgeProps = {
  status: FeatureStatus;
  children?: ReactNode;
};

const statusClassByLabel: Record<FeatureStatus, string> = {
  Live: styles.statusLive,
  "Live (external source)": styles.statusExternal,
  "Implemented (activation pending indexing)": styles.statusImplementedIndexing,
  "Implemented (activation pending deployment)": styles.statusImplemented,
  Planned: styles.statusPlanned,
};

export function StatusBadge({status, children}: StatusBadgeProps) {
  return (
    <span className={clsx(styles.statusBadge, statusClassByLabel[status])}>
      {children ?? status}
    </span>
  );
}
