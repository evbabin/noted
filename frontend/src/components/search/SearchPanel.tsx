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
        className="w-full max-w-xl overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-200 px-3 py-2">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes…"
            className="w-full border-0 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-gray-400"
          />
        </div>
        <div className="max-h-96 overflow-y-auto">
          {debounced.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-gray-400">
              Type to search across this workspace.
            </p>
          )}
          {debounced.length > 0 && isFetching && results.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-gray-400">
              Searching…
            </p>
          )}
          {debounced.length > 0 && isError && (
            <div className="px-4 py-6 text-center text-sm text-red-600">
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
              <p className="px-4 py-6 text-center text-sm text-gray-400">
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
                    className={`block w-full border-b border-gray-100 px-4 py-3 text-left last:border-b-0 ${
                      i === activeIndex ? "bg-indigo-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="truncate text-sm font-medium text-gray-900">
                      {hit.title || "Untitled"}
                    </div>
                    <div
                      className="mt-0.5 truncate text-xs text-gray-600 [&_b]:font-semibold [&_b]:text-indigo-700"
                      dangerouslySetInnerHTML={{ __html: hit.snippet }}
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-3 py-1.5 text-[11px] text-gray-500">
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
