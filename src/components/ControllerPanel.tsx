"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useState } from "react";
import { SessionExit } from "@/components/SessionExit";
import { TimingFields } from "@/components/TimingFields";
import type { ClientMessage, RoomSnapshot } from "@/lib/types";
import { SEQUENCE } from "@/lib/types";

function formatSeconds(ms: number): string {
  return (ms / 1000).toFixed(2);
}

export function ControllerPanel({
  snapshot,
  connected,
  send,
  clearSessionKeys,
}: {
  snapshot: RoomSnapshot;
  connected: boolean;
  send: (msg: ClientMessage) => void;
  clearSessionKeys?: string[];
}) {
  const cfg = snapshot.config;
  const displayUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/d/${snapshot.code}`;
  }, [snapshot.code]);

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 100);
    return () => clearInterval(id);
  }, []);

  const skew = snapshot.serverNow - Date.now();
  const liveMs =
    cfg.running && snapshot.startedAt != null
      ? Math.max(0, Date.now() + skew - snapshot.startedAt)
      : snapshot.lastElapsedMs;

  return (
    <div className="controller">
      <header className="controller-header">
        <div>
          <p className="eyebrow">NumberTap</p>
          <h1>ルーム {snapshot.code}</h1>
        </div>
        <div className={`pill ${connected ? "ok" : "bad"}`}>
          {connected ? "接続中" : "再接続中…"}
        </div>
      </header>

      <section className="panel">
        <h2>タイム</h2>
        <p className="time-read">{liveMs != null ? formatSeconds(liveMs) : "–"}</p>
        <p className="muted">
          {snapshot.step >= SEQUENCE.length
            ? "0まで達成"
            : cfg.running
              ? `いま押す数字: ${snapshot.target}`
              : "開始前"}
        </p>
        <ol className="seq">
          {SEQUENCE.map((n, i) => (
            <li
              key={n}
              className={
                snapshot.step > i ? "done" : snapshot.step === i && cfg.running ? "now" : ""
              }
            >
              {n}
            </li>
          ))}
        </ol>
      </section>

      <section className="grid-2">
        <div className="panel">
          <h2>タップ端末</h2>
          <p className="muted">台数: {snapshot.displays.length}</p>
          <div className="qr-wrap">
            {displayUrl ? <QRCodeSVG value={displayUrl} size={160} /> : null}
          </div>
          <p className="mono url">{displayUrl}</p>
          <button
            type="button"
            className="btn ghost"
            onClick={() => navigator.clipboard.writeText(displayUrl)}
          >
            URLをコピー
          </button>
        </div>
        <div className="panel">
          <h2>操作</h2>
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={() => send({ type: "start" })}>
              {snapshot.step >= SEQUENCE.length ? "もう一度" : "開始"}
            </button>
            <button type="button" className="btn danger" onClick={() => send({ type: "stop" })}>
              一時停止
            </button>
          </div>
          <TimingFields
            config={cfg}
            onChange={(partial) => send({ type: "updateConfig", config: partial })}
          />
        </div>
      </section>

      <section className="panel">
        <h2>参加端末</h2>
        {snapshot.displays.length === 0 ? (
          <p className="muted">まだ端末がありません。QRを読み取ってください。</p>
        ) : (
          <ul className="device-list">
            {snapshot.displays.map((d) => (
              <li key={d.id}>
                <span className="digit-badge">{d.digit ?? "–"}</span>
                <input
                  className="label-input"
                  value={d.label}
                  onChange={(e) =>
                    send({ type: "setLabel", deviceId: d.id, label: e.target.value })
                  }
                  placeholder="名前"
                />
                <span className={`dot ${d.connected ? "ok" : "bad"}`} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <SessionExit onStop={() => send({ type: "stop" })} clearSessionKeys={clearSessionKeys} />
    </div>
  );
}
