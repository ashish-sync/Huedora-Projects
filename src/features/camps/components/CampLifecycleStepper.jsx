import { CAMP_LIFECYCLE_STAGES, campStatusLabel, canVisitLifecycleStage, lifecycleStageIndex } from '../constants/campLifecycle.js';

export function CampLifecycleStepper({ activeStage, campStatus, reachedLifecycleStage = 'request', onSelect }) {
  const stageIndex = lifecycleStageIndex(activeStage);

  return (
    <div className="camp-lifecycle-stepper-shell">
      <ol className="camp-lifecycle-stepper" aria-label="Camp lifecycle">
        {CAMP_LIFECYCLE_STAGES.map((step, index) => {
          const canVisit = canVisitLifecycleStage(reachedLifecycleStage, step.id);
          const isActive = step.id === activeStage;
          const state = index < stageIndex
            ? 'complete'
            : isActive
              ? 'active'
              : canVisit
                ? 'reachable'
                : 'upcoming';

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
                title={canVisit ? step.label : 'Complete earlier stages first'}
                aria-current={isActive ? 'step' : undefined}
              >
                <span className="camp-lifecycle-step-marker" aria-hidden="true">
                  {state === 'complete' || state === 'reachable' ? '✓' : index + 1}
                </span>
                <span className="camp-lifecycle-step-title">{step.short}</span>
              </button>
              {index < CAMP_LIFECYCLE_STAGES.length - 1 && (
                <span className="camp-lifecycle-step-connector" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
      {campStatus ? (
        <span className="camp-lifecycle-status-chip">{campStatusLabel(campStatus)}</span>
      ) : null}
    </div>
  );
}
