import styles from "./styles.module.css";

type AtAGlanceCardProps = {
  goal: string;
  difficulty: "quickstart" | "standard" | "advanced";
  estimatedTime: string;
  prereqs: string;
  outcome: string;
  personaContext: string;
  lastVerified: string;
};

const difficultyLabel: Record<AtAGlanceCardProps["difficulty"], string> = {
  quickstart: "Quickstart",
  standard: "Standard",
  advanced: "Advanced",
};

export function AtAGlanceCard({
  goal,
  difficulty,
  estimatedTime,
  prereqs,
  outcome,
  personaContext,
  lastVerified,
}: AtAGlanceCardProps) {
  return (
    <section className={styles.atAGlance}>
      <header className={styles.atAGlanceHeader}>
        <h2 className={styles.atAGlanceTitle}>At a glance</h2>
        <span className={styles.difficultyBadge}>{difficultyLabel[difficulty]}</span>
      </header>
      <dl className={styles.atAGlanceGrid}>
        <div>
          <dt>Goal</dt>
          <dd>{goal}</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>{estimatedTime}</dd>
        </div>
        <div>
          <dt>Prereqs</dt>
          <dd>{prereqs}</dd>
        </div>
        <div>
          <dt>Outcome</dt>
          <dd>{outcome}</dd>
        </div>
        <div>
          <dt>Persona</dt>
          <dd>{personaContext}</dd>
        </div>
        <div>
          <dt>Last verified</dt>
          <dd>{lastVerified}</dd>
        </div>
      </dl>
    </section>
  );
}
