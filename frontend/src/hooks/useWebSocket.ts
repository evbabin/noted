import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { tokenStorage } from "../api/client";
import { useEditorStore } from "../stores/editorStore";
import { usePresenceStore } from "../stores/presenceStore";
import type {
  ClientMessage,
  ContentUpdateMessage,
  CursorUpdateMessage,
  ErrorMessage,
  PresencePingClientMessage,
  SyncStateMessage,
  UserJoinedMessage,
  UserLeftMessage,
} from "../types/websocket";

const PRESENCE_PING_INTERVAL_MS = 4_000;
const INITIAL_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 10_000;

type ConnectionStatus =
  | "idle"
  | "connecting"
  | "open"
  | "reconnecting"
  | "closed"
  | "error";

interface UseWebSocketResult {
  send: (message: ClientMessage) => boolean;
  connectionStatus: ConnectionStatus;
  lastError: string | null;
  reconnect: () => void;
  disconnect: () => void;
  setPreDisconnect: (fn: (() => void) | null) => void;
}

function parseServerMessage(
  raw: string,
):
  | SyncStateMessage
  | ContentUpdateMessage
  | CursorUpdateMessage
  | UserJoinedMessage
  | UserLeftMessage
  | ErrorMessage {
  return JSON.parse(raw) as
    | SyncStateMessage
    | ContentUpdateMessage
    | CursorUpdateMessage
    | UserJoinedMessage
    | UserLeftMessage
    | ErrorMessage;
}

function getWebSocketUrl(noteId: string, token: string): string {
  const wsBaseUrl = import.meta.env.VITE_WS_URL as string | undefined;
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;

  let base: string | undefined = wsBaseUrl;

  if (!base && apiBaseUrl) {
    base = `${apiBaseUrl.replace(/^http/i, "ws").replace(/\/$/, "")}/ws`;
  }

  if (!base) {
    throw new Error("Missing VITE_WS_URL or VITE_API_BASE_URL");
  }

  const normalizedBase = base.replace(/\/$/, "");
  return `${normalizedBase}/${encodeURIComponent(noteId)}?token=${encodeURIComponent(token)}`;
}

