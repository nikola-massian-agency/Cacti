/* =========================================================================
   7. EASING — one registry, one place to adjust.
   ========================================================================= */

export type Easing = (t: number) => number;

const easeInOutCubic: Easing = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const EASINGS: Record<string, Easing> = {
  linear: (t) => t,
  easeInOutCubic,
  /* easeInOutCubic blended 65/35 with linear. Pure cubic spends so long
     crawling at each end that the sequence visibly hangs on a frame; the
     linear component keeps it moving while preserving the settle. */
  cinematic: (t) => easeInOutCubic(t) * 0.65 + t * 0.35,
};

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
