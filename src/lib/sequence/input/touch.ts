/* =========================================================================
   9. TOUCH INPUT — one deliberate swipe = one state.

   A fired-once flag per touch sequence is what stops a long flick with
   momentum from walking through several states.
   Swiping the finger UP = moving down the sequence = next state.
   ========================================================================= */

import { CONFIG } from "../config";

export function attachTouch(
  target: HTMLElement,
  onGesture: (dir: number) => void,
): () => void {
  const { swipeThreshold } = CONFIG.input;
  let startY = 0;
  let fired = false;
  let tracking = false;

  const onStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    startY = e.touches[0].clientY;
    fired = false;
    tracking = true;
  };

  const onMove = (e: TouchEvent) => {
    if (!tracking || fired) return;
    e.preventDefault(); // keep the page still
    const dy = e.touches[0].clientY - startY;
    if (Math.abs(dy) < swipeThreshold) return;
    fired = true; // one swipe, one state — ignore the rest of this gesture
    onGesture(dy < 0 ? 1 : -1); // finger up -> next
  };

  const onEnd = () => {
    tracking = false;
    fired = false;
  };

  target.addEventListener("touchstart", onStart, { passive: true });
  target.addEventListener("touchmove", onMove, { passive: false });
  target.addEventListener("touchend", onEnd, { passive: true });
  target.addEventListener("touchcancel", onEnd, { passive: true });

  return () => {
    target.removeEventListener("touchstart", onStart);
    target.removeEventListener("touchmove", onMove);
    target.removeEventListener("touchend", onEnd);
    target.removeEventListener("touchcancel", onEnd);
  };
}
