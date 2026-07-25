import { CAMP_LIFECYCLE_STAGES, hasReachedLifecycleStage, lifecycleStageIndex } from '../constants/campLifecycle.js';

export function CampLifecycleStepper({ activeStage, campStatus, reachedLifecycleStage = 'request', onSelect }) {
  const stageIndex = CAMP_LIFECYCLE_STAGES.findIndex((s) => s.id === activeStage);
  const reachedIndex = lifecycleStageIndex(reachedLifecycleStage || 'request');

  return (
    <ol className="camp-lifecycle-stepper" aria-label="Camp lifecycle">
      {CAMP_LIFECYCLE_STAGES.map((step, index) => {
        const canVisit = hasReachedLifecycleStage(reachedLifecycleStage, step.id);
        const state = index < stageIndex ? 'complete' : index === stageIndex ? 'active' : canVisit ? 'complete' : 'upcoming';
        return (
          <li
            key={step.id}
            className={`camp-lifecycle-step camp-lifecycle-step--${state}`}
          >
            <button
              type="button"
              className="camp-lifecycle-step-btn"
              onClick={() => canVisit && onSelect?.(step.id)}
              disabled={!canVisit}
              title={canVisit ? `Open ${step.label}` : 'Complete earlier stages first'}
              aria-current={state === 'active' ? 'step' : undefined}
            >              <span className="camp-lifecycle-step-marker">{index + 1}</span>
              <span className="camp-lifecycle-step-copy">
                <strong>{step.label}</strong>
                <span className="camp-lifecycle-step-short">{step.short}</span>
              </span>
            </button>
            {index < CAMP_LIFECYCLE_STAGES.length - 1 && (
              <span className="camp-lifecycle-step-connector" aria-hidden="true" />
            )}
          </li>
        );
      })}
      {campStatus && (
        <span className="camp-lifecycle-status-chip">{String(campStatus).replaceAll('_', ' ')}</span>
      )}
    </ol>
  );
}
