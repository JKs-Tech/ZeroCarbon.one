import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { TOKEN_STORAGE_KEY } from '../constants';
import type { ApiErrorBody } from '../types/api';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export const apiClient = axios.create({
  baseURL,
  timeout: 120_000,
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function getApiErrorMessage(error: unknown): string {
  const axiosError = error as AxiosError<ApiErrorBody>;
  if (axiosError.response?.data?.message) {
    return axiosError.response.data.message;
  }
  if (axiosError.message) {
    return axiosError.message;
  }
  return 'Unexpected error';
}

export function getApiFieldErrors(
  error: unknown,
): Array<{ code: string; message: string; field?: string }> {
  const axiosError = error as AxiosError<ApiErrorBody>;
  return axiosError.response?.data?.errors ?? [];
}
