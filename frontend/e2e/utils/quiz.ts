import type { APIRequestContext } from "@playwright/test";

import {
  buildSeedUser,
  createNote,
  createNotebook,
  createWorkspace,
  registerUser,
  seededDocument,
  type AuthResponse,
  type NotebookResponse,
  type NoteResponse,
  type WorkspaceResponse,
} from "./collaboration";

export interface QuizSeedResult {
  owner: AuthResponse;
  workspace: WorkspaceResponse;
  notebook: NotebookResponse;
  note: NoteResponse;
  noteUrl: string;
}

export async function seedQuizWorkspace(
  request: APIRequestContext,
  frontendBaseUrl: string,
): Promise<QuizSeedResult> {
  const ownerUser = buildSeedUser("quiz-owner");
  const owner = await registerUser(request, ownerUser);

  const workspace = await createWorkspace(request, owner.access_token, {
    name: `Quiz Workspace ${Date.now()}`,
    description: "Seeded by Playwright quiz flow test",
  });

  const notebook = await createNotebook(
    request,
    owner.access_token,
    workspace.id,
    {
      title: "Quiz Notebook",
    },
  );

  const note = await createNote(request, owner.access_token, notebook.id, {
    title: "Quiz Source Note",
    content: seededDocument(
      "ARQ workers process background jobs, Redis stores coordination data, and React Query manages server state in the frontend.",
    ),
  });

  return {
    owner,
    workspace,
    notebook,
    note,
    noteUrl: `${trimTrailingSlash(frontendBaseUrl)}/workspaces/${workspace.id}/notes/${note.id}`,
  };
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
