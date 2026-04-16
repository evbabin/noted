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

export type QuizStatus = 'pending' | 'generating' | 'completed' | 'failed';
export type QuestionType = 'multiple_choice' | 'fill_in_the_blank' | 'flashcard';

export interface QuizSummary {
  id: string;
  note_id: string;
  title: string;
  status: QuizStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  question_type: QuestionType;
  question_text: string;
  // Only populated for multiple_choice; backend stores as { choices: string[] }
  options: { choices: string[] } | null;
  correct_answer: string;
  explanation: string | null;
  order: number;
}

export interface QuizResponse extends QuizSummary {
  questions: QuizQuestion[];
}

export interface QuizCreateRequest {
  title: string;
  // Backend accepts 3–20; defaults to 10 if omitted
  num_questions?: number;
}

export interface QuizAttemptCreateRequest {
  answers: Record<string, string>;
}

export interface QuizAttemptResponse {
  id: string;
  quiz_id: string;
  user_id: string;
  score: number;
  total_questions: number;
  correct_count: number;
  answers: Record<string, { answer: string; correct: boolean }>;
  created_at: string;
}
