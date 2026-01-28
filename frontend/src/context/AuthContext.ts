import { createContext } from 'react';
import type { AuthContextType } from '../types/auth'; //

// We only export the Context here. No components!
export const AuthContext = createContext<AuthContextType | undefined>(undefined);