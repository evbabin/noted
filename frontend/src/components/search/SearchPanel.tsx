import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { searchApi } from "../../api/search";
import type { SearchHit } from "../../types/api";

interface SearchPanelProps {
  workspaceId: string;
  open: boolean;
  onClose: () => void;
}

export function SearchPanel({ workspaceId, open, onClose }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebounced("");
      setActiveIndex(0);
      return;
    }
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query.trim()), 200);
    return () => window.clearTimeout(id);
  }, [query]);

  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ["search", workspaceId, debounced],
    queryFn: () => searchApi.search(workspaceId, debounced),
    enabled: open && debounced.length > 0,
    staleTime: 60_000,
    meta: {
      errorMessage: "Search failed. Please try again.",
      suppressErrorToast: true,
    },
  });

  const results = data?.results ?? [];

  useEffect(() => {
    setActiveIndex(0);
  }, [debounced]);

  function goTo(hit: SearchHit) {
    navigate(`/workspaces/${workspaceId}/notes/${hit.note_id}`);
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = results[activeIndex];
      if (hit) goTo(hit);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-24"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-lg bg-white shadow-xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-200 px-3 py-2 dark:border-zinc-800">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes…"
            className="w-full border-0 bg-transparent px-2 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
        </div>
        <div className="max-h-96 overflow-y-auto">
          {debounced.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-gray-400 dark:text-zinc-500">
              Type to search across this workspace.
            </p>
          )}
          {debounced.length > 0 && isFetching && results.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-gray-400 dark:text-zinc-500">
              Searching…
            </p>
          )}
          {debounced.length > 0 && isError && (
            <div className="px-4 py-6 text-center text-sm text-red-600 dark:text-red-300">
              Search failed.{` `}
              <button
                type="button"
                onClick={() => refetch()}
                className="underline hover:no-underline"
              >
                Retry
              </button>
            </div>
          )}
          {debounced.length > 0 &&
            !isFetching &&
            !isError &&
            results.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-gray-400 dark:text-zinc-500">
                No matches for “{debounced}”.
              </p>
            )}
          {results.length > 0 && (
            <ul>
              {results.map((hit, i) => (
                <li key={hit.note_id}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => goTo(hit)}
                    className={`block w-full border-b border-gray-100 px-4 py-3 text-left last:border-b-0 dark:border-zinc-800 ${
                      i === activeIndex
                        ? "bg-indigo-50 dark:bg-indigo-500/15"
                        : "hover:bg-gray-50 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <div className="truncate text-sm font-medium text-gray-900 dark:text-zinc-100">
                      {hit.title || "Untitled"}
                    </div>
                    <div
                      className="mt-0.5 truncate text-xs text-gray-600 dark:text-zinc-400 [&_mark]:rounded [&_mark]:bg-blue-100 [&_mark]:px-0.5 [&_mark]:text-blue-800 dark:[&_mark]:bg-blue-500/20 dark:[&_mark]:text-blue-200"
                      dangerouslySetInnerHTML={{ __html: hit.snippet }}
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-3 py-1.5 text-[11px] text-gray-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          <span>↑↓ navigate · ↵ open · esc close</span>
          {typeof data?.total === "number" && results.length > 0 && (
            <span>
              {results.length} of {data.total}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default SearchPanel;
