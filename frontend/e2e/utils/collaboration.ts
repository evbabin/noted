import {
  expect,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

const DEFAULT_API_BASE_URL = "http://localhost:8000/api/v1";
const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const AUTH_STORE_KEY = "noted-auth";

export interface SeedUser {
  email: string;
  password: string;
  displayName: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
}

export interface AuthResponse extends AuthTokens {
  user: AuthUser;
}

export interface WorkspaceResponse {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
}

export interface NotebookResponse {
  id: string;
  workspace_id: string;
  title: string;
  sort_order: number;
}

export interface NoteResponse {
  id: string;
  notebook_id: string;
  title: string;
  content: unknown | null;
  content_text: string | null;
  version: number;
}

export interface CollaborationSeedResult {
  owner: AuthResponse;
  collaborator: AuthResponse;
  workspace: WorkspaceResponse;
  notebook: NotebookResponse;
  note: NoteResponse;
  noteUrl: string;
}

interface WorkspaceMemberResponse {
  id: string;
  workspace_id: string;
  user_id: string;
  role: "owner" | "editor" | "commenter" | "viewer";
}

interface WorkspaceInvitationResponse {
  workspace_id: string;
  email: string;
  role: "owner" | "editor" | "commenter" | "viewer";
  status: "pending";
}

interface JsonRequestOptions {
  data?: unknown;
  token?: string;
  expectedStatus?: number | number[];
}

export function getApiBaseUrl(): string {
  return (
    process.env.PLAYWRIGHT_BACKEND_API_URL ??
    process.env.VITE_API_BASE_URL ??
    DEFAULT_API_BASE_URL
  );
}

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildSeedUser(prefix: string): SeedUser {
  const suffix = uniqueSuffix();

  return {
    email: `${prefix}-${suffix}@example.com`,
    password: "correct-horse-battery",
    displayName: `${capitalize(prefix)} ${suffix.slice(0, 6)}`,
  };
}

export async function registerUser(
  request: APIRequestContext,
  user: SeedUser,
): Promise<AuthResponse> {
  return requestJson<AuthResponse>(request, "POST", "/auth/register", {
    data: {
      email: user.email,
      password: user.password,
      display_name: user.displayName,
    },
    expectedStatus: 201,
  });
}

export async function createWorkspace(
  request: APIRequestContext,
  token: string,
  payload: {
    name: string;
    description?: string | null;
  },
): Promise<WorkspaceResponse> {
  return requestJson<WorkspaceResponse>(request, "POST", "/workspaces/", {
    token,
    data: payload,
    expectedStatus: 201,
  });
}

export async function createNotebook(
  request: APIRequestContext,
  token: string,
  workspaceId: string,
  payload: {
    title: string;
  },
): Promise<NotebookResponse> {
  return requestJson<NotebookResponse>(
    request,
    "POST",
    `/workspaces/${workspaceId}/notebooks`,
    {
      token,
      data: payload,
      expectedStatus: 201,
    },
  );
}

export async function createNote(
  request: APIRequestContext,
  token: string,
  notebookId: string,
  payload: {
    title: string;
    content?: unknown | null;
  },
): Promise<NoteResponse> {
  return requestJson<NoteResponse>(
    request,
    "POST",
    `/notebooks/${notebookId}/notes`,
    {
      token,
      data: payload,
      expectedStatus: 201,
    },
  );
}

export async function inviteWorkspaceMember(
  request: APIRequestContext,
  token: string,
  workspaceId: string,
  email: string,
  role: "editor" | "commenter" | "viewer",
): Promise<WorkspaceMemberResponse | WorkspaceInvitationResponse> {
  return requestJson<WorkspaceMemberResponse | WorkspaceInvitationResponse>(
    request,
    "POST",
    `/workspaces/${workspaceId}/invitations`,
    {
      token,
      data: {
        email,
        role,
      },
      expectedStatus: [201, 202],
    },
  );
}

export async function getNote(
  request: APIRequestContext,
  token: string,
  noteId: string,
): Promise<NoteResponse> {
  return requestJson<NoteResponse>(request, "GET", `/notes/${noteId}`, {
    token,
  });
}

export async function seedCollaborationWorkspace(
  request: APIRequestContext,
  frontendBaseUrl: string,
): Promise<CollaborationSeedResult> {
  const ownerUser = buildSeedUser("owner");
  const collaboratorUser = buildSeedUser("collaborator");

  const owner = await registerUser(request, ownerUser);
  const collaborator = await registerUser(request, collaboratorUser);

  const workspace = await createWorkspace(request, owner.access_token, {
    name: `Collaboration Workspace ${uniqueSuffix()}`,
    description: "Seeded by Playwright collaboration test",
  });

  await inviteWorkspaceMember(
    request,
    owner.access_token,
    workspace.id,
    collaborator.user.email,
    "editor",
  );

  const notebook = await createNotebook(
    request,
    owner.access_token,
    workspace.id,
    {
      title: "Shared Notebook",
    },
  );

  const note = await createNote(request, owner.access_token, notebook.id, {
    title: "Shared Note",
    content: seededDocument("Initial collaboration content"),
  });

  return {
    owner,
    collaborator,
    workspace,
    notebook,
    note,
    noteUrl: `${trimTrailingSlash(frontendBaseUrl)}/workspaces/${workspace.id}/notes/${note.id}`,
  };
}

export async function createAuthenticatedContext(
  browser: Browser,
  frontendBaseUrl: string,
  auth: AuthResponse,
): Promise<BrowserContext> {
  const context = await browser.newContext();

  await context.addInitScript(
    ({
      accessToken,
      refreshToken,
      authUser,
      origin,
      accessKey,
      refreshKey,
      authKey,
    }) => {
      const authState = JSON.stringify({
        state: {
          user: authUser,
          isAuthenticated: true,
        },
        version: 0,
      });

      if (window.location.origin === origin) {
        window.localStorage.setItem(accessKey, accessToken);
        window.localStorage.setItem(refreshKey, refreshToken);
        window.localStorage.setItem(authKey, authState);
      }

      window.addEventListener("DOMContentLoaded", () => {
        if (window.location.origin === origin) {
          window.localStorage.setItem(accessKey, accessToken);
          window.localStorage.setItem(refreshKey, refreshToken);
          window.localStorage.setItem(authKey, authState);
        }
      });
    },
    {
      accessToken: auth.access_token,
      refreshToken: auth.refresh_token,
      authUser: auth.user,
      origin: trimTrailingSlash(frontendBaseUrl),
      accessKey: ACCESS_TOKEN_KEY,
      refreshKey: REFRESH_TOKEN_KEY,
      authKey: AUTH_STORE_KEY,
    },
  );

  const bootstrapPage = await context.newPage();
  await bootstrapPage.goto(frontendBaseUrl, { waitUntil: "domcontentloaded" });
  await bootstrapPage.evaluate(
    ({
      accessToken,
      refreshToken,
      authUser,
      accessKey,
      refreshKey,
      authKey,
    }) => {
      window.localStorage.setItem(accessKey, accessToken);
      window.localStorage.setItem(refreshKey, refreshToken);
      window.localStorage.setItem(
        authKey,
        JSON.stringify({
          state: {
            user: authUser,
            isAuthenticated: true,
          },
          version: 0,
        }),
      );
    },
    {
      accessToken: auth.access_token,
      refreshToken: auth.refresh_token,
      authUser: auth.user,
      accessKey: ACCESS_TOKEN_KEY,
      refreshKey: REFRESH_TOKEN_KEY,
      authKey: AUTH_STORE_KEY,
    },
  );
  await bootstrapPage.close();

  return context;
}

export async function expectPresenceUsers(
  page: Page,
  expectedNames: string[],
): Promise<void> {
  const entries = page.locator('[data-testid="presence-user"]');
  await expect
    .poll(async () => {
      const count = await entries.count();
      const names: string[] = [];

      for (let index = 0; index < count; index += 1) {
        const name = await entries.nth(index).getAttribute("data-user-name");
        if (name) {
          names.push(name);
        }
      }

      return names.sort();
    })
    .toEqual([...expectedNames].sort());
}

export async function expectRemoteCursorVisible(
  page: Page,
  userId: string,
): Promise<void> {
  await expect(
    page.locator(`[data-testid="remote-cursor-${userId}"]`),
  ).toBeVisible();
}

export function emptyDocument(): Record<string, unknown> {
  return {
    type: "doc",
    content: [],
  };
}

export function seededDocument(text: string): Record<string, unknown> {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        attrs: {
          block_id: "seed-block-1",
          id: "seed-block-1",
        },
        content: [
          {
            type: "text",
            text,
          },
        ],
      },
    ],
  };
}

async function requestJson<T>(
  request: APIRequestContext,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  options: JsonRequestOptions = {},
): Promise<T> {
  const apiBaseUrl = trimTrailingSlash(getApiBaseUrl());
  const url = `${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  const headers: Record<string, string> = {};
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await request.fetch(url, {
    method,
    headers,
    data: options.data,
  });

  const expectedStatuses = Array.isArray(options.expectedStatus)
    ? options.expectedStatus
    : [options.expectedStatus ?? 200];
  const responseText = await response.text();

  expect(
    expectedStatuses.includes(response.status()),
    `Expected ${method} ${url} to return one of ${expectedStatuses.join(", ")}, received ${response.status()} with body: ${responseText}`,
  ).toBe(true);

  if (!responseText) {
    return undefined as T;
  }

  return JSON.parse(responseText) as T;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function capitalize(value: string): string {
  return value.length === 0 ? value : value[0].toUpperCase() + value.slice(1);
}
