import { apiClient } from './api.client';
import type { ApiSuccess, ReviewPayload } from '../types/api';

export const reviewApi = {
  async getReview(id: string): Promise<ReviewPayload> {
    const { data } = await apiClient.get<ApiSuccess<ReviewPayload>>(`/documents/${id}/review`);
    return data.data;
  },

  async updateFields(
    id: string,
    fields: Record<string, string | number | null>,
  ): Promise<ReviewPayload> {
    const { data } = await apiClient.put<ApiSuccess<ReviewPayload>>(`/documents/${id}/review`, {
      fields,
    });
    return data.data;
  },

  async approve(id: string): Promise<ReviewPayload> {
    const { data } = await apiClient.post<ApiSuccess<ReviewPayload>>(`/documents/${id}/approve`);
    return data.data;
  },
};
