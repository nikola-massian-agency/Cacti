/* =========================================================================
   3 + 4 + 10. IMAGE LOADING / CACHING / CHUNK PRELOADING / MEMORY

   Two storage layers, and the split is the whole point:

     blobs    compressed bytes. All 933 frames is ~85 MB, fine to hold, and
              this is what "is the chunk ready?" is answered from.
     bitmaps  DECODED pixels. A 1080p frame is ~8 MB decoded, so all 933 at
              once would be ~7.7 GB. Only a bounded window is kept alive, and
              evicted ones are explicitly .close()'d — dropping the reference
              is NOT enough, ImageBitmap holds memory outside the JS heap.

   Downloads are ordered by chunk priority, so the first playable transition
   arrives before anything else and the user never waits on frames they
   cannot reach yet.
   ========================================================================= */

import { CONFIG } from "./config";
import { CHUNKS, chunkPriority, frameUrl, type Chunk } from "./paths";

const TOTAL = CONFIG.sequence.frameCount;

export interface StoreStatus {
  loaded: number;
  total: number;
  failed: number[];
}

export class FrameStore {
  private blobs: (Blob | null)[] = new Array(TOTAL).fill(null);
  private bitmaps = new Map<number, ImageBitmap>();
  private fetching = new Set<number>();
  private decoding = new Set<number>();
  private attempts = new Int8Array(TOTAL);
  private failed = new Set<number>();

  private loadedCount = 0;
  private queue: number[] = [];
  private decodeWidth = 0;
  private anchor = 0; // playhead, for eviction distance
  private want: { from: number; dir: number } | null = null;
  private dead = false;

  constructor(
    private onStatus: (s: StoreStatus) => void,
    private onDecoded?: (frame: number) => void,
  ) {}

  /* ------------------------------------------------------------ downloads */

  /** Frame 0 first so something paints immediately, then chunk by chunk. */
  prioritise(stateIndex: number) {
    const order = chunkPriority(stateIndex, CONFIG.loading.preloadLookahead);
    const next: number[] = [];
    const seen = new Set<number>();
    const add = (f: number) => {
      if (f >= 0 && f < TOTAL && !seen.has(f) && !this.blobs[f] && !this.failed.has(f)) {
        seen.add(f);
        next.push(f);
      }
    };
    add(0);
    for (const ci of order) {
      const c = CHUNKS[ci];
      for (let f = c.start; f <= c.end; f++) add(f);
    }
    this.queue = next;
    this.pump();
  }

  private pump() {
    while (!this.dead && this.fetching.size < CONFIG.loading.concurrency) {
      const i = this.queue.shift();
      if (i === undefined) return;
      if (this.blobs[i] || this.fetching.has(i) || this.failed.has(i)) continue;
      this.fetchFrame(i);
    }
  }

  private fetchFrame(i: number) {
    this.fetching.add(i);
    fetch(frameUrl(i))
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((b) => {
        if (this.dead) return;
        this.blobs[i] = b;
        this.loadedCount++;
        this.emit();
      })
      .catch(() => {
        if (this.dead) return;
        /* 24. retry, then report — never crash the experience */
        this.attempts[i]++;
        if (this.attempts[i] < CONFIG.loading.retries) {
          const backoff = 200 * Math.pow(2, this.attempts[i] - 1);
          setTimeout(() => {
            if (!this.dead) {
              this.queue.unshift(i);
              this.pump();
            }
          }, backoff);
        } else {
          this.failed.add(i);
          console.warn(`[sequence] frame ${i} failed after ${CONFIG.loading.retries} attempts`);
          this.emit();
        }
      })
      .finally(() => {
        this.fetching.delete(i);
        if (!this.dead) this.pump();
      });
  }

  private emit() {
    this.onStatus({ loaded: this.loadedCount, total: TOTAL, failed: [...this.failed] });
  }

  /* ---------------------------------------------------------- readiness */

  /** 11. A transition never plays with missing frames. */
  isChunkReady(c: Chunk): boolean {
    for (let f = c.start; f <= c.end; f++) if (!this.blobs[f]) return false;
    return true;
  }

  chunkProgress(c: Chunk): number {
    let have = 0;
    for (let f = c.start; f <= c.end; f++) if (this.blobs[f]) have++;
    return have / (c.end - c.start + 1);
  }

  /** Pull a chunk to the very front of the queue — used when the user is
      waiting on it, so it stops being merely "next" and becomes urgent. */
  rush(c: Chunk) {
    const urgent: number[] = [];
    for (let f = c.start; f <= c.end; f++) {
      if (!this.blobs[f] && !this.fetching.has(f) && !this.failed.has(f)) urgent.push(f);
    }
    this.queue = [...urgent, ...this.queue.filter((f) => !urgent.includes(f))];
    this.pump();
  }

