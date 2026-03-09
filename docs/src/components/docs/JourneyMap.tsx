import Link from "@docusaurus/Link";
import clsx from "clsx";
import styles from "./styles.module.css";

type JourneyState = "complete" | "current" | "upcoming";

type JourneyStep = {
  title: string;
  href?: string;
  note?: string;
  state: JourneyState;
};

type JourneyMapProps = {
  role: string;
  steps: JourneyStep[];
};

const journeyIndexStyles: Record<JourneyState, string> = {
  complete: styles.journeyIndexComplete,
  current: styles.journeyIndexCurrent,
  upcoming: styles.journeyIndexUpcoming,
};

export function JourneyMap({role, steps}: JourneyMapProps) {
  return (
    <section className={styles.journeyMap}>
      <h2 className={styles.journeyTitle}>{role} journey map</h2>
      <ol className={styles.journeyList}>
        {steps.map((step, index) => (
          <li
            key={`${step.title}-${index}`}
            className={clsx(styles.journeyItem, styles[`journey${step.state[0].toUpperCase()}${step.state.slice(1)}`])}
            style={{animationDelay: `${index * 60}ms`}}
          >
            <span className={clsx(styles.journeyIndex, journeyIndexStyles[step.state])}>
              {step.state === "complete" ? "\u2713" : index + 1}
            </span>
            <div>
              {step.href ? (
                <Link to={step.href} className={styles.journeyLink}>
                  {step.title}
                </Link>
              ) : (
                <p className={styles.journeyText}>{step.title}</p>
              )}
              {step.note ? <p className={styles.journeyNote}>{step.note}</p> : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
