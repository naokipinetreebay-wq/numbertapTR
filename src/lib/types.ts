export type Role = "controller" | "display";

/** 1 → 9 → 0。0 は 10。 */
export const SEQUENCE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0] as const;
export type TapDigit = (typeof SEQUENCE)[number];

export interface RoomConfig {
  /** 0 = 正解するまで盤面を固定。それ以外は秒ごとにランダム再配置 */
  displaySeconds: number;
  running: boolean;
}

export interface DisplayInfo {
  id: string;
  label: string;
  digit: number | null;
  connected: boolean;
}

export interface RoomSnapshot {
  code: string;
  config: RoomConfig;
  displays: DisplayInfo[];
  /** Index into SEQUENCE. 10 means the run is complete. */
  step: number;
  target: TapDigit | null;
  digits: Record<string, number>;
  /** Bumps every time the board is redealt */
  boardId: number;
  startedAt: number | null;
  finishedAt: number | null;
  lastElapsedMs: number | null;
  serverNow: number;
}

export type ClientMessage =
  | { type: "hello"; role: Role; deviceId: string; label?: string }
  | { type: "updateConfig"; config: Partial<RoomConfig> }
  | { type: "setLabel"; deviceId: string; label: string }
  | { type: "start" }
  | { type: "stop" }
  | { type: "tap"; deviceId: string }
  | { type: "ping" };

export type ServerMessage =
  | { type: "snapshot"; snapshot: RoomSnapshot }
  | { type: "error"; message: string }
  | { type: "pong" };

export const DEFAULT_CONFIG: RoomConfig = {
  displaySeconds: 3,
  running: false,
};
