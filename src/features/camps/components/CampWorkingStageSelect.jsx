import { CAMP_LIFECYCLE_STAGES } from '../constants/campLifecycle.js';
import { useCampWorkingStage } from '../CampWorkingStageContext.jsx';

export function CampWorkingStageSelect({ compact = false }) {
  const { workingStage, setWorkingStage } = useCampWorkingStage();

  return (
    <label
      className={[
        'camp-working-stage-field',
        compact ? 'camp-working-stage-field--compact' : '',
        workingStage ? '' : 'is-pending',
      ].filter(Boolean).join(' ')}
    >
      <span className="camp-working-stage-label">{compact ? 'Stage' : 'Working stage'}</span>
      <select
        className="camp-working-stage-select"
        value={workingStage || ''}
        onChange={(event) => setWorkingStage(event.target.value || null)}
        aria-label="Select which camp lifecycle stage you are working on"
        aria-required="true"
      >
        <option value="" disabled>
          Select stage…
        </option>
        {CAMP_LIFECYCLE_STAGES.map((stage, index) => (
          <option key={stage.id} value={stage.id}>
            {index + 1}. {stage.label}
          </option>
        ))}
      </select>
    </label>
  );
}
