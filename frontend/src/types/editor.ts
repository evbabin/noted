export type JSONPrimitive = string | number | boolean | null;

export type JSONValue = JSONPrimitive | JSONObject | JSONArray;

export interface JSONObject {
  [key: string]: JSONValue;
}

export interface JSONArray extends Array<JSONValue> {}

export type TiptapNode = JSONObject;
export type TiptapDocument = JSONObject | null;

export interface SelectionRange {
  from: number;
  to: number;
}

export type BlockAction = "insert" | "update" | "delete";

export interface BlockDelta {
  block_id: string;
  action: BlockAction;
  content?: TiptapNode;
  position?: number;
}

export interface EditorContentUpdate {
  blocks: BlockDelta[];
  user_id: string;
  version: number;
}

export interface CursorPosition {
  position: number;
  selection?: SelectionRange;
}

export interface PresenceUser {
  user_id: string;
  display_name: string;
  avatar_url?: string | null;
  color: string;
}

export interface PresenceCursor extends PresenceUser, CursorPosition {}

export interface EditorSyncState {
  content: TiptapDocument;
  version: number;
  users: PresenceUser[];
}

export type EditorConnectionStatus =
  | "idle"
  | "connecting"
  | "open"
  | "reconnecting"
  | "closed"
  | "error";
