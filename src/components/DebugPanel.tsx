/* 17. DEBUG OVERLAY — toggled with the D key. */

import type { Status } from "@/lib/sequence/controller";

export default function DebugPanel({ status }: { status: Status }) {
  const rows: Array<[string, string]> = [
    ["State", `${status.state} / ${status.lastState}`],
    ["Run", status.desired === status.state ? "at rest" : `${status.state} → ${status.desired}`],
    ["Frame", String(status.frame)],
    ["Target", String(status.targetFrame)],
    ["Animation", status.phase.toUpperCase()],
    ["Chunk", status.phase === "waiting" ? "LOADING" : "READY"],
    ["Loaded", `${status.loaded} / ${status.total}`],
    ["Decoded", `${status.decoded} bitmaps`],
    ["Failed", status.failed.length ? status.failed.slice(0, 6).join(", ") : "none"],
  ];

  return (
    <div className="debug">
      {rows.map(([k, v]) => (
        <div className="debugRow" key={k}>
          <span className="debugKey">{k}</span>
          <span className="debugVal">{v}</span>
        </div>
      ))}
      <div className="debugHint">D to hide · ↑↓ / space to navigate</div>
    </div>
  );
}
