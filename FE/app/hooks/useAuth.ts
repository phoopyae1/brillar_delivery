'use client';
import { useEffect, useState } from 'react';
import { authApi } from '../lib/api';

type User = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  role: 'SENDER' | 'DISPATCHER' | 'COURIER' | 'ADMIN';
};

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setReady(true);
  }, []);

  const setAuth = (payload: { user: User; token: string }) => {
    localStorage.setItem('token', payload.token);
    localStorage.setItem('user', JSON.stringify(payload.user));
    setUser(payload.user);
    setToken(payload.token);
  };

  const logout = async () => {
    // Call logout API if token exists
    if (token) {
      try {
        await authApi.logout(token);
      } catch (error) {
        // Log but don't block logout - clear local storage anyway
        console.error('Logout API call failed:', error);
      }
    }
    
    // Clear local storage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('sender_session');
    setUser(null);
    setToken(null);
  };

  return { user, token, ready, setAuth, logout };
}
