import apiClient from './client';
import type {
  Note,
  NoteCreateRequest,
  NoteSummary,
  NoteUpdateRequest,
} from '../types/api';

export const notesApi = {
  listInNotebook: (notebookId: string) =>
    apiClient
      .get<NoteSummary[]>(`/notebooks/${notebookId}/notes`)
      .then((r) => r.data),

  create: (notebookId: string, data: NoteCreateRequest) =>
    apiClient
      .post<Note>(`/notebooks/${notebookId}/notes`, data)
      .then((r) => r.data),

  get: (id: string) =>
    apiClient.get<Note>(`/notes/${id}`).then((r) => r.data),

  update: (id: string, data: NoteUpdateRequest) =>
    apiClient.patch<Note>(`/notes/${id}`, data).then((r) => r.data),

  remove: (id: string) =>
    apiClient.delete<void>(`/notes/${id}`).then((r) => r.data),
};
