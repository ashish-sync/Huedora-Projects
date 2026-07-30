import { Link } from 'react-router-dom';
import { useCampOpsAuth } from '../useCampOpsAuth.js';
import { useCampWorkingStage } from '../CampWorkingStageContext.jsx';

export function CampManageHeaderActions() {
  const { hasPermission } = useCampOpsAuth();
  const { workingStage } = useCampWorkingStage();
  const canCreateCamp = hasPermission('camps:create') || hasPermission('camps:update');

  if (!canCreateCamp || workingStage !== 'request') {
    return null;
  }

  return (
    <div className="inv-header-actions camp-header-toolbar">
      <div className="camp-export-actions">
        <Link className="btn btn-compact" to="/camps/manage/new">
          + New Camp
        </Link>
      </div>
    </div>
  );
}
