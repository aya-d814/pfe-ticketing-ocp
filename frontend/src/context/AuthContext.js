import React, { createContext, useContext, useState, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import * as api from '../services/api';

const AuthContext = createContext(null);

const decodeUser = (token) => {
  try {
    const payload = jwtDecode(token);
    return {
      id: payload.user_id,
      username: payload.username,
      email: payload.email,
      role: payload.role,
    };
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('access_token');
    return token ? decodeUser(token) : null;
  });

  const login = useCallback(async (credentials) => {
    const { data } = await api.login(credentials);
    localStorage.setItem('access_token', data.access);
    localStorage.setItem('refresh_token', data.refresh);
    const decoded = decodeUser(data.access);
    setUser(decoded);
    return decoded;
  }, []);



  const logout = useCallback(async () => {
    try {
      const refresh = localStorage.getItem('refresh_token');
      if (refresh) await api.logout(refresh);
    } finally {
      localStorage.clear();
      setUser(null);
    }
  }, []);

  const isRole = useCallback(
    (...roles) => roles.includes(user?.role),
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, login, logout, isRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