export function useWebSocket(noteId: string | undefined): UseWebSocketResult {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const pingTimerRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const shouldReconnectRef = useRef(true);
  // Called at the top of disconnect() so callers can flush in-flight data
  // before the socket reference is cleared. React unmounts hooks in creation
  // order, so a caller's own cleanup would otherwise run after the socket closes.
  const preDisconnectRef = useRef<(() => void) | null>(null);

  const setPreDisconnect = useCallback((fn: (() => void) | null) => {
    preDisconnectRef.current = fn;
  }, []);

  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("idle");
  const [lastError, setLastError] = useState<string | null>(null);

  const token = tokenStorage.getAccess();

  const setActiveNote = useEditorStore((state) => state.setActiveNote);
  const initializeFromSync = useEditorStore(
    (state) => state.initializeFromSync,
  );
  const applyRemoteDelta = useEditorStore((state) => state.applyRemoteDelta);
  const setEditorConnectionStatus = useEditorStore(
    (state) => state.setConnectionStatus,
  );
  const setEditorError = useEditorStore((state) => state.setError);
  const resetEditor = useEditorStore((state) => state.reset);

  const setPresenceUsers = usePresenceStore((state) => state.setUsers);
  const updateCursor = usePresenceStore((state) => state.updateCursor);
  const handleUserJoined = usePresenceStore((state) => state.handleUserJoined);
  const removeUser = usePresenceStore((state) => state.removeUser);
  const resetPresence = usePresenceStore((state) => state.reset);

  const cleanupReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const cleanupPingTimer = useCallback(() => {
    if (pingTimerRef.current !== null) {
      window.clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
  }, []);

  const cleanupSocket = useCallback(() => {
    const socket = wsRef.current;
    wsRef.current = null;

    if (!socket) {
      return;
    }

    socket.onopen = null;
    socket.onclose = null;
    socket.onerror = null;
    socket.onmessage = null;

    if (
      socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING
    ) {
      socket.close();
    }
  }, []);

  const disconnect = useCallback(() => {
    preDisconnectRef.current?.();
    shouldReconnectRef.current = false;
    cleanupReconnectTimer();
    cleanupPingTimer();
    cleanupSocket();
    setConnectionStatus("closed");
    setEditorConnectionStatus("closed");
    setEditorError(null);
  }, [
    cleanupPingTimer,
    cleanupReconnectTimer,
    cleanupSocket,
    setEditorConnectionStatus,
    setEditorError,
  ]);

  const send = useCallback((message: ClientMessage): boolean => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    socket.send(JSON.stringify(message));
    return true;
  }, []);

  const sendPresencePing = useCallback(() => {
    const ping: PresencePingClientMessage = { type: "presence_ping" };
    send(ping);
  }, [send]);

  const startPresencePing = useCallback(() => {
    cleanupPingTimer();
    pingTimerRef.current = window.setInterval(() => {
      sendPresencePing();
    }, PRESENCE_PING_INTERVAL_MS);
  }, [cleanupPingTimer, sendPresencePing]);

  const handleSyncStateMessage = useCallback(
    (message: SyncStateMessage) => {
      initializeFromSync(message.data, noteId);
      setPresenceUsers(message.data.users);
    },
    [initializeFromSync, noteId, setPresenceUsers],
  );

  const handleContentUpdateMessage = useCallback(
    (message: ContentUpdateMessage) => {
      applyRemoteDelta(message.data);
    },
    [applyRemoteDelta],
  );

  const handleCursorUpdateMessage = useCallback(
    (message: CursorUpdateMessage) => {
      updateCursor(message.data);
    },
    [updateCursor],
  );

  const handleUserJoinedMessage = useCallback(
    (message: UserJoinedMessage) => {
      handleUserJoined(message);
    },
    [handleUserJoined],
  );

  const handleUserLeftMessage = useCallback(
    (message: UserLeftMessage) => {
      removeUser(message.data.user_id);
    },
    [removeUser],
  );

  const handleServerErrorMessage = useCallback(
    (message: ErrorMessage) => {
      setLastError(message.data.message);
      setConnectionStatus("error");
      setEditorConnectionStatus("error");
      setEditorError(message.data.message);
    },
    [setEditorConnectionStatus, setEditorError],
  );

  const connectRef = useRef<(() => void) | null>(null);

  const connect = useCallback(() => {
    if (!noteId) {
      setConnectionStatus("idle");
      setEditorConnectionStatus("idle");
      setEditorError(null);
      return;
    }

    if (!token) {
      const errorMessage = "Missing access token";
      setLastError(errorMessage);
      setConnectionStatus("error");
      setEditorConnectionStatus("error");
      setEditorError(errorMessage);
      return;
    }

    cleanupReconnectTimer();
    cleanupPingTimer();
    cleanupSocket();

    shouldReconnectRef.current = true;
    setLastError(null);
    setEditorError(null);

    const nextStatus: ConnectionStatus =
      reconnectAttemptsRef.current > 0 ? "reconnecting" : "connecting";
    setConnectionStatus(nextStatus);
    setEditorConnectionStatus(nextStatus);

    let socketUrl: string;
    try {
      socketUrl = getWebSocketUrl(noteId, token);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to build websocket URL";
      setLastError(message);
      setConnectionStatus("error");
      setEditorConnectionStatus("error");
      setEditorError(message);
      return;
    }

    const socket = new WebSocket(socketUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      reconnectAttemptsRef.current = 0;
      setConnectionStatus("open");
      setEditorConnectionStatus("open");
      setLastError(null);
      setEditorError(null);
      startPresencePing();
      sendPresencePing();
    };

    socket.onmessage = (event: MessageEvent<string>) => {
      try {
        const message = parseServerMessage(event.data);

        switch (message.type) {
          case "sync_state":
            handleSyncStateMessage(message);
            break;
          case "content_update":
            handleContentUpdateMessage(message);
            break;
          case "cursor_update":
            handleCursorUpdateMessage(message);
            break;
          case "user_joined":
            handleUserJoinedMessage(message);
            break;
          case "user_left":
            handleUserLeftMessage(message);
            break;
          case "error":
            handleServerErrorMessage(message);
            break;
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to parse websocket message";
        setLastError(message);
        setEditorError(message);
      }
    };

    socket.onerror = () => {
      const errorMessage = "WebSocket connection error";
      setLastError(errorMessage);
      setConnectionStatus("error");
      setEditorConnectionStatus("error");
      setEditorError(errorMessage);
    };

    socket.onclose = () => {
      cleanupPingTimer();
      wsRef.current = null;

      if (!shouldReconnectRef.current) {
        setConnectionStatus("closed");
        setEditorConnectionStatus("closed");
        return;
      }

      const attempt = reconnectAttemptsRef.current;
      const delay = Math.min(
        INITIAL_RECONNECT_DELAY_MS * 2 ** attempt,
        MAX_RECONNECT_DELAY_MS,
      );

      setConnectionStatus("reconnecting");
      setEditorConnectionStatus("reconnecting");

      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectAttemptsRef.current += 1;
        connectRef.current?.();
      }, delay);
    };
  }, [
    cleanupPingTimer,
    cleanupReconnectTimer,
    cleanupSocket,
    handleContentUpdateMessage,
    handleCursorUpdateMessage,
    handleServerErrorMessage,
    handleSyncStateMessage,
    handleUserJoinedMessage,
    handleUserLeftMessage,
    noteId,
    setEditorConnectionStatus,
    setEditorError,
    startPresencePing,
    sendPresencePing,
    token,
  ]);

  useEffect(() => {
    connectRef.current = connect;
    return () => {
      connectRef.current = null;
    };
  }, [connect]);

  useEffect(() => {
    setActiveNote(noteId ?? null);

    if (!noteId) {
      disconnect();
      resetEditor();
      resetPresence();
      return;
    }

    shouldReconnectRef.current = true;
    connect();

    return () => {
      disconnect();
      resetPresence();
    };
  }, [connect, disconnect, noteId, resetEditor, resetPresence, setActiveNote]);

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    shouldReconnectRef.current = true;
    connect();
  }, [connect]);

  return useMemo(
    () => ({
      send,
      connectionStatus,
      lastError,
      reconnect,
      disconnect,
      setPreDisconnect,
    }),
    [connectionStatus, disconnect, lastError, reconnect, send, setPreDisconnect],
  );
}

export default useWebSocket;
