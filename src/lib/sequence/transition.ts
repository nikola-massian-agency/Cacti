/* =========================================================================
   6. TRANSITION ANIMATION — time-based, not refresh-rate-based.

   The displayed frame is derived from ELAPSED TIME, so a 2.5s transition
   takes 2.5s on a 60Hz and a 144Hz screen alike. Only the number of
   distinct frames shown differs.
   ========================================================================= */

import { EASINGS, clamp01, type Easing } from "./easing";
import { CONFIG } from "./config";

export class Transition {
  readonly from: number;
  readonly to: number;
  /** 20. not readonly: a run that gains a backlog mid-flight shortens the leg
      it is already playing, through rescale() below */
  duration: number;
  readonly dir: number;
  private ease: Easing;
  private startedAt = 0;

  constructor(from: number, to: number, duration: number, easingName = CONFIG.easing) {
    this.from = from;
    this.to = to;
    this.duration = Math.max(1, duration);
    this.dir = to >= from ? 1 : -1;
    this.ease = EASINGS[easingName] ?? EASINGS.cinematic;
  }

  start(now: number) {
    this.startedAt = now;
  }

  /** Nearest source frame for this instant. */
  frameAt(now: number): number {
    const t = clamp01((now - this.startedAt) / this.duration);
    const eased = this.ease(t);
    return Math.round(this.from + (this.to - this.from) * eased);
  }

  isDone(now: number): boolean {
    return now - this.startedAt >= this.duration;
  }

  progress(now: number): number {
    return clamp01((now - this.startedAt) / this.duration);
  }

  /** 20. Change how long is left to run, without moving the picture.

      Progress at `now` is preserved exactly and only the remaining time
      changes, so a leg that speeds up because more gestures arrived carries
      on from the frame it is showing instead of snapping to another one. */
  rescale(now: number, duration: number) {
    const t = this.progress(now);
    this.duration = Math.max(1, duration);
    this.startedAt = now - t * this.duration;
  }
}
