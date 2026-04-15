import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { authApi } from '../api/auth';
import { tokenStorage } from '../api/client';
import type {
  LoginRequest,
  RegisterRequest,
  TokenResponse,
  User,
} from '../types/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;

  setSession: (data: TokenResponse) => void;
  clearSession: () => void;

  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isInitialized: false,
      isLoading: false,
      error: null,

      setSession: (data) => {
        tokenStorage.set(data.access_token, data.refresh_token);
        set({
          user: data.user,
          isAuthenticated: true,
          isInitialized: true,
          error: null,
        });
      },

      clearSession: () => {
        tokenStorage.clear();
        set({ user: null, isAuthenticated: false, error: null });
      },

      login: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const result = await authApi.login(data);
          get().setSession(result);
        } catch (err) {
          set({ error: extractError(err) });
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      register: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const result = await authApi.register(data);
          get().setSession(result);
        } catch (err) {
          set({ error: extractError(err) });
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        const refreshToken = tokenStorage.getRefresh();
        if (refreshToken) {
          try {
            await authApi.logout(refreshToken);
          } catch {
            // ignore — clear locally regardless
          }
        }
        get().clearSession();
      },

      hydrate: async () => {
        if (!tokenStorage.getAccess()) {
          set({ isInitialized: true, isAuthenticated: false, user: null });
          return;
        }
        try {
          const user = await authApi.me();
          set({ user, isAuthenticated: true, isInitialized: true });
        } catch {
          tokenStorage.clear();
          set({ user: null, isAuthenticated: false, isInitialized: true });
        }
      },
    }),
    {
      name: 'noted-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);

function extractError(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const resp = (err as { response?: { data?: { detail?: unknown } } }).response;
    const detail = resp?.data?.detail;
    if (typeof detail === 'string') return detail;
  }
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
}
