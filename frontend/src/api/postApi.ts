import api from './axios';
import type { Post, PaginatedPostsResponse } from '../types/user';

export const getPosts = async (
  page: number = 1,
  limit: number = 10,
  signal?: AbortSignal
): Promise<PaginatedPostsResponse> => {
  const response = await api.get<PaginatedPostsResponse>('/post', {
    params: { page, limit },
    signal,
  });
  return response.data;
};

export interface CreatePostPayload {
  title: string;
  content: string;
  images: File[];
}

export const createPost = async (
  accessToken: string,
  data: CreatePostPayload
): Promise<Post> => {
  const formData = new FormData();
  formData.append('title', data.title);
  formData.append('content', data.content);
  data.images.forEach((file) => formData.append('images', file));

  const response = await api.post('/post', formData, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'multipart/form-data'
    }
  });

  return response.data;
};

export interface UpdatePostPayload {
  title?: string;
  content?: string;
}

export const updatePost = async (
  postId: string,
  accessToken: string,
  data: UpdatePostPayload
): Promise<Post> => {
  const response = await api.put(`/post/${postId}`, data, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  return response.data;
};

export const deletePost = async (
  postId: string,
  accessToken: string
): Promise<void> => {
  await api.delete(`/post/${postId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
};
