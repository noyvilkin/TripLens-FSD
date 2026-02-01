import api, { unwrap } from './axios';
import type { UserProfile, Post } from '../types/user';

// Get user public profile
export const getUserProfile = async (userId: string, signal?: AbortSignal): Promise<UserProfile> => {
  const response = await api.get<UserProfile>(`/user/profile/${userId}`, { signal });
  return unwrap(response);
};

// Get user's posts
export const getUserPosts = async (userId: string, signal?: AbortSignal): Promise<Post[]> => {
  const response = await api.get<Post[]>('/post', { params: { userId }, signal });
  return unwrap(response);
};

// Update user profile (with optional image)
export const updateUserProfile = async (
  userId: string,
  data: { username?: string; profileImage?: File | string },
  signal?: AbortSignal
): Promise<UserProfile> => {
  const formData = new FormData();
  
  if (data.username) {
    formData.append('username', data.username);
  }
  
  // Handle photo upload or removal
  if (data.profileImage !== undefined) {
    if (typeof data.profileImage === 'string') {
      // Empty string means remove photo
      formData.append('profileImage', data.profileImage);
    } else {
      // File object means upload new photo
      formData.append('profileImage', data.profileImage);
    }
  }

  const response = await api.put<UserProfile>(`/user/${userId}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    signal,
  });

  return unwrap(response);
};
