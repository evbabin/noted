import { create } from "zustand";

import type { PresenceUser, SelectionRange } from "../types/editor";
import type {
  CursorUpdateMessage,
  SyncStateMessage,
  UserJoinedMessage,
} from "../types/websocket";

export interface PresenceEntry extends PresenceUser {
  position?: number;
  selection?: SelectionRange;
  joinedAt: number;
  lastSeenAt: number;
}

interface CursorPresencePayload {
  user_id: string;
  display_name: string;
  color: string;
  position: number;
  selection?: SelectionRange;
}

interface PresenceState {
  users: Record<string, PresenceEntry>;

  /**
   * Replace or merge the known collaborator roster for the active note.
   *
   * We intentionally preserve existing cursor / selection state for users that
   * are already known locally. Sync-state messages often describe "who is
   * present" while the cursor updates arrive on a different cadence, so wiping
   * those fields here would cause visible cursor flicker.
   */
  setUsers: (users: PresenceUser[]) => void;

  /**
   * Upsert collaborator metadata without disturbing any cursor information that
   * may already exist for that user.
   */
  upsertUser: (user: PresenceUser) => void;

  /**
   * Accept a cursor payload that may arrive independently from join / sync
   * messages. This keeps remote cursor movement responsive without requiring a
   * separate user metadata refresh first.
   */
  setPresence: (payload: CursorPresencePayload) => void;

  handleUserJoined: (
    message: UserJoinedMessage | UserJoinedMessage["data"],
  ) => void;

  updateCursor: (
    message: CursorUpdateMessage | CursorUpdateMessage["data"],
  ) => void;

  removeUser: (userId: string) => void;
  reset: () => void;
}

function toPresenceEntry(
  user: PresenceUser,
  existing?: PresenceEntry,
): PresenceEntry {
  const now = Date.now();

  return {
    user_id: user.user_id,
    display_name: user.display_name,
    avatar_url: user.avatar_url ?? existing?.avatar_url ?? null,
    color: user.color ?? existing?.color ?? "#6b7280",
    position: existing?.position,
    selection: existing?.selection,
    joinedAt: existing?.joinedAt ?? now,
    lastSeenAt: now,
  };
}

function mergePresenceEntry(
  base: PresenceEntry | undefined,
  patch: Partial<PresenceEntry> & {
    user_id: string;
    display_name: string;
  },
): PresenceEntry {
  const now = Date.now();

  return {
    user_id: patch.user_id,
    display_name: patch.display_name,
    avatar_url: patch.avatar_url ?? base?.avatar_url ?? null,
    color: patch.color ?? base?.color ?? "#6b7280",
    position: patch.position ?? base?.position,
    selection:
      patch.selection !== undefined ? patch.selection : base?.selection,
    joinedAt: base?.joinedAt ?? now,
    lastSeenAt: now,
  };
}

function extractJoinedPayload(
  message: UserJoinedMessage | UserJoinedMessage["data"],
): UserJoinedMessage["data"] {
  return "type" in message ? message.data : message;
}

function extractCursorPayload(
  message: CursorUpdateMessage | CursorUpdateMessage["data"],
): CursorUpdateMessage["data"] {
  return "type" in message ? message.data : message;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  users: {},

  setUsers: (users) =>
    set((state) => {
      const nextUsers: Record<string, PresenceEntry> = {};

      for (const user of users) {
        nextUsers[user.user_id] = toPresenceEntry(
          user,
          state.users[user.user_id],
        );
      }

      return { users: nextUsers };
    }),

  upsertUser: (user) =>
    set((state) => ({
      users: {
        ...state.users,
        [user.user_id]: toPresenceEntry(user, state.users[user.user_id]),
      },
    })),

  setPresence: (payload) =>
    set((state) => ({
      users: {
        ...state.users,
        [payload.user_id]: mergePresenceEntry(state.users[payload.user_id], {
          user_id: payload.user_id,
          display_name: payload.display_name,
          color: payload.color,
          position: payload.position,
          selection: payload.selection,
        }),
      },
    })),

  handleUserJoined: (message) =>
    set((state) => {
      const payload = extractJoinedPayload(message);

      return {
        users: {
          ...state.users,
          [payload.user_id]: mergePresenceEntry(state.users[payload.user_id], {
            user_id: payload.user_id,
            display_name: payload.display_name,
            avatar_url: payload.avatar_url ?? null,
          }),
        },
      };
    }),

  updateCursor: (message) =>
    set((state) => {
      const payload = extractCursorPayload(message);

      return {
        users: {
          ...state.users,
          [payload.user_id]: mergePresenceEntry(state.users[payload.user_id], {
            user_id: payload.user_id,
            display_name: payload.display_name,
            color: payload.color,
            position: payload.position,
            selection: payload.selection,
          }),
        },
      };
    }),

  removeUser: (userId) =>
    set((state) => {
      const nextUsers = { ...state.users };
      delete nextUsers[userId];
      return { users: nextUsers };
    }),

  reset: () => set({ users: {} }),
}));

export function selectPresenceUsers(state: PresenceState): PresenceEntry[] {
  return Object.values(state.users).sort((a, b) =>
    a.display_name.localeCompare(b.display_name),
  );
}

export function syncPresenceFromMessage(
  message: SyncStateMessage,
): PresenceUser[] {
  return message.data.users;
}
