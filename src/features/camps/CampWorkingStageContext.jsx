import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CAMP_LIFECYCLE_STAGES } from './constants/campLifecycle.js';

const DEFAULT_WORKING_STAGE = 'request';

const CampWorkingStageContext = createContext(null);

function normalizeWorkingStage(next) {
  if (next && CAMP_LIFECYCLE_STAGES.some((stage) => stage.id === next)) {
    return next;
  }
  return DEFAULT_WORKING_STAGE;
}

export function CampWorkingStageProvider({ children }) {
  const [workingStage, setWorkingStageState] = useState(DEFAULT_WORKING_STAGE);

  const setWorkingStage = useCallback((next) => {
    setWorkingStageState(normalizeWorkingStage(next));
  }, []);

  const workingStageMeta = useMemo(
    () => CAMP_LIFECYCLE_STAGES.find((stage) => stage.id === workingStage) || null,
    [workingStage],
  );

  const value = useMemo(
    () => ({ workingStage, setWorkingStage, workingStageMeta }),
    [workingStage, setWorkingStage, workingStageMeta],
  );

  return (
    <CampWorkingStageContext.Provider value={value}>
      {children}
    </CampWorkingStageContext.Provider>
  );
}

export function useCampWorkingStage() {
  const ctx = useContext(CampWorkingStageContext);
  if (!ctx) {
    throw new Error('useCampWorkingStage must be used within CampWorkingStageProvider');
  }
  return ctx;
}
