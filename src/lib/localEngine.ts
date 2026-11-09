import { SEQUENCE, type RoomConfig, type RoomSnapshot } from "./types";

const POOL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export type BoardState = {
  step: number;
  digits: Record<string, number>;
  targetId: string | null;
  boardId: number;
  startedAt: number | null;
  finishedAt: number | null;
  lastElapsedMs: number | null;
};

export type HostOverlay = BoardState & { hostNow?: number };

function pickRandom<T>(list: T[]): T {
  return list[Math.min(list.length - 1, Math.floor(Math.random() * list.length))];
}

export function nextWaitMs(config: RoomConfig): number {
  if (config.timingMode === "random") {
    const min = Math.min(config.randomMinSeconds, config.randomMaxSeconds);
    const max = Math.max(config.randomMinSeconds, config.randomMaxSeconds);
    return (min + Math.random() * (max - min)) * 1000;
  }
  if (config.fixedSeconds <= 0) return 0;
  return config.fixedSeconds * 1000;
}

export function connectedIds(snapshot: RoomSnapshot): string[] {
  return snapshot.displays.filter((d) => d.connected).map((d) => d.id);
}

export function dealBoard(
  ids: string[],
  step: number,
  boardId: number
): Pick<BoardState, "digits" | "targetId" | "boardId" | "step"> {
  if (ids.length === 0 || step >= SEQUENCE.length) {
    return { digits: {}, targetId: null, boardId, step };
  }
  const targetDigit = SEQUENCE[step];
  const targetId = pickRandom(ids);
  const decoys = POOL.filter((n) => n !== targetDigit);
  const digits: Record<string, number> = {};
  for (const id of ids) {
    digits[id] = id === targetId ? targetDigit : pickRandom(decoys);
  }
  return { digits, targetId, boardId: boardId + 1, step };
}

export function emptyBoard(): BoardState {
  return {
    step: 0,
    digits: {},
    targetId: null,
    boardId: 0,
    startedAt: null,
    finishedAt: null,
    lastElapsedMs: null,
  };
}

export function applyCorrectTap(
  board: BoardState,
  ids: string[],
  now = Date.now()
): BoardState {
  if (board.step >= SEQUENCE.length) return board;
  if (board.step === SEQUENCE.length - 1) {
    return {
      ...board,
      step: SEQUENCE.length,
      finishedAt: now,
      lastElapsedMs: now - (board.startedAt ?? now),
      targetId: null,
      digits: { ...board.digits },
    };
  }
  const nextStep = board.step + 1;
  const dealt = dealBoard(ids, nextStep, board.boardId);
  return {
    ...board,
    ...dealt,
  };
}
