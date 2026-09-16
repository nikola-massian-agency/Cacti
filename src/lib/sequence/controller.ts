/* =========================================================================
   7. STATE NAVIGATION — the state machine and the input lock.

   One gesture = one transition = one state. Scroll position is NEVER mapped
   to a frame. The controller owns:

     - which state we are resting on
     - whether input is locked (playing, cooling down, or waiting on frames)
     - the rAF loop that drives playback
   ========================================================================= */

import { CONFIG, LAST_STATE } from "./config";
import { chunkBetween, CHUNKS } from "./paths";
import { FrameStore, type StoreStatus } from "./frameStore";
import { Renderer } from "./renderer";
import { Transition } from "./transition";

export type Phase = "idle" | "playing" | "waiting" | "cooldown";

export interface Status {
  state: number;
  /** 20. the state the run is heading for; equals `state` at rest */
  desired: number;
  lastState: number;
  frame: number;
  targetFrame: number;
  phase: Phase;
  /** the initial playable chunk is downloaded and the first gesture is armed */
  ready: boolean;
  /** 0..1 progress of the initial chunk, for the loading UI */
  bootProgress: number;
  loaded: number;
  total: number;
  failed: number[];
  decoded: number;
  chunkReady: boolean;
}

export class Controller {
  private store: FrameStore;
  private renderer: Renderer;
  private raf = 0;

  private state = 0;
  private phase: Phase = "waiting";
  private transition: Transition | null = null;
  private transitionTarget = 0;
  /** 20. the state the user has asked for; `state` converges toward it, one
      transition at a time. Every gesture moves this, never `state`. */
  private desired = 0;
  /** true while a run covers more than one state, so its last leg knows not
      to play at full length */
  private chained = false;
  private lastDir = 1; // direction of travel, for decode look-ahead
  private cooldownUntil = 0;
  private frame = 0;
  private ready = false;
  private storeStatus: StoreStatus = { loaded: 0, total: CONFIG.sequence.frameCount, failed: [] };
  private dead = false;

  constructor(
    canvas: HTMLCanvasElement,
    private onStatus: (s: Status) => void,
  ) {
    this.renderer = new Renderer(canvas);
    this.store = new FrameStore(
      (s) => {
        this.storeStatus = s;
        /* a newly arrived blob may be the frame we are sitting on */
        this.store.warm(this.frame, this.lastDir);
        this.checkBoot();
        this.emit();
      },
      (frame) => {
        /* paint the resting frame the moment it decodes */
        if (this.phase !== "playing" && frame === this.frame) {
          const bm = this.store.get(frame);
          if (bm) this.renderer.draw(bm);
        }
      },
    );
  }

  start() {
    this.resize();
    this.store.prioritise(this.state);
    this.store.setAnchor(0);
    this.store.warm(0, 1);
    this.loop();
  }

  /* ------------------------------------------------------------ lifecycle */

  private loop = () => {
    if (this.dead) return;
    const now = performance.now();

    try {
      this.advance(now);
    } catch (e) {
      /* 24. never get stuck with the input locked because of an exception */
      console.error("[sequence] tick failed — releasing the lock", e);
      this.transition = null;
      this.phase = "idle";
    }

    this.raf = requestAnimationFrame(this.loop);
  };

  /** One step of the state machine at an explicit timestamp. Called by the
      rAF loop; public so it can be driven deterministically in a test. */
  advance(now: number) {
    /* a run that was waiting on its chunk */
    if (this.phase === "waiting" && this.ready && this.desired !== this.state) {
      const dir = Math.sign(this.desired - this.state);
      if (this.canPlay(this.state + dir)) this.begin(dir, now);
    }

    if (this.phase === "cooldown" && now >= this.cooldownUntil) {
      this.phase = "idle";
      this.emit();
    }

    if (this.phase === "playing" && this.transition) {
      const t = this.transition;
      const f = t.frameAt(now);
      this.frame = f;
      this.store.setAnchor(f);
      this.store.warm(f, t.dir);

      const bm = this.store.get(f);
      if (bm) this.renderer.draw(bm);

      if (t.isDone(now)) {
        /* land exactly on the resting frame, never one short */
        this.frame = t.to;
        const end = this.store.get(t.to);
        if (end) this.renderer.draw(end);
        this.state = this.transitionTarget;
        this.transition = null;
        /* re-prioritise downloads around where we now are */
        this.store.prioritise(this.state);
        /* 20. a backlog runs straight on, with no cooldown in between: that
           is what makes a spun wheel one continuous run rather than a queue
           of separate playbacks. */
        if (this.desired !== this.state) {
          this.next(now);
        } else {
          this.chained = false;
          this.phase = "cooldown";
          this.cooldownUntil = now + CONFIG.input.cooldownMs;
        }
      }
      this.emit();
      return;
    }

    /* Idle/waiting/cooldown: keep the resting frame decoded and on screen,
       and keep a runway warm in the direction we last travelled so the next
       transition starts without a decode stall. */
    this.store.setAnchor(this.frame);
    this.store.warm(this.frame, this.lastDir);
    const bm = this.store.get(this.frame);
    if (bm) this.renderer.draw(bm);
  }

