"use client";

import { NumberSelect } from "@/components/NumberSelect";

import type { RoomConfig } from "@/lib/types";

export function TimingFields({
  config,
  onChange,
}: {
  config: RoomConfig;
  onChange: (partial: Partial<RoomConfig>) => void;
}) {
  return (
    <>
      <label className="field">
        <span>表示の切り替わり</span>
        <select
          value={config.timingMode}
          onChange={(e) =>
            onChange({ timingMode: e.target.value === "random" ? "random" : "fixed" })
          }
        >
          <option value="fixed">固定秒数</option>
          <option value="random">下限〜上限でランダム</option>
        </select>
      </label>
      {config.timingMode === "random" ? (
        <div className="row">
          <label className="field">
            <span>下限 {config.randomMinSeconds}秒</span>
            <NumberSelect
              min={0.5}
              max={8}
              step={0.5}
              value={config.randomMinSeconds}
              onChange={(n) => onChange({ randomMinSeconds: n })}
            />
          </label>
          <label className="field">
            <span>上限 {config.randomMaxSeconds}秒</span>
            <NumberSelect
              min={0.5}
              max={8}
              step={0.5}
              value={config.randomMaxSeconds}
              onChange={(n) => onChange({ randomMaxSeconds: n })}
            />
          </label>
        </div>
      ) : (
        <label className="field">
          <span>
            秒数: {config.fixedSeconds === 0 ? "正解まで固定" : `${config.fixedSeconds}秒`}
          </span>
          <NumberSelect
            min={0}
            max={8}
            step={0.5}
            value={config.fixedSeconds}
            onChange={(n) => onChange({ fixedSeconds: n })}
          />
        </label>
      )}
      <p className="muted">
        {config.timingMode === "random"
          ? "正解する前に、下限と上限のあいだの秒数で盤面が入れ替わります。"
          : "0秒にすると、正解を押すまで数字は動きません。"}
      </p>
    </>
  );
}
