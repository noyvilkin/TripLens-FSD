import axios, { AxiosError } from 'axios';
import type { AxiosResponse } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 8000,
  headers: {
    Accept: 'application/json',
  },
});

const rawApi = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 8000,
  headers: {
    Accept: 'application/json',
  },
});

let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

export const unwrap = <T>(response: AxiosResponse<T>): T => response.data;

let isRefreshing = false;
let refreshQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: AxiosError) => void;
}> = [];

const processQueue = (error: AxiosError | null, token: string | null) => {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error || !token) {
      reject(error || new AxiosError('Refresh failed'));
    } else {
      resolve(token);
    }
  });
  refreshQueue = [];
};

const isAuthEndpoint = (url?: string) => {
  if (!url) return false;
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/google') ||
    url.includes('/auth/logout')
  );
};

const isAuthInvalidStatus = (status?: number) => status === 401 || status === 403;

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken && !config.headers?.Authorization) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (axios.isAxiosError(error) && error.response?.data && typeof error.response.data === 'object') {
      const data = error.response.data as { message?: string; error?: string };
      if (!data.message && data.error) {
        data.message = data.error;
      }
    }

    if (!originalRequest || isAuthEndpoint(originalRequest.url)) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      isRefreshing = true;

      try {
        const refreshResponse = await rawApi.post('/auth/refresh');
        const newToken = (refreshResponse.data as { accessToken: string }).accessToken;
        setAccessToken(newToken);
        processQueue(null, newToken);

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        const axiosRefreshError = refreshError as AxiosError;

        // Keep token during transient failures; clear only on explicit auth invalidation.
        if (isAuthInvalidStatus(axiosRefreshError.response?.status)) {
          setAccessToken(null);
        }

        processQueue(axiosRefreshError, null);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;