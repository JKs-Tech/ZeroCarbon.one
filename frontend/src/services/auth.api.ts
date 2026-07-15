import { apiClient } from './api.client';
import type { ApiSuccess, AuthResult, PublicUser } from '../types/api';

export const authApi = {
  async login(email: string, password: string): Promise<AuthResult> {
    const { data } = await apiClient.post<ApiSuccess<AuthResult>>('/auth/login', {
      email,
      password,
    });
    return data.data;
  },

  async register(name: string, email: string, password: string): Promise<AuthResult> {
    const { data } = await apiClient.post<ApiSuccess<AuthResult>>('/auth/register', {
      name,
      email,
      password,
    });
    return data.data;
  },

  async profile(): Promise<PublicUser> {
    const { data } = await apiClient.get<ApiSuccess<{ user: PublicUser }>>('/auth/profile');
    return data.data.user;
  },
};
