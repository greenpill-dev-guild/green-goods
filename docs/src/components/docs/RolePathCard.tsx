import Link from "@docusaurus/Link";
import type {ReactNode} from "react";
import {StatusBadge, type FeatureStatus} from "./StatusBadge";
import styles from "./styles.module.css";

export type RoleAccent = "gardener" | "operator" | "assessment" | "funder" | "builder";

type RolePathCardProps = {
  title: string;
  href: string;
  description: string;
  audience: string;
  time: string;
  image?: string;
  imageAlt?: string;
  roleAccent?: RoleAccent;
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
  image,
  imageAlt,
  roleAccent,
  status = "Live",
  ctaLabel = "Open path",
  icon,
}: RolePathCardProps) {
  return (
    <article className={styles.roleCard} data-role-accent={roleAccent}>
      {image ? (
        <div className={styles.roleCardMedia}>
          <img className={styles.roleCardImage} src={image} alt={imageAlt ?? ""} loading="lazy" />
        </div>
      ) : null}
      <header className={styles.roleCardHeader}>
        <div className={styles.roleCardTitleWrap}>
          <h3 className={styles.roleCardTitle}>
            {icon ? (
              <span className={styles.roleCardIcon} aria-hidden="true">
                {icon}
              </span>
            ) : null}
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
