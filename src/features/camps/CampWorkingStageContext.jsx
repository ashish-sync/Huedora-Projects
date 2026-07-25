import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CAMP_LIFECYCLE_STAGES } from './constants/campLifecycle.js';

const STORAGE_KEY = 'camp-one-working-stage';

const CampWorkingStageContext = createContext(null);

function readStoredStage() {
  try {
    const value = sessionStorage.getItem(STORAGE_KEY);
    if (value && CAMP_LIFECYCLE_STAGES.some((stage) => stage.id === value)) {
      return value;
    }
  } catch {
    /* ignore */
  }
  return 'request';
}

export function CampWorkingStageProvider({ children }) {
  const [workingStage, setWorkingStageState] = useState(readStoredStage);

  const setWorkingStage = useCallback((next) => {
    const stage = next && CAMP_LIFECYCLE_STAGES.some((item) => item.id === next) ? next : null;
    setWorkingStageState(stage);
    try {
      if (stage) sessionStorage.setItem(STORAGE_KEY, stage);
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
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
