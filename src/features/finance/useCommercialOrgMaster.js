import { useCallback, useEffect, useState } from 'react';
import {
  createCommercialOrgMaster,
  fetchCommercialOrgList,
  fetchCommercialOrgMaster,
  loadOrgListCache,
  loadOrgMasterCache,
  saveCommercialOrgMaster,
} from './commercialOrgMaster.js';

export function useCommercialOrgMaster({ autoLoad = true, orgId = null } = {}) {
  const [orgList, setOrgList] = useState(() => loadOrgListCache());
  const [selectedOrgId, setSelectedOrgId] = useState(() => orgId || 'default');
  const [data, setData] = useState(() => loadOrgMasterCache(orgId || 'default'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reloadList = useCallback(async () => {
    try {
      const list = await fetchCommercialOrgList();
      setOrgList(list);
      return list;
    } catch (e) {
      setError(e.message);
      return loadOrgListCache();
    }
  }, []);

  const reload = useCallback(
    async (id = selectedOrgId) => {
      setLoading(true);
      setError('');
      try {
        const list = await fetchCommercialOrgList();
        setOrgList(list);
        const preferred =
          id ||
          list.find((o) => o.isDefault)?._id ||
          list[0]?._id ||
          'default';
        setSelectedOrgId(String(preferred));
        const profile = await fetchCommercialOrgMaster(preferred);
        setData(profile);
        return profile;
      } catch (e) {
        setError(e.message);
        const cached = loadOrgMasterCache(id || selectedOrgId);
        if (cached) setData(cached);
        return cached;
      } finally {
        setLoading(false);
      }
    },
    [selectedOrgId]
  );

  const selectOrg = useCallback(async (id) => {
    const nextId = String(id || 'default');
    setSelectedOrgId(nextId);
    setLoading(true);
    setError('');
    try {
      const profile = await fetchCommercialOrgMaster(nextId);
      setData(profile);
      return profile;
    } catch (e) {
      setError(e.message);
      const cached = loadOrgMasterCache(nextId);
      if (cached) setData(cached);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const save = useCallback(
    async (payload, id = selectedOrgId) => {
      setLoading(true);
      setError('');
      try {
        const profile = await saveCommercialOrgMaster(payload, id);
        setData(profile);
        await reloadList();
        return profile;
      } catch (e) {
        setError(e.message);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [reloadList, selectedOrgId]
  );

  const create = useCallback(
    async (payload) => {
      setLoading(true);
      setError('');
      try {
        const profile = await createCommercialOrgMaster(payload);
        setData(profile);
        setSelectedOrgId(String(profile._id));
        await reloadList();
        return profile;
      } catch (e) {
        setError(e.message);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [reloadList]
  );

  useEffect(() => {
    if (autoLoad) reload(orgId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad]);

  useEffect(() => {
    if (orgId && String(orgId) !== String(selectedOrgId)) {
      selectOrg(orgId).catch(() => {});
    }
  }, [orgId, selectedOrgId, selectOrg]);

  return {
    data,
    orgList,
    selectedOrgId,
    loading,
    error,
    reload,
    reloadList,
    selectOrg,
    save,
    create,
    setData,
    setSelectedOrgId,
  };
}
