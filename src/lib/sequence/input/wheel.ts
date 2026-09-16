/* =========================================================================
   8. WHEEL INPUT — trackpad-momentum-proof.

   The problem: one physical trackpad flick emits dozens of wheel events,
   plus a long momentum tail. A naive `addEventListener("wheel", next)` turns
   that single gesture into 0 -> 200 -> 350 -> 575.

   The fix is a re-arm rule rather than a timer on the transition: after one
   gesture fires, the input DISARMS, and only re-arms after a continuous
   stretch of wheel SILENCE. Momentum events keep resetting that silence
   timer, so a decaying tail can never re-arm the input — the user has to
   physically stop and start a new gesture.

   20. That rule on its own also swallows someone who simply KEEPS SCROLLING:
   their events never stop, so the silence never arrives, and exactly one
   gesture fires however long they spin the wheel. So a disarmed input keeps
   watching for REPEATS, and separates the two cases by the one thing that
   distinguishes them — momentum DECAYS, monotonically, from the moment the
   finger lifts, and a hand does not. A delta no smaller than the one before
   it counts toward a repeat; a shrinking one does not. And nothing counts at
   all for repeatMinGapMs after a fire, which is exactly the window where a
   tail is still near full strength and hardest to tell from a push.
   ========================================================================= */

import { CONFIG } from "../config";

export function attachWheel(
  target: HTMLElement | Window,
  onGesture: (dir: number) => void,
): () => void {
  const { wheelThreshold, gestureGapMs, repeatThreshold, repeatMinGapMs, decayTolerance } =
    CONFIG.input;
  let acc = 0;
  let armed = true;
  let silence: ReturnType<typeof setTimeout> | null = null;
  /** magnitude of the previous event, to spot a decaying tail */
  let lastMag = 0;
  /** non-decaying delta piled up since the last fire */
  let repeatAcc = 0;
  let firedAt = 0;

  /** deltaMode: 0 = pixels, 1 = lines, 2 = pages */
  const normalise = (e: WheelEvent) =>
    e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;

  const fire = (dir: number, now: number) => {
    acc = 0;
    repeatAcc = 0;
    armed = false; // stays disarmed until real silence, or a clear repeat
    firedAt = now;
    onGesture(dir);
  };

  const onWheel = (ev: Event) => {
    const e = ev as WheelEvent;
    /* 13. scroll is an INPUT DEVICE here; the page must not move */
    e.preventDefault();

    const now = performance.now();
    const delta = normalise(e);
    const mag = Math.abs(delta);

    if (silence) clearTimeout(silence);
    silence = setTimeout(() => {
      armed = true;
      acc = 0;
      repeatAcc = 0;
      lastMag = 0;
    }, gestureGapMs);

    if (!armed) {
      /* 20. still pushing, or just coasting? */
      const decaying = mag < lastMag * decayTolerance;
      lastMag = mag;
      acc = 0; // never let the tail feed the first-fire accumulator
      if (decaying || now - firedAt < repeatMinGapMs) return;
      repeatAcc += mag;
      if (repeatAcc >= repeatThreshold) fire(delta > 0 ? 1 : -1, now);
      return;
    }

    lastMag = mag;
    acc += delta;
    if (Math.abs(acc) < wheelThreshold) return;
    fire(acc > 0 ? 1 : -1, now);
  };

  target.addEventListener("wheel", onWheel, { passive: false });
  return () => {
    target.removeEventListener("wheel", onWheel);
    if (silence) clearTimeout(silence);
  };
}
