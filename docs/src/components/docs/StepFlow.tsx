import styles from "./styles.module.css";

type Step = {
  title: string;
  detail: string;
};

type StepFlowProps = {
  steps: Step[];
};

export function StepFlow({steps}: StepFlowProps) {
  return (
    <ol className={styles.stepFlow}>
      {steps.map((step, index) => (
        <li key={`${step.title}-${index}`} className={styles.stepFlowItem}>
          <span className={styles.stepNumber}>{index + 1}</span>
          <div>
            <p className={styles.stepTitle}>{step.title}</p>
            <p className={styles.stepDetail}>{step.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
