import { useCallback, useEffect, useState } from 'react';
import {
  fetchCommercialOrgMaster,
  loadOrgMasterCache,
  saveCommercialOrgMaster,
} from './commercialOrgMaster.js';

export function useCommercialOrgMaster({ autoLoad = true } = {}) {
  const [data, setData] = useState(() => loadOrgMasterCache());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const profile = await fetchCommercialOrgMaster();
      setData(profile);
      return profile;
    } catch (e) {
      setError(e.message);
      const cached = loadOrgMasterCache();
      if (cached) setData(cached);
      return cached;
    } finally {
      setLoading(false);
    }
  }, []);

  const save = useCallback(async (payload) => {
    setLoading(true);
    setError('');
    try {
      const profile = await saveCommercialOrgMaster(payload);
      setData(profile);
      return profile;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoLoad) reload();
  }, [autoLoad, reload]);

  return { data, loading, error, reload, save, setData };
}
