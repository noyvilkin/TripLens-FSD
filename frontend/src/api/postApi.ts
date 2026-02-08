import api from './axios';
import type { Post } from '../types/user';

export interface CreatePostPayload {
  title: string;
  content: string;
  image?: string;
  userId?: string;
  description?: string;
}

export const createPost = async (
  accessToken: string,
  data: CreatePostPayload
): Promise<Post> => {
  const response = await api.post('/post', {
    ...data,
    description: data.description || data.content
  }, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  return response.data;
};
