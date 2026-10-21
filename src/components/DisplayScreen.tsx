"use client";

import { useEffect, useRef, useState } from "react";
import type { ClientMessage, RoomSnapshot } from "@/lib/types";
import { SEQUENCE } from "@/lib/types";

export function DisplayScreen({
  snapshot,
  deviceId,
  send,
}: {
  snapshot: RoomSnapshot;
  deviceId: string;
  send: (msg: ClientMessage) => void;
}) {
  const digit = snapshot.digits[deviceId];
  const done = snapshot.step >= SEQUENCE.length;
  const [flash, setFlash] = useState(false);
  const lock = useRef(0);

  useEffect(() => {
    let wake: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        if ("wakeLock" in navigator) wake = await navigator.wakeLock.request("screen");
      } catch {
        /* ignore */
      }
    };
    request();
    const onVis = () => {
      if (document.visibilityState === "visible") request();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      wake?.release().catch(() => undefined);
    };
  }, []);

  const onTap = () => {
    if (done || digit == null) return;
    const now = Date.now();
    if (now - lock.current < 280) return;
    lock.current = now;
    setFlash(true);
    window.setTimeout(() => setFlash(false), 140);
    send({ type: "tap", deviceId });
  };

  const seconds =
    snapshot.lastElapsedMs != null ? (snapshot.lastElapsedMs / 1000).toFixed(2) : null;
  const next = snapshot.target;
  const pressed =
    snapshot.step <= 0 ? "まだ押していません" : `${SEQUENCE[snapshot.step - 1]}まで押した`;
  const waiting = !snapshot.config.running && snapshot.startedAt == null && !done;
  const paused = !snapshot.config.running && !done && !waiting;

  return (
    <button
      type="button"
      className={`tap-root${flash ? " flash" : ""}`}
      onPointerDown={onTap}
    >
      <span className="tap-cue">
        {done ? (
          <span className="tap-cue-status">完了</span>
        ) : (
          <>
            <span className="tap-cue-status">
              {waiting ? "開始待ち" : paused ? `一時停止 · ${pressed}` : pressed}
            </span>
            <span className="tap-cue-label">次に押す</span>
            <span className="tap-cue-num">{next ?? SEQUENCE[0]}</span>
          </>
        )}
      </span>
      {done ? (
        <span className="tap-done">
          <span className="tap-digit">{seconds ?? "0"}</span>
          <span className="tap-unit">秒</span>
        </span>
      ) : (
        <span className="tap-digit">{digit ?? "–"}</span>
      )}
      <ol className="tap-seq" aria-label="進捗">
        {SEQUENCE.map((n, i) => (
          <li
            key={n}
            className={snapshot.step > i ? "done" : snapshot.step === i && !done ? "now" : ""}
          >
            {n}
          </li>
        ))}
      </ol>
    </button>
  );
}
