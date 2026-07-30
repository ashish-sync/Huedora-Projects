import { CAMP_LIFECYCLE_STAGES } from '../constants/campLifecycle.js';
import { useCampWorkingStage } from '../CampWorkingStageContext.jsx';

export function CampWorkingStageSelect({ compact = false }) {
  const { workingStage, setWorkingStage } = useCampWorkingStage();

  return (
    <label
      className={[
        'camp-working-stage-field',
        compact ? 'camp-working-stage-field--compact' : '',
      ].filter(Boolean).join(' ')}
    >
      {compact ? null : <span className="camp-working-stage-label">Working view</span>}
      <select
        className="camp-working-stage-select"
        value={workingStage}
        onChange={(event) => setWorkingStage(event.target.value)}
        aria-label="Select camp lifecycle view"
      >
        {CAMP_LIFECYCLE_STAGES.map((stage) => (
          <option key={stage.id} value={stage.id}>
            {compact ? stage.short : stage.label}
          </option>
        ))}
      </select>
    </label>
  );
}
