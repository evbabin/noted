import type {
  BlockDelta,
  PresenceCursor,
  PresenceUser,
  SelectionRange,
  TiptapDocument,
} from "./editor";

export interface ContentUpdateClientMessage {
  type: "content_update";
  data: {
    blocks: BlockDelta[];
  };
}

export interface CursorMoveClientMessage {
  type: "cursor_move";
  data: {
    position: number;
    selection?: SelectionRange;
  };
}

export interface PresencePingClientMessage {
  type: "presence_ping";
  data?: Record<string, never>;
}

export type ClientMessage =
  | ContentUpdateClientMessage
  | CursorMoveClientMessage
  | PresencePingClientMessage;

export interface SyncStateData {
  content: TiptapDocument;
  version: number;
  users: PresenceUser[];
}

export interface SyncStateMessage {
  type: "sync_state";
  data: SyncStateData;
}

export interface ContentUpdateData {
  blocks: BlockDelta[];
  user_id: string;
  version: number;
}

export interface ContentUpdateMessage {
  type: "content_update";
  data: ContentUpdateData;
}

export interface CursorUpdateData extends PresenceCursor {}

export interface CursorUpdateMessage {
  type: "cursor_update";
  data: CursorUpdateData;
}

export interface UserJoinedData {
  user_id: string;
  display_name: string;
  avatar_url?: string | null;
}

export interface UserJoinedMessage {
  type: "user_joined";
  data: UserJoinedData;
}

export interface UserLeftData {
  user_id: string;
}

export interface UserLeftMessage {
  type: "user_left";
  data: UserLeftData;
}

export interface ErrorData {
  code: string;
  message: string;
}

export interface ErrorMessage {
  type: "error";
  data: ErrorData;
}

export type ServerMessage =
  | SyncStateMessage
  | ContentUpdateMessage
  | CursorUpdateMessage
  | UserJoinedMessage
  | UserLeftMessage
  | ErrorMessage;

export interface WebSocketConnectionState {
  status: "idle" | "connecting" | "open" | "reconnecting" | "closed" | "error";
  reconnectAttempt: number;
  lastError: string | null;
}

export function isServerMessage(value: unknown): value is ServerMessage {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const maybeMessage = value as { type?: unknown; data?: unknown };

  if (typeof maybeMessage.type !== "string") {
    return false;
  }

  switch (maybeMessage.type) {
    case "sync_state":
    case "content_update":
    case "cursor_update":
    case "user_joined":
    case "user_left":
    case "error":
      return (
        typeof maybeMessage.data === "object" && maybeMessage.data !== null
      );
    default:
      return false;
  }
}

export function isClientMessage(value: unknown): value is ClientMessage {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const maybeMessage = value as { type?: unknown };

  return (
    maybeMessage.type === "content_update" ||
    maybeMessage.type === "cursor_move" ||
    maybeMessage.type === "presence_ping"
  );
}

export function parseServerMessage(value: string): ServerMessage {
  return JSON.parse(value) as ServerMessage;
}
