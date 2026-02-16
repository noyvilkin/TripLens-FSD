import React, { useState, useEffect } from 'react';
import { AxiosError } from 'axios';
import api from '../api/axios';
import { AuthContext } from './AuthContext';
import type { AuthProviderProps, LoginFormData, RegisterFormData, AuthError } from '../types/auth';

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AuthError | null>(null);

  // Auto-login logic for persistent sessions
  useEffect(() => {
    let isMounted = true;
    let hasRefreshed = false; // Prevent double-refresh in StrictMode
    
    const refresh = async () => {
      if (hasRefreshed) return; // Skip if already attempted
      hasRefreshed = true;
      
      try {
        const res = await api.post('/auth/refresh');
        if (isMounted) {
          setAccessToken(res.data.accessToken);
        }
      } catch {
        if (isMounted) {
          setAccessToken(null);
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
    };
  }, []);

  const login = async (data: LoginFormData) => {
    try {
      setError(null);
      const res = await api.post('/auth/login', data);
      setAccessToken(res.data.accessToken);
    } catch (err) {
      const axiosError = err as AxiosError<{ message: string }>;
      setError({
        message: axiosError.response?.data?.message || 'Login failed. Please try again.',
      });
      throw err;
    }
  };

  const register = async (data: RegisterFormData) => {
    try {
      setError(null);
      const res = await api.post('/auth/register', data);
      setAccessToken(res.data.accessToken);
    } catch (err) {
      const axiosError = err as AxiosError<{ message: string }>;
      setError({
        message: axiosError.response?.data?.message || 'Registration failed. Please try again.',
      });
      throw err;
    }
  };

  const googleLogin = async (credential: string) => {
    try {
      setError(null);
      const res = await api.post('/auth/google', { credential });
      setAccessToken(res.data.accessToken);
    } catch (err) {
      const axiosError = err as AxiosError<{ message: string }>;
      setError({
        message: axiosError.response?.data?.message || 'Google login failed. Please try again.',
      });
      throw err;
    }
  };

  const logout = async () => {
    await api.post('/auth/logout');
    setAccessToken(null);
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
