const STEPS = [
  { id: 1, label: 'Paste', short: 'Add details' },
  { id: 2, label: 'Review', short: 'Verify fields' },
  { id: 3, label: 'Create camps', short: 'Import' },
];

function getStepState(stepId, currentStep) {
  if (stepId < currentStep) return 'complete';
  if (stepId === currentStep) return 'active';
  return 'upcoming';
}

export function PasteWorkflowStepper({ currentStep }) {
  return (
    <ol className="paste-workflow-stepper" aria-label="Manual paste workflow">
      {STEPS.map((step, index) => {
        const state = getStepState(step.id, currentStep);
        return (
          <li
            key={step.id}
            className={`paste-workflow-step paste-workflow-step--${state}`}
            aria-current={state === 'active' ? 'step' : undefined}
          >
            <span className="paste-workflow-step-marker" aria-hidden="true">
              {state === 'complete' ? '✓' : step.id}
            </span>
            <span className="paste-workflow-step-copy">
              <strong>{step.label}</strong>
              <span className="paste-workflow-step-short">{step.short}</span>
            </span>
            {index < STEPS.length - 1 && (
              <span className="paste-workflow-step-connector" aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
