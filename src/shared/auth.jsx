import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, loadStoredToken, setAccessToken } from './api.js';
import { beginInsightSession, clearInsightSession } from './pickHealthcareInsight.js';
import { exitAppFullscreen } from './fullscreen.js';
import { isBootSequenceEnabled, loginExperience } from './loginExperienceConfig.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bootSessionActive, setBootSessionActive] = useState(false);

  const refreshMe = useCallback(async () => {
    loadStoredToken();
    try {
      // api() silently refreshes via httpOnly cookie on 401, then retries.
      const { data } = await api('/auth/me');
      setUser(data);
    } catch {
      setAccessToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const login = async (email, password) => {
    const { data } = await api('/auth/login', { method: 'POST', body: { email, password } });
    setAccessToken(data.accessToken);
    const { data: me } = await api('/auth/me');
    setUser(me);
    if (loginExperience.healthcareInsights) {
      beginInsightSession();
    }
    if (isBootSequenceEnabled()) {
      setBootSessionActive(true);
    }
    return me;
  };

  const completeLoginBoot = useCallback(() => {
    setBootSessionActive(false);
  }, []);

  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST', body: {} });
    } catch {
      /* ignore */
    }
    setAccessToken(null);
    setUser(null);
    setBootSessionActive(false);
    clearInsightSession();
    exitAppFullscreen();
  };

  const can = (permission) => {
    if (!user?.permissions) return false;
    return user.permissions.includes('*') || user.permissions.includes(permission);
  };

  const isAdmin = () => can('*');
  const canDelete = () => isAdmin();

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      can,
      isAdmin,
      canDelete,
      refreshMe,
      bootSessionActive,
      completeLoginBoot,
    }),
    [user, loading, refreshMe, bootSessionActive, completeLoginBoot]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
