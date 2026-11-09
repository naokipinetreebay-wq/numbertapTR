"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  applyCorrectTap,
  connectedIds,
  dealBoard,
  emptyBoard,
  nextWaitMs,
  type BoardState,
} from "./localEngine";
import { SEQUENCE, type ClientMessage, type RoomConfig, type RoomSnapshot } from "./types";

export type NumberClientEvent = {
  type: "clientEvent";
  event: "tap";
  deviceId: string;
};

export function useNumberTapLocalHost(
  snapshot: RoomSnapshot | null,
  send: (msg: ClientMessage) => void
) {
  const boardRef = useRef<BoardState>(emptyBoard());
  const redealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idsRef = useRef<string[]>([]);
  const runningRef = useRef(false);
  const configRef = useRef<RoomConfig | null>(null);

  const clearRedeal = useCallback(() => {
    if (redealTimer.current) {
      clearTimeout(redealTimer.current);
      redealTimer.current = null;
    }
  }, []);

  const push = useCallback(
    (board: BoardState) => {
      boardRef.current = board;
      send({
        type: "hostPush",
        overlay: {
          step: board.step,
          digits: board.digits,
          targetId: board.targetId,
          boardId: board.boardId,
          startedAt: board.startedAt,
          finishedAt: board.finishedAt,
          lastElapsedMs: board.lastElapsedMs,
          hostNow: Date.now(),
        },
      });
    },
    [send]
  );

  const armRedeal = useCallback(() => {
    clearRedeal();
    if (!runningRef.current) return;
    const board = boardRef.current;
    if (board.step >= SEQUENCE.length || board.finishedAt != null) return;
    const cfg = configRef.current;
    if (!cfg) return;
    const wait = nextWaitMs(cfg);
    if (wait <= 0) return;
    redealTimer.current = setTimeout(() => {
      const dealt = dealBoard(idsRef.current, boardRef.current.step, boardRef.current.boardId);
      push({ ...boardRef.current, ...dealt });
      armRedeal();
    }, wait);
  }, [clearRedeal, push]);

  useEffect(() => () => clearRedeal(), [clearRedeal]);

  useEffect(() => {
    if (!snapshot) return;
    idsRef.current = connectedIds(snapshot);
    configRef.current = snapshot.config;
  }, [snapshot]);

  const startLocal = useCallback(() => {
    if (!snapshot) return;
    const ids = connectedIds(snapshot);
    if (ids.length === 0) return;
    idsRef.current = ids;
    configRef.current = snapshot.config;
    clearRedeal();
    runningRef.current = true;

    send({ type: "start", local: true });
    const dealt = dealBoard(ids, 0, 0);
    const board: BoardState = {
      ...emptyBoard(),
      ...dealt,
      startedAt: Date.now(),
    };
    push(board);
    armRedeal();
  }, [snapshot, send, clearRedeal, push, armRedeal]);

  const stopLocal = useCallback(() => {
    clearRedeal();
    runningRef.current = false;
    boardRef.current = emptyBoard();
    send({ type: "stop" });
  }, [clearRedeal, send]);

  const onClientEvent = useCallback(
    (ev: NumberClientEvent) => {
      if (ev.event !== "tap" || !runningRef.current) return;
      const board = boardRef.current;
      if (board.step >= SEQUENCE.length || board.finishedAt != null) return;
      if (board.digits[ev.deviceId] !== SEQUENCE[board.step]) return;

      if (snapshot) idsRef.current = connectedIds(snapshot);
      const next = applyCorrectTap(board, idsRef.current);
      push(next);
      if (next.finishedAt != null) {
        runningRef.current = false;
        clearRedeal();
        send({ type: "stop" });
        return;
      }
      armRedeal();
    },
    [snapshot, push, clearRedeal, send, armRedeal]
  );

  return { startLocal, stopLocal, onClientEvent };
}
