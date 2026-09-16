"use client";

/* =========================================================================
   The React shell. It owns the canvas element and the lifecycle; all of the
   actual behaviour lives in src/lib/sequence/*.

   Status flows OUT of the controller into React state, but it is throttled
   to meaningful changes — the raw stream fires every frame, and re-rendering
   React at 60fps to update a debug readout would defeat the point.
   ========================================================================= */

import { useEffect, useRef, useState } from "react";
import { Controller, type Status } from "@/lib/sequence/controller";
import { attachWheel } from "@/lib/sequence/input/wheel";
import { attachTouch } from "@/lib/sequence/input/touch";
import { attachKeyboard } from "@/lib/sequence/input/keyboard";
import LoadingOverlay from "./LoadingOverlay";
import DebugPanel from "./DebugPanel";
import ProgressRail, { type RailHandle } from "./ProgressRail";
import SiteHeader from "./SiteHeader";

const INITIAL: Status = {
  state: 0,
  desired: 0,
  lastState: 0,
  frame: 0,
  targetFrame: 0,
  phase: "waiting",
  ready: false,
  bootProgress: 0,
  loaded: 0,
  total: 0,
  failed: [],
  decoded: 0,
  chunkReady: true,
};

export default function StepStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<RailHandle>(null);
  const [status, setStatus] = useState<Status>(INITIAL);
  const [debug, setDebug] = useState(false);
  /* mirrored into a ref so the status callback can read it without the main
     effect re-subscribing (and tearing down the controller) on every toggle */
  const debugRef = useRef(false);
  useEffect(() => {
    debugRef.current = debug;
  }, [debug]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;

    /* Throttle the status stream hard.

       The controller emits every frame, and the frame NUMBER changes every
       frame — so including it in the key re-rendered React 60x/sec during
       playback, for a value only the debug overlay ever reads. The key now
       ignores the frame; when the debug panel is open the frame is pushed at
       ~10 Hz instead, which is plenty to read. */
    let last = "";
    let lastDebugPush = 0;
    const controller = new Controller(canvas, (s) => {
      /* The rail follows the playhead on EVERY tick, above the throttle: it
         writes a CSS variable and a text node, not React state. */
      railRef.current?.update(s.frame);

      const key = `${s.state}|${s.phase}|${s.ready}|${Math.round(s.bootProgress * 100)}|${s.loaded}|${s.decoded}|${s.failed.length}`;
      const now = performance.now();
      const debugTick = debugRef.current && now - lastDebugPush > 100;
      if (key === last && !debugTick) return;
      last = key;
      if (debugTick) lastDebugPush = now;
      setStatus(s);
    });

    controller.start();

    /* Dev-only handle for console poking: SEQ.go(1), SEQ.advance(t), etc.
       Never attached in a production build. */
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { SEQ?: Controller }).SEQ = controller;
    }

    const go = (dir: number) => controller.go(dir);
    const detachWheel = attachWheel(window, go);
    const detachTouch = attachTouch(host, go);
    const detachKeys = attachKeyboard(go, () => setDebug((d) => !d));

    const onResize = () => controller.resize();
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      detachWheel();
      detachTouch();
      detachKeys();
      window.removeEventListener("resize", onResize);
      controller.destroy();
    };
  }, []);

  return (
    <div className="stage" ref={hostRef}>
      <canvas className="stageCanvas" ref={canvasRef} />

      {/* 18 + 19. the live chrome, over the frame */}
      <SiteHeader visible={status.ready} />
      <ProgressRail visible={status.ready} ref={railRef} />

      <LoadingOverlay
        visible={!status.ready}
        percent={Math.round(status.bootProgress * 100)}
      />

      {/* 12. a tiny indicator only when a LATER transition is waiting on frames */}
      {status.ready && status.phase === "waiting" && <div className="bufferPill">Buffering</div>}

      {debug && <DebugPanel status={status} />}
    </div>
  );
}
