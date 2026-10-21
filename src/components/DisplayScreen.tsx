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

  return (
    <button
      type="button"
      className={`tap-root${flash ? " flash" : ""}`}
      onPointerDown={onTap}
    >
      {done ? (
        <span className="tap-done">
          <span className="tap-digit">{seconds ?? "0"}</span>
          <span className="tap-unit">秒</span>
        </span>
      ) : (
        <span className="tap-digit">{digit ?? "–"}</span>
      )}
    </button>
  );
}
