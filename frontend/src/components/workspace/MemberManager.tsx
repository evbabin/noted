import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import toast from "react-hot-toast";

import { sharingApi } from "../../api/sharing";
import { workspaceKeys } from "../../hooks/useWorkspace";
import { useAuthStore } from "../../stores/authStore";
import type {
  ApiError,
  InviteWorkspaceMemberRequest,
  MemberRole,
  WorkspaceInviteResult,
  WorkspaceMember,
} from "../../types/api";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { Input } from "../ui/Input";
import { LoadingState } from "../ui/LoadingState";

const MEMBER_QUERY_KEY = "workspace-members";

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Owner",
  editor: "Editor",
  commenter: "Commenter",
  viewer: "Viewer",
};

const MEMBER_ROLE_OPTIONS: MemberRole[] = [
  "owner",
  "editor",
  "commenter",
  "viewer",
];

const ROLE_SORT_ORDER: Record<MemberRole, number> = {
  owner: 0,
  editor: 1,
  commenter: 2,
  viewer: 3,
};

interface MemberManagerProps {
  workspaceId: string;
}

export function MemberManager({ workspaceId }: MemberManagerProps) {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("viewer");
  const [roleUpdateUserId, setRoleUpdateUserId] = useState<string | null>(null);
  const [removeUserId, setRemoveUserId] = useState<string | null>(null);

  const {
    data: members = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<WorkspaceMember[]>({
    queryKey: memberQueryKey(workspaceId),
    queryFn: () => sharingApi.listMembers(workspaceId),
    enabled: Boolean(workspaceId),
  });

  const currentMembership = members.find(
    (member) => member.user_id === currentUser?.id,
  );

  // We derive permissions from the live member list so ownership changes are
  // reflected immediately after a mutation instead of waiting for a full page reload.
  const canManageMembers = currentMembership?.role === "owner";

  const sortedMembers = useMemo(
    () =>
      [...members].sort((left, right) => {
        const roleDiff =
          ROLE_SORT_ORDER[left.role] - ROLE_SORT_ORDER[right.role];
        if (roleDiff !== 0) {
          return roleDiff;
        }

        return getMemberLabel(left).localeCompare(getMemberLabel(right));
      }),
    [members],
  );

  async function refreshMemberQueries() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: memberQueryKey(workspaceId) }),
      queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId] }),
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.detail(workspaceId),
      }),
    ]);
  }

  const inviteMutation = useMutation({
    mutationFn: (payload: InviteWorkspaceMemberRequest) =>
      sharingApi.inviteMember(workspaceId, payload),
    onSuccess: async (result) => {
      await refreshMemberQueries();
      setInviteEmail("");
      setInviteRole("viewer");

      if (isPendingInvitation(result)) {
        toast.success(
          `Invitation saved for ${result.email}. It will apply when they sign up.`,
        );
        return;
      }

      toast.success(`Added ${getMemberLabel(result)} to the workspace`);
    },
    onError: (mutationError) => {
      toast.error(
        extractErrorDetail(mutationError) ?? "Failed to invite member",
      );
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: MemberRole }) =>
      sharingApi.updateMemberRole(workspaceId, userId, { role }),
    onSuccess: async (member) => {
      await refreshMemberQueries();
      toast.success(
        `Updated ${getMemberLabel(member)} to ${ROLE_LABELS[member.role]}`,
      );
    },
    onError: (mutationError) => {
      toast.error(
        extractErrorDetail(mutationError) ?? "Failed to update member role",
      );
    },
    onSettled: () => {
      setRoleUpdateUserId(null);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) =>
      sharingApi.removeMember(workspaceId, userId),
    onSuccess: async () => {
      await refreshMemberQueries();
      toast.success("Removed member from the workspace");
    },
    onError: (mutationError) => {
      toast.error(
        extractErrorDetail(mutationError) ?? "Failed to remove member",
      );
    },
    onSettled: () => {
      setRemoveUserId(null);
    },
  });

  function handleInviteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = inviteEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      return;
    }

    inviteMutation.mutate({
      email: normalizedEmail,
      role: inviteRole,
    });
  }

  function handleInviteRoleChange(nextRole: string) {
    if (isMemberRole(nextRole)) {
      setInviteRole(nextRole);
    }
  }

  function handleRoleChange(userId: string, nextRole: string) {
    if (!isMemberRole(nextRole)) {
      return;
    }

    const member = members.find((candidate) => candidate.user_id === userId);
    if (!member || member.role === nextRole) {
      return;
    }

    setRoleUpdateUserId(userId);
    updateRoleMutation.mutate({ userId, role: nextRole });
  }

  function handleRemoveMember(userId: string) {
    setRemoveUserId(userId);
    removeMutation.mutate(userId);
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">Members</h3>
          <p className="text-sm text-gray-600 dark:text-zinc-300">
            Invite collaborators, update roles, and review who can access this
            workspace.
          </p>
        </div>
        <Badge variant="secondary" className="w-fit">
          {members.length} {members.length === 1 ? "member" : "members"}
        </Badge>
      </div>

      {!isLoading && !isError && (
        <>
          {canManageMembers ? (
            <form
              onSubmit={handleInviteSubmit}
              className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex flex-col gap-3 lg:flex-row">
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="Invite by email"
                  autoComplete="email"
                  required
                  disabled={inviteMutation.isPending}
                  className="flex-1 bg-white"
                />
                <select
                  value={inviteRole}
                  onChange={(event) =>
                    handleInviteRoleChange(event.target.value)
                  }
                  aria-label="Invite role"
                  disabled={inviteMutation.isPending}
                    className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  >
                  {MEMBER_ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
                <Button
                  type="submit"
                  className="w-full sm:w-auto"
                  disabled={
                    inviteMutation.isPending || inviteEmail.trim().length === 0
                  }
                >
                  {inviteMutation.isPending ? "Sending…" : "Invite member"}
                </Button>
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-zinc-400">
                Existing users are added immediately. Unknown emails stay
                pending until signup.
              </p>
            </form>
          ) : (
            <p className="mt-5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
              Only workspace owners can invite members or change roles.
            </p>
          )}
        </>
      )}

        <div className="mt-5">
          {isLoading && (
            <LoadingState
              compact
              title="Loading members…"
              message="Fetching workspace roles and invitations."
            />
          )}

        {isError && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
          >
            {extractErrorDetail(error) ?? "Failed to load workspace members."}{" "}
            <button
              type="button"
              onClick={() => refetch()}
              className="font-medium underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && !isError && sortedMembers.length === 0 && (
          <EmptyState
            compact
            title="No members yet"
            description="Invite collaborators to start sharing this workspace."
          />
        )}

        {!isLoading && !isError && sortedMembers.length > 0 && (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-zinc-800 dark:border-zinc-800">
            {sortedMembers.map((member) => {
              const isCurrentUser = member.user_id === currentUser?.id;
              const isUpdatingRole = roleUpdateUserId === member.user_id;
              const isRemovingMember = removeUserId === member.user_id;
              const canEditThisRow = canManageMembers && !isCurrentUser;

              return (
                <li
                  key={member.id}
                  className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-gray-900 dark:text-zinc-100">
                        {getMemberLabel(member)}
                      </p>
                      {isCurrentUser && <Badge variant="outline">You</Badge>}
                    </div>
                    <p className="truncate text-sm text-gray-600 dark:text-zinc-300">
                      {member.user?.email ?? member.user_id}
                    </p>
                    <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">
                      Joined {new Date(member.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    {canEditThisRow ? (
                      <>
                        <select
                          value={member.role}
                          onChange={(event) =>
                            handleRoleChange(member.user_id, event.target.value)
                          }
                          aria-label={`Change role for ${getMemberLabel(member)}`}
                          disabled={isUpdatingRole || isRemovingMember}
                          className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        >
                          {MEMBER_ROLE_OPTIONS.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleRemoveMember(member.user_id)}
                          disabled={isUpdatingRole || isRemovingMember}
                        >
                          {isRemovingMember ? "Removing…" : "Remove"}
                        </Button>
                      </>
                    ) : (
                      <Badge
                        variant={
                          member.role === "owner" ? "default" : "secondary"
                        }
                      >
                        {ROLE_LABELS[member.role]}
                      </Badge>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function memberQueryKey(workspaceId: string) {
  return [MEMBER_QUERY_KEY, workspaceId] as const;
}

function isMemberRole(value: string): value is MemberRole {
  return MEMBER_ROLE_OPTIONS.some((role) => role === value);
}

function isPendingInvitation(
  result: WorkspaceInviteResult,
): result is Extract<WorkspaceInviteResult, { status: "pending" }> {
  return "status" in result;
}

function getMemberLabel(member: WorkspaceMember) {
  return member.user?.display_name ?? member.user?.email ?? "Workspace member";
}

function extractErrorDetail(error: unknown): string | null {
  if (isAxiosError<ApiError>(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") {
      return detail;
    }
  }

  return null;
}

export default MemberManager;
