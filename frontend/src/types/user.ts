import { z } from 'zod';

// User profile data
export interface UserProfile {
  id: string;
  username: string;
  profilePic: string;
  createdAt: string;
}

// Post data
export interface Post {
  _id: string;
  title: string;
  content: string;
  userId: string;
  createdAt?: string;
  updatedAt?: string;
}

// Zod schema for username validation
export const usernameSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be at most 30 characters")
    .regex(/^[a-zA-Z0-9_\s]+$/, "Username can only contain letters, numbers, underscores, and spaces"),
});

export type UsernameFormData = z.infer<typeof usernameSchema>;
