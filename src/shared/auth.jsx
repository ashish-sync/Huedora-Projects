import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, loadStoredToken, setAccessToken } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    const token = loadStoredToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api('/auth/me');
      setUser(data);
    } catch {
      try {
        const { data } = await api('/auth/refresh', { method: 'POST', body: {} });
        setAccessToken(data.accessToken);
        setUser(data.user);
      } catch {
        setAccessToken(null);
        setUser(null);
      }
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
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST', body: {} });
    } catch {
      /* ignore */
    }
    setAccessToken(null);
    setUser(null);
  };

  const can = (permission) => {
    if (!user?.permissions) return false;
    return user.permissions.includes('*') || user.permissions.includes(permission);
  };

  const value = useMemo(
    () => ({ user, loading, login, logout, can, refreshMe }),
    [user, loading, can, refreshMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
