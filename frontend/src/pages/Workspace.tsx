import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { AppShell } from "../components/layout/AppShell";
import { SearchPanel } from "../components/search/SearchPanel";
import { LoadingState } from "../components/ui/LoadingState";
import { MemberManager } from "../components/workspace/MemberManager";
import { workspacesApi } from "../api/workspaces";
import type { WorkspaceWithMembers } from "../types/api";

export function Workspace() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [searchOpen, setSearchOpen] = useState(false);

  const {
    data: workspace,
    isLoading,
    isError,
    refetch,
  } = useQuery<WorkspaceWithMembers>({
    queryKey: ["workspace", workspaceId],
    queryFn: () => workspacesApi.get(workspaceId as string),
    enabled: Boolean(workspaceId),
    meta: { errorMessage: "Failed to load workspace." },
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!workspaceId) {
    return null;
  }

  return (
    <AppShell
      workspaceId={workspaceId}
      workspaceName={workspace?.name}
      title={workspace?.name}
      onOpenSearch={() => setSearchOpen(true)}
    >
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        {isLoading && (
          <LoadingState
            title="Loading workspace…"
            message="Fetching members and workspace details."
          />
        )}
        {isError && (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
            Failed to load workspace.{` `}
            <button
              type="button"
              onClick={() => refetch()}
              className="underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}
        {workspace && (
          <>
            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-2xl font-semibold text-gray-900">
                {workspace.name}
              </h2>
              <p className="mt-2 text-sm text-gray-600 sm:text-base">
                {workspace.description?.trim() || "No description yet."}
              </p>
              <p className="mt-4 text-sm text-gray-500">
                Use the search button in the header or press{" "}
                <kbd className="rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 text-xs">
                  ⌘K
                </kbd>
                <span className="mx-1 text-gray-400">/</span>
                <kbd className="rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 text-xs">
                  Ctrl+K
                </kbd>{" "}
                to search notes in this workspace.
              </p>
            </section>
            <div className="mt-6 sm:mt-8">
              <MemberManager workspaceId={workspaceId} />
            </div>
          </>
        )}
      </div>
      <SearchPanel
        workspaceId={workspaceId}
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
    </AppShell>
  );
}

export default Workspace;
