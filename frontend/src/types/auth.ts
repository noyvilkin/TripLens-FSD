import { z } from 'zod';
import type { ReactNode } from 'react'; // Fixes verbatimModuleSyntax error

// 1. Zod Schema for strict field validation (Registration)
export const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// 2. Zod Schema for login (supports both email and username)
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type RegisterFormData = z.infer<typeof registerSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;
export type AuthFormData = RegisterFormData | LoginFormData;

export interface AuthError {
  message: string;
  field?: string;
}

export interface AuthContextType {
  accessToken: string | null;
  login: (data: LoginFormData) => Promise<void>;
  register: (data: RegisterFormData) => Promise<void>;
  googleLogin: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
  error: AuthError | null;
  clearError: () => void;
}

export interface AuthProviderProps {
  children: ReactNode;
}