import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { AppShell } from "../components/layout/AppShell";
import { NotebookForm } from "../components/notebook/NotebookForm";
import { NotebookTree } from "../components/notebook/NotebookTree";
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
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300"
          >
            Failed to load workspace.{` `}
            <button
              type="button"
              onClick={() => refetch()}
              className="font-medium underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}
        {workspace && (
          <>
            {/* Workspace header */}
            <section className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-brand-gradient opacity-10 blur-3xl"
              />
              <div className="relative">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600 dark:text-brand-300">
                  Workspace
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 dark:text-zinc-100">
                  {workspace.name}
                </h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-zinc-300 sm:text-base">
                  {workspace.description?.trim() || "No description yet."}
                </p>
                <p className="mt-4 text-sm text-gray-500 dark:text-zinc-400">
                  Press{" "}
                  <kbd className="rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                    ⌘K
                  </kbd>
                  <span className="mx-1 text-gray-400 dark:text-zinc-500">/</span>
                  <kbd className="rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                    Ctrl+K
                  </kbd>{" "}
                  to search every note in this workspace.
                </p>
              </div>
            </section>

            {/* Notebooks & notes section */}
            <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:mt-8 sm:p-8">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">
                  Notebooks
                </h3>
              </div>
              <NotebookTree workspaceId={workspaceId} />
              <div className="mt-4 border-t border-gray-100 pt-4 dark:border-zinc-800">
                <NotebookForm workspaceId={workspaceId} />
              </div>
            </section>

            {/* Members section */}
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
