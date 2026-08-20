'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from './api';
import { UserMe } from '@/types';

interface AuthContextType {
  user: UserMe | null;
  loading: boolean;
  login: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => void;
  hasPermission: (menuPath: string, action?: 'view' | 'create' | 'edit' | 'delete') => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
  hasPermission: () => false,
  refreshUser: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserMe | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchUser = async () => {
    const token = localStorage.getItem('irm_access_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const res = await api.get<UserMe>('/api/auth/me');
      setUser(res.data);
    } catch (err) {
      console.error('Failed to fetch user me:', err);
      setUser(null);
      localStorage.removeItem('irm_access_token');
      localStorage.removeItem('irm_refresh_token');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const login = async (accessToken: string, refreshToken: string) => {
    localStorage.setItem('irm_access_token', accessToken);
    localStorage.setItem('irm_refresh_token', refreshToken);
    await fetchUser();
    router.push('/operation');
  };

  const logout = () => {
    localStorage.removeItem('irm_access_token');
    localStorage.removeItem('irm_refresh_token');
    setUser(null);
    router.push('/login');
  };

  const hasPermission = (menuPath: string, action: 'view' | 'create' | 'edit' | 'delete' = 'view'): boolean => {
    if (!user) return false;
    if (user.group_name?.toLowerCase() === 'admin') return true;

    const perm = user.permissions.find((p) => p.menu_path === menuPath);
    if (!perm) return false;

    if (action === 'view') return perm.can_view;
    if (action === 'create') return perm.can_create;
    if (action === 'edit') return perm.can_edit;
    if (action === 'delete') return perm.can_delete;
    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        hasPermission,
        refreshUser: fetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
