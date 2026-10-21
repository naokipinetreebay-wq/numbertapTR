import { WebSocket } from "ws";
import {
  DEFAULT_CONFIG,
  RoomConfig,
  RoomSnapshot,
  SEQUENCE,
  TapDigit,
} from "../lib/types";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_TTL_MS = 90 * 60 * 1000;
const MAX_DISPLAYS = 12;
const POOL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function randomCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return out;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export type ClientSocket = WebSocket & {
  role?: "controller" | "display";
  deviceId?: string;
  roomCode?: string;
};

interface DisplayClient {
  id: string;
  label: string;
  socket: ClientSocket | null;
}

export class Room {
  code: string;
  config: RoomConfig = { ...DEFAULT_CONFIG };
  displays = new Map<string, DisplayClient>();
  controllers = new Set<ClientSocket>();
  step = 0;
  digits: Record<string, number> = {};
  targetId: string | null = null;
  boardId = 0;
  startedAt: number | null = null;
  finishedAt: number | null = null;
  lastElapsedMs: number | null = null;
  lastActivity = Date.now();
  private timer: NodeJS.Timeout | null = null;

  constructor(code: string) {
    this.code = code;
  }

  touch() {
    this.lastActivity = Date.now();
  }

  isExpired(now = Date.now()) {
    if (this.config.running) return false;
    if (this.controllers.size > 0) return false;
    if ([...this.displays.values()].some((d) => d.socket)) return false;
    return now - this.lastActivity > ROOM_TTL_MS;
  }

  addController(socket: ClientSocket) {
    this.controllers.add(socket);
    this.touch();
    this.sendSnapshot(socket);
  }

  removeController(socket: ClientSocket) {
    this.controllers.delete(socket);
  }

  addDisplay(socket: ClientSocket, deviceId: string, label?: string) {
    this.touch();
    const existing = this.displays.get(deviceId);
    if (existing) {
      existing.socket = socket;
      if (label) existing.label = label;
      this.broadcast();
      return { ok: true as const };
    }
    if (this.displays.size >= MAX_DISPLAYS) {
      return { ok: false as const, error: "Display上限（12台）に達しています" };
    }
    this.displays.set(deviceId, {
      id: deviceId,
      label: label || `T${this.displays.size + 1}`,
      socket,
    });
    if (this.config.running && this.step < SEQUENCE.length) {
      this.deal();
    }
    this.broadcast();
    return { ok: true as const };
  }

  removeDisplaySocket(socket: ClientSocket) {
    for (const d of this.displays.values()) {
      if (d.socket === socket) {
        d.socket = null;
        break;
      }
    }
    this.broadcast();
  }

  setLabel(deviceId: string, label: string) {
    const d = this.displays.get(deviceId);
    if (d) {
      d.label = label.slice(0, 24);
      this.touch();
      this.broadcast();
    }
  }

  updateConfig(partial: Partial<RoomConfig>) {
    this.config = { ...this.config, ...partial, running: this.config.running };
    this.config.displaySeconds = clamp(this.config.displaySeconds, 0, 15);
    this.touch();
    if (this.config.running) this.arm();
    this.broadcast();
  }

  start() {
    if (this.displays.size === 0) {
      this.broadcast();
      return;
    }
    this.step = 0;
    this.config.running = true;
    this.finishedAt = null;
    this.lastElapsedMs = null;
    this.deal();
    this.startedAt = Date.now();
    this.touch();
    this.arm();
    this.broadcast();
  }

  stop() {
    this.config.running = false;
    this.clearTimer();
    this.touch();
    this.broadcast();
  }

  tap(deviceId: string) {
    if (!this.config.running || this.step >= SEQUENCE.length) return;
    const target = SEQUENCE[this.step];
    if (this.digits[deviceId] !== target) return;

    if (this.step === SEQUENCE.length - 1) {
      this.finishedAt = Date.now();
      this.lastElapsedMs = this.finishedAt - (this.startedAt ?? this.finishedAt);
      this.step = SEQUENCE.length;
      this.config.running = false;
      this.clearTimer();
      this.touch();
      this.broadcast();
      return;
    }

    this.step += 1;
    this.deal();
    this.touch();
    this.arm();
    this.broadcast();
  }

  private clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private arm() {
    this.clearTimer();
    if (!this.config.running || this.config.displaySeconds <= 0) return;
    const wait = this.config.displaySeconds * 1000;
    this.timer = setTimeout(() => {
      if (!this.config.running || this.step >= SEQUENCE.length) return;
      this.deal();
      this.broadcast();
      this.arm();
    }, wait);
  }

  private deal() {
    const ids = [...this.displays.keys()];
    if (ids.length === 0 || this.step >= SEQUENCE.length) {
      this.targetId = null;
      return;
    }
    const targetDigit: TapDigit = SEQUENCE[this.step];
    const targetId = ids[Math.floor(Math.random() * ids.length)];
    const decoys = POOL.filter((n) => n !== targetDigit);
    const digits: Record<string, number> = {};
    for (const id of ids) {
      digits[id] =
        id === targetId
          ? targetDigit
          : decoys[Math.floor(Math.random() * decoys.length)];
    }
    this.digits = digits;
    this.targetId = targetId;
    this.boardId += 1;
  }

  snapshot(): RoomSnapshot {
    const displays = [...this.displays.values()].map((d) => ({
      id: d.id,
      label: d.label,
      digit: this.digits[d.id] ?? null,
      connected: !!d.socket && d.socket.readyState === WebSocket.OPEN,
    }));
    return {
      code: this.code,
      config: this.config,
      displays,
      step: this.step,
      target: this.step < SEQUENCE.length ? SEQUENCE[this.step] : null,
      digits: { ...this.digits },
      boardId: this.boardId,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      lastElapsedMs: this.lastElapsedMs,
      serverNow: Date.now(),
    };
  }

  sendSnapshot(socket: ClientSocket) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "snapshot", snapshot: this.snapshot() }));
    }
  }

  broadcast() {
    const payload = JSON.stringify({ type: "snapshot", snapshot: this.snapshot() });
    for (const c of this.controllers) {
      if (c.readyState === WebSocket.OPEN) c.send(payload);
    }
    for (const d of this.displays.values()) {
      if (d.socket && d.socket.readyState === WebSocket.OPEN) d.socket.send(payload);
    }
  }

  destroy() {
    this.clearTimer();
  }
}

export class RoomManager {
  rooms = new Map<string, Room>();

  createRoom(): Room {
    let code = randomCode();
    while (this.rooms.has(code)) code = randomCode();
    const room = new Room(code);
    this.rooms.set(code, room);
    return room;
  }

  get(code: string): Room | undefined {
    const room = this.rooms.get(code.toUpperCase());
    if (room?.isExpired()) {
      room.destroy();
      this.rooms.delete(room.code);
      return undefined;
    }
    return room;
  }

  sweep() {
    for (const [code, room] of this.rooms) {
      if (room.isExpired()) {
        room.destroy();
        this.rooms.delete(code);
      }
    }
  }
}
