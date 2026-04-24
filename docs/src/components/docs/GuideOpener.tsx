import type {ReactNode} from "react";
import type {RoleAccent} from "./RolePathCard";
import styles from "./styles.module.css";

type GuideOpenerProps = {
  image: string;
  alt: string;
  label: string;
  roleAccent?: RoleAccent;
  children?: ReactNode;
};

export function GuideOpener({image, alt, label, roleAccent, children}: GuideOpenerProps) {
  return (
    <figure className={styles.guideOpener} data-role-accent={roleAccent}>
      <img className={styles.guideOpenerImage} src={image} alt={alt} loading="eager" />
      <figcaption className={styles.guideOpenerCaption}>
        <span className={styles.guideOpenerLabel}>{label}</span>
        {children ? <span className={styles.guideOpenerText}>{children}</span> : null}
      </figcaption>
    </figure>
  );
}
