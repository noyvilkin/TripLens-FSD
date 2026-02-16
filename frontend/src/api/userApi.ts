import api from './axios';
import type { UserProfile, Post } from '../types/user';

// Get user public profile
export const getUserProfile = async (userId: string): Promise<UserProfile> => {
  const response = await api.get(`/user/profile/${userId}`);
  return response.data;
};

// Get user's posts
export const getUserPosts = async (userId: string): Promise<Post[]> => {
  const response = await api.get(`/post?userId=${userId}`);
  return response.data;
};

// Update user profile (with optional image)
export const updateUserProfile = async (
  userId: string,
  accessToken: string,
  data: { username?: string; profileImage?: File | string }
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

  const response = await api.put(`/user/${userId}`, formData, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'multipart/form-data',
    },
  });
  
  return response.data;
};
