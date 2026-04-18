import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { sharingApi } from '../api/sharing';
import type {
  InviteWorkspaceMemberRequest,
  UpdateWorkspaceMemberRoleRequest,
  WorkspaceMember,
} from '../types/api';
import { workspaceKeys } from './useWorkspace';

export const memberKeys = {
  all: ['workspace-members'] as const,
  list: (workspaceId: string) => [...memberKeys.all, workspaceId] as const,
};

export function useWorkspaceMembers(workspaceId: string | undefined) {
  return useQuery<WorkspaceMember[]>({
    queryKey: memberKeys.list(workspaceId ?? ''),
    queryFn: () => sharingApi.listMembers(workspaceId as string),
    enabled: Boolean(workspaceId),
    meta: { errorMessage: 'Failed to load workspace members.' },
  });
}

// Shared helper — member mutations all need to invalidate the member
// list AND the workspace detail (which embeds member previews). We
// centralize that here so each mutation hook stays one-liner.
function useInvalidateMembership(workspaceId: string) {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: memberKeys.list(workspaceId) }),
      qc.invalidateQueries({ queryKey: workspaceKeys.detail(workspaceId) }),
    ]);
}

export function useInviteMember(workspaceId: string) {
  const invalidate = useInvalidateMembership(workspaceId);
  return useMutation({
    mutationFn: (payload: InviteWorkspaceMemberRequest) =>
      sharingApi.inviteMember(workspaceId, payload),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateMemberRole(workspaceId: string) {
  const invalidate = useInvalidateMembership(workspaceId);
  return useMutation({
    mutationFn: ({
      userId,
      data,
    }: {
      userId: string;
      data: UpdateWorkspaceMemberRoleRequest;
    }) => sharingApi.updateMemberRole(workspaceId, userId, data),
    onSuccess: () => invalidate(),
  });
}

export function useRemoveMember(workspaceId: string) {
  const invalidate = useInvalidateMembership(workspaceId);
  return useMutation({
    mutationFn: (userId: string) =>
      sharingApi.removeMember(workspaceId, userId),
    onSuccess: () => invalidate(),
  });
}
