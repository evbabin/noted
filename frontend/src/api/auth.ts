import apiClient from './client';
import type {
  LoginRequest,
  MessageResponse,
  PasswordResetRequest,
  RegisterRequest,
  TokenPair,
  TokenResponse,
  User,
} from '../types/api';

export const authApi = {
  register: (data: RegisterRequest) =>
    apiClient.post<TokenResponse>('/auth/register', data).then((r) => r.data),

  login: (data: LoginRequest) =>
    apiClient.post<TokenResponse>('/auth/login', data).then((r) => r.data),

  refresh: (refreshToken: string) =>
    apiClient
      .post<TokenPair>('/auth/refresh', { refresh_token: refreshToken })
      .then((r) => r.data),

  logout: (refreshToken: string) =>
    apiClient.post<void>('/auth/logout', { refresh_token: refreshToken }),

  me: () => apiClient.get<User>('/auth/me').then((r) => r.data),

  passwordReset: (data: PasswordResetRequest) =>
    apiClient
      .post<MessageResponse>('/auth/password-reset', data)
      .then((r) => r.data),

  googleLoginUrl: () => `${import.meta.env.VITE_API_BASE_URL}/auth/google`,

  exchangeGoogleCode: (code: string) =>
    apiClient
      .get<TokenResponse>('/auth/google/callback', { params: { code } })
      .then((r) => r.data),
};