  hasFailedIn(c: Chunk): boolean {
    for (const f of this.failed) if (f >= c.start && f <= c.end) return true;
    return false;
  }

  /* ------------------------------------------------------------- decode */

  /** Kept for API compatibility. Frames are decoded at native size — see
      CONFIG.decode.resizeOnDecode for why — so the drawn width no longer
      changes how they are decoded, and a resize needs no cache flush. */
  setDecodeWidth(px: number) {
    this.decodeWidth = Math.round(px);
  }

  setAnchor(frame: number) {
    this.anchor = frame;
  }

  /** Declare where the playhead is and which way it is travelling. The decode
      queue is SELF-PUMPING from here: every completion starts the next one.

      This used to fan out one decode() per frame of the runway and rely on the
      rAF tick calling it again 60x/sec to make progress. Once a concurrency
      cap was added that combination stalled — it fired exactly `concurrency`
      decodes and nothing ever refilled the slots. Measured 3.9 decodes/sec
      against the ~60/sec playback needs. */
  warm(from: number, dir: number) {
    this.want = { from, dir: dir >= 0 ? 1 : -1 };
    this.pumpDecode();
  }

  private decodable(i: number) {
    return (
      i >= 0 && i < TOTAL && !this.bitmaps.has(i) && !this.decoding.has(i) && !!this.blobs[i]
    );
  }

  /** Nearest frame still needing a decode: along the runway first, then a few
      behind so a reversal is not instantly starved. */
  private nextToDecode(): number {
    if (!this.want) return -1;
    const { from, dir } = this.want;
    for (let k = 0; k <= CONFIG.decode.aheadFrames; k++) {
      const i = from + k * dir;
      if (this.decodable(i)) return i;
    }
    for (let k = 1; k <= 6; k++) {
      const i = from - k * dir;
      if (this.decodable(i)) return i;
    }
    return -1;
  }

  private pumpDecode() {
    while (!this.dead && this.decoding.size < CONFIG.decode.concurrency) {
      const i = this.nextToDecode();
      if (i < 0) return;
      this.decode(i);
    }
  }

  private decode(i: number) {
    const blob = this.blobs[i];
    if (!blob) return;

    this.decoding.add(i);
    /* Native size, deliberately — see CONFIG.decode.resizeOnDecode. */
    createImageBitmap(blob)
      .then((bm) => {
        if (this.dead) {
          bm.close();
          return;
        }
        this.bitmaps.set(i, bm);
        this.trim();
        /* Decoding is async and the rAF tick may be throttled (background
           tab, low-power mode). Announce it so the first frame can paint
           without waiting for a tick that might not come. */
        this.onDecoded?.(i);
      })
      .catch((e) => console.warn(`[sequence] decode ${i} failed`, e))
      .finally(() => {
        this.decoding.delete(i);
        if (!this.dead) this.pumpDecode();
      });
  }

  /** Evict whatever is furthest from the playhead — better than plain LRU
      when the user scrubs back and forth across the same stretch. */
  private trim() {
    while (this.bitmaps.size > CONFIG.decode.maxDecoded) {
      let worst = -1;
      let worstDist = -1;
      for (const k of this.bitmaps.keys()) {
        const d = Math.abs(k - this.anchor);
        if (d > worstDist) {
          worstDist = d;
          worst = k;
        }
      }
      if (worst < 0) break;
      this.bitmaps.get(worst)!.close();
      this.bitmaps.delete(worst);
    }
  }

  private clearBitmaps() {
    for (const bm of this.bitmaps.values()) bm.close();
    this.bitmaps.clear();
  }

  /** Exact frame if decoded, else the nearest decoded one, so playback
      degrades to a held frame rather than a blank canvas. */
  get(i: number): ImageBitmap | null {
    const exact = this.bitmaps.get(i);
    if (exact) return exact;
    for (let r = 1; r <= 60; r++) {
      const a = this.bitmaps.get(i - r);
      if (a) return a;
      const b = this.bitmaps.get(i + r);
      if (b) return b;
    }
    return null;
  }

  hasExact(i: number) {
    return this.bitmaps.has(i);
  }

  get decodedCount() {
    return this.bitmaps.size;
  }

  destroy() {
    this.dead = true;
    this.clearBitmaps();
    this.blobs.fill(null);
    this.queue = [];
  }
}
