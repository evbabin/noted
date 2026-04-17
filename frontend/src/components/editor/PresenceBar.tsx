import Avatar from "../ui/Avatar";
import { EmptyState } from "../ui/EmptyState";
import {
  selectPresenceUsers,
  usePresenceStore,
} from "../../stores/presenceStore";

/**
 * PresenceBar renders the currently connected collaborators for the active
 * note. The component intentionally stays read-only: websocket and presence
 * store updates drive it, and it simply reflects the latest known collaborator
 * roster.
 */
export function PresenceBar() {
  const users = usePresenceStore(selectPresenceUsers);

  if (users.length === 0) {
    return (
      <div data-testid="presence-bar-empty" className="mb-3">
        <EmptyState
          compact
          title="No active collaborators"
          description="When someone joins this note, their presence will appear here."
          className="border-gray-200 bg-gray-50 dark:border-zinc-800 dark:bg-zinc-950"
        />
      </div>
    );
  }

  return (
    <div
      data-testid="presence-bar"
      className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div>
        <p className="text-sm font-medium text-gray-800 dark:text-zinc-200">
          {users.length === 1
            ? "1 collaborator in this note"
            : `${users.length} collaborators in this note`}
        </p>
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          Presence updates are live while collaborators stay connected.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {users.map((user) => (
          <div
            key={user.user_id}
            data-testid="presence-user"
            data-user-id={user.user_id}
            data-user-name={user.display_name}
            className="group flex items-center gap-2 rounded-full border border-gray-200 bg-white px-2 py-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            title={user.display_name}
          >
            <Avatar
              name={user.display_name}
              src={user.avatar_url}
              size={32}
              className="border-2 shadow-sm"
              backgroundColor={user.color}
              borderColor={user.color}
            />
            <div className="min-w-0">
                <p className="max-w-[10rem] truncate text-xs font-medium text-gray-800 dark:text-zinc-200">
                  {user.display_name}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-zinc-400">Active now</p>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

export default PresenceBar;
