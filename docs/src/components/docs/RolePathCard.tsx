import Link from "@docusaurus/Link";
import type {ReactNode} from "react";
import {StatusBadge, type FeatureStatus} from "./StatusBadge";
import styles from "./styles.module.css";

type RolePathCardProps = {
  title: string;
  href: string;
  description: string;
  audience: string;
  time: string;
  status?: FeatureStatus;
  ctaLabel?: string;
  icon?: ReactNode;
};

export function RolePathCard({
  title,
  href,
  description,
  audience,
  time,
  status = "Live",
  ctaLabel = "Open path",
  icon,
}: RolePathCardProps) {
  return (
    <article className={styles.roleCard}>
      <header className={styles.roleCardHeader}>
        <div className={styles.roleCardTitleWrap}>
          <h3 className={styles.roleCardTitle}>
            {icon ? <span className={styles.roleCardIcon}>{icon}</span> : null}
            {title}
          </h3>
        </div>
        <StatusBadge status={status} />
      </header>
      <p className={styles.roleCardBody}>{description}</p>
      <dl className={styles.metaList}>
        <div>
          <dt>Audience</dt>
          <dd>{audience}</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>{time}</dd>
        </div>
      </dl>
      <Link className={styles.roleCardLink} to={href}>
        {ctaLabel}
      </Link>
    </article>
  );
}
