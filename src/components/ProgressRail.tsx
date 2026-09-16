/* =========================================================================
   18. PROGRESS RAIL — act counter + sequence progress.

   Ported from the pre-Next prototype (cacti-scroll-site), where it tracked
   page scroll. Here there is no page scroll: it tracks the PLAYHEAD, so the
   fill moves continuously through a transition and rests between them.

   Driven imperatively, NOT through React state. The frame number changes
   every frame, and StepStage throttles its status stream precisely so that
   React does not reconcile at 60fps (see the comment there). The rail
   therefore writes one CSS variable and one text node per tick instead.
   ========================================================================= */

import { useImperativeHandle, useRef, type Ref } from "react";
import { CONFIG, LAST_FRAME, LAST_STATE } from "@/lib/sequence/config";
import { clamp01 } from "@/lib/sequence/easing";

export interface RailHandle {
  /** Called on every controller tick — must stay cheap. */
  update(frame: number): void;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** The resting state nearest a frame.

    Deliberately nearest rather than "the state we left": it flips at the
    midpoint of a transition, so the counter changes when the picture has
    visibly become the next shot rather than the instant it starts moving.
    Works travelling backward for the same reason. */
function nearestState(frame: number) {
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < CONFIG.stateFrames.length; i++) {
    const d = Math.abs(CONFIG.stateFrames[i] - frame);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  }
  return best;
}

export default function ProgressRail({
  visible,
  ref,
}: {
  visible: boolean;
  ref?: Ref<RailHandle>;
}) {
  const fillRef = useRef<HTMLDivElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  /* last act written to the DOM, so an unchanged counter costs nothing */
  const shownAct = useRef(-1);

  useImperativeHandle(ref, () => ({
    update(frame: number) {
      const fill = fillRef.current;
      if (fill) {
        const p = LAST_FRAME > 0 ? clamp01(frame / LAST_FRAME) : 0;
        fill.style.setProperty("--p", p.toFixed(5));
      }
      const act = nearestState(frame);
      if (act !== shownAct.current && numRef.current) {
        numRef.current.textContent = pad2(act + 1);
        shownAct.current = act;
      }
    },
  }), []);

  return (
    <div className={`rail${visible ? "" : " railHidden"}`} aria-hidden="true">
      <span className="railNum" ref={numRef}>
        {pad2(1)}
      </span>
      <div className="railTrack">
        <span className="railSpark" />
        <div className="railFill" ref={fillRef} />
      </div>
      <span className="railNum railNumTotal">{pad2(LAST_STATE + 1)}</span>
    </div>
  );
}
