import AdaptiveSelect from '../../../components/ui/AdaptiveSelect.jsx';
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
      <AdaptiveSelect
        className="camp-working-stage-select tylo-select"
        threshold={10}
        value={workingStage}
        onChange={(event) => setWorkingStage(event.target.value)}
        aria-label="Select camp lifecycle view"
      >
        {CAMP_LIFECYCLE_STAGES.map((stage) => (
          <option key={stage.id} value={stage.id}>
            {compact ? stage.short : stage.label}
          </option>
        ))}
      </AdaptiveSelect>
    </label>
  );
}
