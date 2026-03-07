import React, { useState, useEffect } from 'react';
import { AxiosError } from 'axios';
import api, { setAccessToken as setApiAccessToken } from '../api/axios';
import { AuthContext } from './AuthContext';
import type { AuthProviderProps, LoginFormData, RegisterFormData, AuthError } from '../types/auth';

const SESSION_FLAG_KEY = 'triplens_has_session';

const isAuthInvalidStatus = (status?: number) => status === 401 || status === 403;

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AuthError | null>(null);

  // Auto-login logic for persistent sessions
  useEffect(() => {
    let isMounted = true;
    let hasRefreshed = false; // Prevent double-refresh in StrictMode
    const controller = new AbortController();

    const hasSession = localStorage.getItem(SESSION_FLAG_KEY) === 'true';
    if (!hasSession) {
      setApiAccessToken(null);
      setLoading(false);
      return;
    }
    
    const refresh = async () => {
      if (hasRefreshed) return; // Skip if already attempted
      hasRefreshed = true;
      
      try {
        const res = await api.post('/auth/refresh', undefined, { 
          timeout: 4000,
          signal: controller.signal 
        });
        if (isMounted) {
          setAccessToken(res.data.accessToken);
          setApiAccessToken(res.data.accessToken);
          localStorage.setItem(SESSION_FLAG_KEY, 'true');
        }
      } catch (err) {
        if (err && typeof err === 'object' && 'code' in err) {
          const code = (err as { code?: string }).code;
          if (code === 'ERR_CANCELED') return;
        }
        if (isMounted) {
          setAccessToken(null);
          setApiAccessToken(null);

          // Only clear the persistent session flag when the server explicitly
          // says the session is unauthorized/invalid.
          const axiosError = err as AxiosError;
          if (isAuthInvalidStatus(axiosError.response?.status)) {
            localStorage.removeItem(SESSION_FLAG_KEY);
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    refresh();
    
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const login = async (data: LoginFormData) => {
    try {
      setError(null);
      const res = await api.post('/auth/login', data);
      setAccessToken(res.data.accessToken);
      setApiAccessToken(res.data.accessToken);
      localStorage.setItem(SESSION_FLAG_KEY, 'true');
    } catch (err) {
      const axiosError = err as AxiosError<{ message?: string; error?: string }>;
      setError({
        message: axiosError.response?.data?.message || axiosError.response?.data?.error || 'Login failed. Please try again.',
      });
      throw err;
    }
  };

  const register = async (data: RegisterFormData) => {
    try {
      setError(null);
      const res = await api.post('/auth/register', data);
      setAccessToken(res.data.accessToken);
      setApiAccessToken(res.data.accessToken);
      localStorage.setItem(SESSION_FLAG_KEY, 'true');
    } catch (err) {
      const axiosError = err as AxiosError<{ message?: string; error?: string }>;
      setError({
        message: axiosError.response?.data?.message || axiosError.response?.data?.error || 'Registration failed. Please try again.',
      });
      throw err;
    }
  };

  const googleLogin = async (credential: string) => {
    try {
      setError(null);
      const res = await api.post('/auth/google', { credential });
      setAccessToken(res.data.accessToken);
      setApiAccessToken(res.data.accessToken);
      localStorage.setItem(SESSION_FLAG_KEY, 'true');
    } catch (err) {
      const axiosError = err as AxiosError<{ message?: string; error?: string }>;
      setError({
        message: axiosError.response?.data?.message || axiosError.response?.data?.error || 'Google login failed. Please try again.',
      });
      throw err;
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore logout errors
    }
    setAccessToken(null);
    setApiAccessToken(null);
    localStorage.removeItem(SESSION_FLAG_KEY);
    setError(null);
  };

  const clearError = () => {
    setError(null);
  };

  return (
    <AuthContext.Provider value={{ accessToken, login, register, googleLogin, logout, loading, error, clearError }}>
      {children}
    </AuthContext.Provider>
  );
};
