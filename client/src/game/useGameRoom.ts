import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicRoomState } from "@shared/game";
import {
  getSocket,
  onRoomUpdated,
  emitJoinRoom,
  emitLeaveRoom,
  emitStartGame,
  emitSubmitAnswer,
  emitSubmitVote,
} from "./socketClient";

export interface GameRoomSession {
  roomId: number;
  roomCode: string;
  playerId: number;
  nickname: string;
}

export function useGameRoom(session: GameRoomSession | null) {
  const [roomState, setRoomState] = useState<PublicRoomState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const joinedRef = useRef(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    setIsConnected(socket.connected);

    if (!socket.connected) socket.connect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  useEffect(() => {
    const unsub = onRoomUpdated((state) => {
      setRoomState(state);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!session) return;

    let cancelled = false;

    const join = async () => {
      setJoinError(null);
      const ok = await emitJoinRoom({
        roomId: session.roomId,
        roomCode: session.roomCode,
        playerId: session.playerId,
        nickname: session.nickname,
      });
      if (cancelled) return;
      if (!ok) setJoinError("실시간 방 연결에 실패했습니다.");
      joinedRef.current = ok;
    };

    join();

    return () => {
      cancelled = true;
      if (joinedRef.current && sessionRef.current) {
        emitLeaveRoom(sessionRef.current.roomId, sessionRef.current.playerId);
        joinedRef.current = false;
      }
    };
  }, [session?.roomId, session?.playerId, session?.roomCode, session?.nickname]);

  const startGame = useCallback(() => {
    if (!session) return;
    emitStartGame(session.roomId, session.playerId);
  }, [session]);

  const submitAnswer = useCallback(
    (content: string) => {
      if (!session) return;
      emitSubmitAnswer(session.roomId, session.playerId, content);
    },
    [session],
  );

  const submitVote = useCallback(
    (submissionId: string) => {
      if (!session) return;
      emitSubmitVote(session.roomId, session.playerId, submissionId);
    },
    [session],
  );

  const isHost = session != null && roomState?.hostPlayerId === session.playerId;

  return {
    roomState,
    isConnected,
    joinError,
    isHost,
    startGame,
    submitAnswer,
    submitVote,
  };
}
