import apiClient from "./client";
import type {
  InviteWorkspaceMemberRequest,
  UpdateWorkspaceMemberRoleRequest,
  WorkspaceInviteResult,
  WorkspaceMember,
} from "../types/api";

export const sharingApi = {
  listMembers: (workspaceId: string) =>
    apiClient
      .get<WorkspaceMember[]>(`/workspaces/${workspaceId}/members`)
      .then((r) => r.data),

  inviteMember: (workspaceId: string, data: InviteWorkspaceMemberRequest) =>
    apiClient
      .post<WorkspaceInviteResult>(
        `/workspaces/${workspaceId}/invitations`,
        data,
      )
      .then((r) => r.data),

  updateMemberRole: (
    workspaceId: string,
    userId: string,
    data: UpdateWorkspaceMemberRoleRequest,
  ) =>
    apiClient
      .patch<WorkspaceMember>(
        `/workspaces/${workspaceId}/members/${userId}`,
        data,
      )
      .then((r) => r.data),

  removeMember: (workspaceId: string, userId: string) =>
    apiClient.delete<void>(`/workspaces/${workspaceId}/members/${userId}`),
};
