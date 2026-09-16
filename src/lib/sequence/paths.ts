/* =========================================================================
   2. ASSET / FRAME PATH GENERATION + chunk maths.

   Chunks are derived from the state list, so they always line up with what
   a transition actually needs. Transition i needs EVERY frame between
   stateFrames[i] and stateFrames[i+1] inclusive.
   ========================================================================= */

import { CONFIG } from "./config";

const { dir, prefix, pad, ext, firstFrame } = CONFIG.sequence;

export function frameUrl(logical: number): string {
  /* encode the FILENAME only — the directory keeps its slashes. The source
     folder names frames "MAIN widerNoUI_00000.webp"; they were copied in
     with the space replaced by an underscore, and this is the safety net. */
  const name = `${prefix}${String(firstFrame + logical).padStart(pad, "0")}.${ext}`;
  return dir + encodeURIComponent(name);
}

export interface Chunk {
  index: number;
  /** inclusive logical frame range this transition plays through */
  start: number;
  end: number;
}

/** One chunk per transition: [state i .. state i+1], inclusive both ends. */
export const CHUNKS: Chunk[] = CONFIG.stateFrames.slice(0, -1).map((f, i) => ({
  index: i,
  start: Math.min(f, CONFIG.stateFrames[i + 1]),
  end: Math.max(f, CONFIG.stateFrames[i + 1]),
}));

/** The transition between two adjacent states, whichever direction. */
export function chunkBetween(a: number, b: number): Chunk {
  return CHUNKS[Math.min(a, b)];
}

/** Chunk indices ordered by how soon the user could need them. */
export function chunkPriority(stateIndex: number, lookahead: number): number[] {
  const order: number[] = [];
  const push = (i: number) => {
    if (i >= 0 && i < CHUNKS.length && !order.includes(i)) order.push(i);
  };
  push(stateIndex); // the next forward transition
  push(stateIndex - 1); // the one behind, for reverse navigation
  for (let k = 1; k <= lookahead; k++) {
    push(stateIndex + k);
    push(stateIndex - 1 - k);
  }
  /* everything else, nearest first — opportunistic only */
  for (let r = 1; r < CHUNKS.length; r++) {
    push(stateIndex + lookahead + r);
    push(stateIndex - lookahead - r);
  }
  return order;
}
