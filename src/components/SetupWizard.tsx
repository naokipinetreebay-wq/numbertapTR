"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useState } from "react";
import {
  ControllerRoleChoice,
  type ControllerRoleMode,
} from "@/components/ControllerRoleChoice";
import { SessionExit } from "@/components/SessionExit";
import { TimingFields } from "@/components/TimingFields";
import type { ClientMessage, RoomSnapshot } from "@/lib/types";
import { timingLabel } from "@/lib/types";

const STEPS = ["説明", "役割", "端末", "表示", "確認"] as const;

export function SetupWizard({
  snapshot,
  connected,
  send,
  roleMode,
  onRoleModeChange,
  onDone,
}: {
  snapshot: RoomSnapshot;
  connected: boolean;
  send: (msg: ClientMessage) => void;
  roleMode: ControllerRoleMode | null;
  onRoleModeChange: (mode: ControllerRoleMode) => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const cfg = snapshot.config;
  const displayUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/d/${snapshot.code}`;
  }, [snapshot.code]);

  const joined = snapshot.displays.length;
  const canLeaveRole = roleMode !== null;
  const canLeaveDevices = joined >= 1;

  useEffect(() => {
    if (snapshot.displays.length > 0) setStep((s) => s);
  }, [snapshot.displays.length]);

  return (
    <div className="wizard">
      <header className="wizard-top">
        <div>
          <p className="eyebrow">NumberTap · セットアップ</p>
          <h1>ルーム {snapshot.code}</h1>
        </div>
        <div className="wizard-top-actions">
          <SessionExit compact />
          <div className={`pill ${connected ? "ok" : "bad"}`}>
            {connected ? "接続中" : "再接続中…"}
          </div>
        </div>
      </header>

      <ol className="wizard-steps" aria-label="手順">
        {STEPS.map((label, i) => (
          <li key={label} className={i === step ? "active" : i < step ? "done" : ""}>
            <span className="n">{i + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      <section className="panel wizard-panel">
        {step === 0 ? (
          <div className="wizard-body">
            <h2>順番タップ</h2>
            <ul className="explain-list">
              <li>
                押す順番は <strong>1→2→3→4→5→6→7→8→9→0</strong>。0は10です。
              </li>
              <li>押すべき数字は、どれか1台だけに出ます。ほかはそれ以外の数字です。</li>
              <li>画面下の並びで、押した番号は緑、次に押す番号は白です。大きい数字が白い番号と同じ端末を押します。</li>
              <li>間違えても最初には戻りません。正しい数字を押すと次へ進みます。</li>
              <li>1が出てから0を押すまでの時間を計ります。</li>
            </ul>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="wizard-body">
            <h2>この端末の役割</h2>
            <ControllerRoleChoice value={roleMode} onChange={onRoleModeChange} />
          </div>
        ) : null}

        {step === 2 ? (
          <div className="wizard-body">
            <h2>端末を参加させる</h2>
            <p className="join-meter">参加 {joined} 台</p>
            <p className="muted">2台以上あると、偽物の数字が出ます。</p>
            <div className="qr-wrap">
              {displayUrl ? <QRCodeSVG value={displayUrl} size={180} /> : null}
            </div>
            <p className="mono url">{displayUrl}</p>
            {joined > 0 ? (
              <ul className="device-list">
                {snapshot.displays.map((d) => (
                  <li key={d.id}>
                    <input
                      className="label-input"
                      value={d.label}
                      onChange={(e) =>
                        send({ type: "setLabel", deviceId: d.id, label: e.target.value })
                      }
                    />
                    <span className={`dot ${d.connected ? "ok" : "bad"}`} />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="wizard-body">
            <h2>表示</h2>
            <TimingFields
              config={cfg}
              onChange={(partial) => send({ type: "updateConfig", config: partial })}
            />
          </div>
        ) : null}

        {step === 4 ? (
          <div className="wizard-body">
            <h2>準備完了</h2>
            <ul className="summary-list">
              <li>
                役割: {roleMode === "alsoDisplay" ? "この端末もタップ対象" : "操作専用"}
              </li>
              <li>端末 {joined} 台</li>
              <li>表示: {timingLabel(cfg)}</li>
            </ul>
            <p className="muted">「はじめる」で1が表示され、計測が始まります。</p>
          </div>
        ) : null}
      </section>

      <footer className="wizard-nav">
        <button
          type="button"
          className="btn"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          戻る
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            className="btn primary"
            disabled={(step === 1 && !canLeaveRole) || (step === 2 && !canLeaveDevices)}
            onClick={() => setStep((s) => s + 1)}
          >
            {step === 1 && !canLeaveRole
              ? "役割を選ぶ"
              : step === 2 && !canLeaveDevices
                ? "端末を1台以上登録"
                : "次へ"}
          </button>
        ) : (
          <button type="button" className="btn primary" onClick={onDone}>
            はじめる
          </button>
        )}
      </footer>
      <SessionExit onStop={() => send({ type: "stop" })} />
    </div>
  );
}
