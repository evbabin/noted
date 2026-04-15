export interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface TokenResponse extends TokenPair {
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
  display_name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface LogoutRequest {
  refresh_token: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface MessageResponse {
  message: string;
}

export interface ApiError {
  error: string;
  detail: string | unknown;
}

export type MemberRole = 'owner' | 'editor' | 'commenter' | 'viewer';

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: MemberRole;
  created_at: string;
  updated_at: string;
  user?: User | null;
}

export interface WorkspaceWithMembers extends Workspace {
  members: WorkspaceMember[];
}

export interface WorkspaceCreateRequest {
  name: string;
  description?: string | null;
}

export interface WorkspaceUpdateRequest {
  name?: string;
  description?: string | null;
}

export interface Notebook {
  id: string;
  workspace_id: string;
  title: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface NotebookCreateRequest {
  title: string;
}

export interface NotebookUpdateRequest {
  title?: string;
}

export interface NoteSummary {
  id: string;
  notebook_id: string;
  title: string;
  sort_order: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface Note extends NoteSummary {
  content: unknown | null;
  content_text: string | null;
}

export interface NoteCreateRequest {
  title: string;
  content?: unknown | null;
}

export interface NoteUpdateRequest {
  title?: string;
  content?: unknown | null;
}

export interface SearchHit {
  note_id: string;
  notebook_id: string;
  title: string;
  snippet: string;
  rank: number;
}

export interface SearchResponse {
  results: SearchHit[];
  total: number;
  query: string;
}
