import { apiClient } from './api.client';
import type { RoleValue } from '../constants';
import type { ApiSuccess, PublicUser } from '../types/api';

export interface UserListResult {
  users: PublicUser[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const adminApi = {
  async listUsers(page = 1, limit = 10): Promise<UserListResult> {
    const { data } = await apiClient.get<ApiSuccess<{ users: PublicUser[] }>>('/users', {
      params: { page, limit },
    });
    return {
      users: data.data.users,
      page: data.meta.page ?? page,
      limit: data.meta.limit ?? limit,
      total: data.meta.total ?? data.data.users.length,
      totalPages: data.meta.totalPages ?? 1,
    };
  },

  async updateUserRole(userId: string, role: RoleValue): Promise<PublicUser> {
    const { data } = await apiClient.patch<ApiSuccess<{ user: PublicUser }>>(`/users/${userId}`, {
      role,
    });
    return data.data.user;
  },
};