  /* --------------------------------------------------------- navigation */

  /** 8/9/10. Every input path funnels through here.

      20. A gesture arriving mid-transition is no longer discarded. It moves
      `desired`, and the run collects it when the current leg lands — so input
      is never swallowed, and never queued as another full playback either. */
  go(dir: number) {
    if (this.dead || !this.ready) return;

    /* 14. no wrapping at either end */
    const desired = Math.max(0, Math.min(LAST_STATE, this.desired + dir));
    if (desired === this.desired) return;
    this.desired = desired;

    if (Math.abs(this.desired - this.state) > 1) this.chained = true;

    if (this.phase === "playing" && this.transition) {
      /* 20. shorten the leg ALREADY RUNNING. Without this the first gesture
         of a burst plays out at full length — the backlog only exists from
         the second one on — so a spun wheel would stall for a beat before it
         started moving quickly. Never lengthens: slowing down mid-leg because
         the user stopped pushing would read as a stall. */
      const shorter = this.stepDuration(this.state, this.transitionTarget);
      if (shorter < this.transition.duration) {
        this.transition.rescale(performance.now(), shorter);
      }
    } else if (this.phase === "idle" || this.phase === "cooldown") {
      this.next(performance.now());
    }
    this.emit();
  }

  /** Start the next leg toward `desired`, or wait for its frames. */
  private next(now: number) {
    const dir = Math.sign(this.desired - this.state);
    if (dir === 0) return;
    if (this.canPlay(this.state + dir)) {
      this.begin(dir, now);
    } else {
      /* 11. never play a transition with missing frames */
      this.phase = "waiting";
      this.store.rush(chunkBetween(this.state, this.state + dir));
      this.emit();
    }
  }

  /** 20. How long one leg of the run should take.

      A lone gesture plays the authored duration. With more states still to
      cover the leg shortens, compounding, down to a floor; and the last leg
      of a run that WAS chained stays short too, so a fast run does not end by
      decelerating into a full-length transition. */
  private stepDuration(from: number, to: number) {
    const base = CONFIG.transitionDurations[Math.min(from, to)];
    const { chainSpeedUp, chainMinDurationMs, chainTailFactor } = CONFIG.input;
    const remaining = Math.abs(this.desired - from);
    const scaled =
      remaining > 1
        ? base * Math.pow(chainSpeedUp, remaining - 1)
        : this.chained
          ? base * chainTailFactor
          : base;
    return Math.max(chainMinDurationMs, Math.min(base, scaled));
  }

  private canPlay(target: number): boolean {
    if (target < 0 || target > LAST_STATE) return false;
    return this.store.isChunkReady(chunkBetween(this.state, target));
  }

  private begin(dir: number, now: number) {
    const target = this.state + dir;
    const from = CONFIG.stateFrames[this.state];
    const to = CONFIG.stateFrames[target];
    if (Math.abs(this.desired - this.state) > 1) this.chained = true;
    const duration = this.stepDuration(this.state, target);

    const t = new Transition(from, to, duration);
    t.start(now);
    this.transition = t;
    this.transitionTarget = target;
    this.lastDir = t.dir;
    this.phase = "playing";
    this.store.warm(from, t.dir);
    this.emit();
  }

  /* -------------------------------------------------------------- boot */

  /** Enable the first gesture as soon as CHUNK 1 is playable — not when all
      933 frames are in. */
  private checkBoot() {
    if (this.ready) return;
    if (this.store.isChunkReady(CHUNKS[0])) {
      this.ready = true;
      if (this.phase === "waiting" && this.desired === this.state) this.phase = "idle";
    }
  }

  private get bootProgress() {
    return this.store.chunkProgress(CHUNKS[0]);
  }

  /* ------------------------------------------------------------- output */

  resize() {
    const backingWidth = this.renderer.resize();
    if (backingWidth) this.store.setDecodeWidth(backingWidth);
    this.renderer.invalidate();
  }

  private emit() {
    const target = this.transition ? this.transition.to : CONFIG.stateFrames[this.state];
    this.onStatus({
      state: this.state,
      desired: this.desired,
      lastState: LAST_STATE,
      frame: this.frame,
      targetFrame: target,
      phase: this.phase,
      ready: this.ready,
      bootProgress: this.bootProgress,
      loaded: this.storeStatus.loaded,
      total: this.storeStatus.total,
      failed: this.storeStatus.failed,
      decoded: this.store.decodedCount,
      chunkReady: this.phase !== "waiting",
    });
  }

  destroy() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    this.store.destroy();
  }
}
