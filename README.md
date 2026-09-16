# CACTI — stepped scroll-state sequence prototype

One deliberate scroll gesture = one automatic transition between predefined
frames. **Scroll position is never mapped to frame number.**

```
STATE 0 ──2.5s──▶ 1 ──2.0s──▶ 2 ──2.5s──▶ 3 ──2.2s──▶ 4 ──2.5s──▶ 5
frame 0        200        350        575        750        932
```

Next.js 16 (App Router) + React 19 + TypeScript. React renders the shell once;
all playback is plain TypeScript writing to a canvas.

```bash
npm run dev      # http://localhost:3000
npm run build
npm run lint
npx tsc --noEmit
```

Controls: **scroll / swipe / ArrowDown / ArrowUp / Space**. **D** toggles the
debug overlay. In dev, `window.SEQ` exposes the controller for console poking
(`SEQ.go(1)`, `SEQ.advance(t)`, `SEQ.state`, `SEQ.frame`).

---

## What was found in the sequence

Verified numerically, not alphabetically, and not assumed:

| | |
|---|---|
| Source folder | `frames2` — the **no-UI** export |
| Naming | `MAIN widerNoUI_00000.webp` … `_00932.webp` (prefix + 5-digit zero pad) |
| First / last | `0` / `932` |
| Numbering starts at | **0** |
| File count | **933** — contiguous, no gaps |
| Canvas | **2400 × 1700**, lossy WebP, opaque (no alpha) |
| Safe area | **1920 × 1080** inset at **(240, 310)** |
| Total size | 72 MB (~78 KB average per frame) |

The intended final frame 932 **is** the highest existing frame, so the state
list needed no adaptation.

**Where the sequence lives:** `public/assets/frames2/`. Copied in with the
**space in the filename replaced by an underscore** (`MAIN_widerNoUI_…`) — a
space in a URL path is legal but a needless footgun. The images themselves are
untouched. Gitignored (72 MB is not source), so re-copy after a fresh clone.

To swap in another sequence, drop it in and edit `CONFIG.sequence`
(`dir`, `prefix`, `pad`, `ext`, `frameCount`, `firstFrame`, `source`,
`safeArea`).

---

## Fitting the frame to the screen

Each frame is a 2400×1700 canvas with the composition inset at **(240, 310)**
at **1920×1080**. The magenta surround is deliberate **bleed** — it marks the
area that must always be seen, and exists to be sacrificed so the composition
is not. The designer will replace the magenta with real artwork; **nothing in
the code changes when they do.**

Two scales compete:

| | |
|---|---|
| `scaleCover` | smallest scale that fills the viewport — wants **large** |
| `scaleSafe` | largest scale that keeps the composition whole — wants **small** |

Between aspect **1.13 and 2.22** they do not conflict: the bleed is wide enough
that filling the screen never reaches the composition. They only diverge on a
tall phone or an ultrawide.

### `CONFIG.render.fit`

Two rules drive the defaults:

1. **The composition is never cropped.** Not by a pixel.
2. **No black anywhere**, and gaps are closed by stretching the **whole frame**
   — never by smearing the edge pixels outward.

| mode | behaviour |
|---|---|
| **`"safe-fill"`** (default) | Fit the composition so it is **entirely** visible and as large as it can be; the bleed covers what is left. |
| `"safe-cover"` | Scale until the *composition* covers the screen. Fills with picture and shows no bleed, but **crops the composition** to reshape 16:9 into the window. |
| `"cover"` | Uniform scale of the whole 2400×1700 frame. Crops bleed first, composition only past `maxSafeCrop`. |
| `"safe"` | Never crop; letterbox once the bleed runs out. |
| `"stretch"` | Scale x and y independently to fill exactly. Distorts ~26% at 16:9. |

| knob | default | why |
|---|---|---|
| `maxSafeCrop` | **`0`** | the composition is never cut. Raise only if you decide a crop is acceptable |
| `edgeFill` | **`"stretch"`** | close leftover strips by stretching the **whole frame**. `"extend"` smears only the outermost pixels — which are bleed — and reads as "the magenta is being stretched" |
| `maxStretchX` | `1.6` | covers to 32:9 without a side bar |
| `maxStretchY` | `1.5` | covers tablet portrait. A phone portrait would need ~145%, which is not worth it |

Measured on the real renderer:

| viewport | composition kept | L/R bars | T/B bars | stretch |
|---|---|---|---|---|
| 1920×1080 · 16:9 | **100%** | 0 | 0 | **0%** |
| 1440×900 · 16:10 | **100%** | 0 | 0 | **0%** |
| 1024×768 · 4:3 | **100%** | 0 | 0 | **0%** |
| 844×390 · phone landscape | **100%** | 0 | 0 | **0%** |
| 2560×1080 · 21:9 | **100%** | 0 | 0 | 7% |
| 3440×1440 · 34" ultrawide | **100%** | 0 | 0 | 8% |
| 5120×1440 · 32:9 | **100%** | 0 | 0 | 60% |
| 768×1024 · tablet portrait | **100%** | 0 | 4px | 33% |
| 390×844 · phone portrait | **100%** | 0 | 326px | 33% |

**The composition survives whole at every shape**, and every landscape window
fills with no bars. 4:3 through phone-landscape need **no stretch at all** —
the bleed alone covers them. Only a portrait phone keeps a top/bottom band,
because closing it would need ~145% vertical stretch.

If 60% at 32:9 is too much, lower `maxStretchX` to ~1.1: the distortion
becomes imperceptible and the bleed covers the remainder instead.

### How much bleed is needed — for the designer

The canvas size decides which viewports the bleed can fill without touching the
composition. Derived from the geometry and confirmed against the renderer:

```
widest  aspect fully covered = canvasWidth / safeHeight  = 2400/1080 = 2.222
tallest aspect fully covered = safeWidth   / canvasHeight = 1920/1700 = 1.129
```

To extend that: 21:9 (2.37) would need a canvas **≥2560 wide** — only 160px
more. **Phone portrait would need ~4174px of height**, which is not realistic:
that should be a separately framed render, not more bleed.

---

## Folder structure

```
src/
├── app/
│   ├── layout.tsx            black page, no chrome
│   ├── page.tsx              renders <StepStage />
│   └── globals.css           full-viewport canvas, loader, debug panel
├── components/
│   ├── StepStage.tsx         React shell: canvas + lifecycle + input wiring
│   ├── LoadingOverlay.tsx    12. LOADING nn%
│   └── DebugPanel.tsx        17. debug overlay (D)
└── lib/sequence/
    ├── config.ts             1 + 19. ALL tunable values
    ├── easing.ts             7.  easing registry
    ├── paths.ts              2.  frame URLs + chunk maths
    ├── frameStore.ts         3 + 4 + 10. loading, caching, chunks, memory
    ├── renderer.ts           5.  canvas, cover-fit, DPR cap
    ├── transition.ts         6.  time-based playback
    ├── controller.ts         7.  state machine + input lock
    └── input/
        ├── wheel.ts          8.  trackpad-momentum-proof wheel gestures
        ├── touch.ts          9.  one swipe = one state
        └── keyboard.ts       10 + 16. arrows / space / D
```

---

## The configurable values (`src/lib/sequence/config.ts`)

| key | default | what it does |
|---|---|---|
| `stateFrames` | `[0,200,350,575,750,932]` | the resting frames. Everything else derives from this — chunks, transitions, the debug readout |
| `transitionDurations` | `[2500,2000,2500,2200,2500]` | ms per transition, same in reverse. Needs `stateFrames.length - 1` entries |
| `easing` | `'cinematic'` | name from `easing.ts` |
| `input.wheelThreshold` | `55` | accumulated normalised wheel delta to fire one gesture |
| `input.gestureGapMs` | `140` | **the anti-momentum value.** Wheel silence needed before the input re-arms. Raise if a trackpad still double-fires |
| `input.cooldownMs` | `250` | extra lock after a transition lands |
| `input.swipeThreshold` | `60` | px of finger travel to fire |
| `loading.concurrency` | `10` | parallel frame downloads |
| `loading.preloadLookahead` | `1` | chunks fetched beyond the current one |
| `loading.retries` | `3` | attempts per frame before it is reported failed |
| `decode.maxDecoded` | `90` | decoded frames kept alive — **the real memory limit** |
| `decode.aheadFrames` | `45` | decode runway in the direction of travel |
| `render.maxDPR` | `2` | caps the backing store on hi-DPI screens |

`easing.cinematic` is `easeInOutCubic` blended 65/35 with linear — it keeps the
cinematic settle without the sequence visibly hanging on a frame at either end.

---

## How the important parts work

**Input locking.** Accumulated wheel delta past the threshold fires exactly one
transition and then *disarms* the input. It re-arms only after `gestureGapMs`
of complete wheel silence. Trackpad momentum events keep resetting that silence
timer, so a momentum tail can never re-arm it — the user has to physically stop
and start a new gesture. Touch uses a fired-once-per-touch flag; keyboard
ignores auto-repeat. Every input path funnels through the same `go(dir)`.

**Playback is time-based, not frame-based.** The displayed frame is
`from + (to - from) * ease(elapsed / duration)`, so a 2.5s transition takes 2.5s
on a 60 Hz and a 144 Hz screen alike — only the number of distinct frames shown
differs. Every intermediate frame is real image data; nothing is crossfaded.

**Two-layer memory model.** Compressed blobs live in `frameStore`; decoded
pixels live behind a bounded map with explicit `ImageBitmap.close()`. This
matters: a 1080p frame is ~8 MB decoded, so 933 of them would be **~7.7 GB**.
Eviction drops whatever is furthest from the playhead, which beats plain LRU
when navigating back and forth. Decoding happens at the *display* size, so a
smaller window costs less RAM.

**Progressive loading.** Frame 0 is fetched first, then chunk 1 (frames 0–200).
The first gesture is enabled the moment that chunk is playable — **not** when
all 933 frames are in. Chunks are derived from `stateFrames`, so they always
match what a transition actually needs. Background preloading then works
outward by chunk priority: next transition, previous transition (for reverse),
then look-ahead, then the rest.

**Gating.** A transition never starts with missing frames. If its chunk is not
ready the input stays locked, that chunk is rushed to the front of the queue, a
small `BUFFERING` pill appears, and the transition fires the moment the range
completes. Failed frames are retried with exponential backoff and then reported
in the console and the debug panel.

---

## Verified

Driven against the real 933-frame sequence in the browser:

- One aggressive synthetic trackpad flick (**25 rapid wheel events + a
  20-event decaying momentum tail**) produced **exactly** `0 → 200` — never
  `0 → 200 → 350`.
- Five gestures fired during a single transition advanced **one** state
  (`0 → 1`) and landed **exactly** on frame 200.
- Full walk forward `0→200→350→575→750→932` and back `→750→575→350→200→0`,
  landing exactly on every resting frame.
- **No wrapping**: further input at 932 stays at 932; at 0 stays at 0.
- Mid-transition frame at 600 ms of a 2500 ms move = frame 25 (correct easing).
- Page cannot scroll (`document.scrollHeight === innerHeight`).
- Loader hides at 100% of chunk 1; 933/933 loaded, 0 failed, no console errors.

---

## Why it was choppy, and what fixed it

Three separate causes, each measured:

**1. `resizeWidth` is ~5x slower than decoding at native size.** Asking
`createImageBitmap(blob, { resizeWidth })` to downscale during decode measured
**15 decodes/sec**; decoding native measured **113/sec**. Playback needs ~60/sec
at 60 Hz, so the resize path alone could not keep up. It was there to save
memory and was costing far more than it saved. Frames are now decoded at native
size and `drawImage` scales them on the GPU, which is effectively free.

**2. The decode queue stalled after `concurrency` frames.** It fanned out one
`decode()` per frame of the runway and relied on the rAF tick calling it again
60x/sec to progress. Adding a concurrency cap broke that: it filled 6 slots and
nothing refilled them. **3.9 decodes/sec.** The queue is now self-pumping —
every completion starts the next — which measured **87.7/sec**.

**3. React re-rendered on every frame.** The status throttle key included the
frame number, which changes every frame, so the whole component tree
re-rendered 60x/sec for a value only the debug overlay reads. The key now
ignores the frame; with the debug panel open it is pushed at ~10 Hz instead.

### Headroom

| | decodes/sec |
|---|---|
| needed at 60 Hz | ~60 |
| measured now (6 parallel, native size) | **87.7** |
| raw capability (8 parallel, idle) | ~113 |

That is ~1.5x headroom on a fast machine, measured while otherwise idle. Real
playback also does `drawImage` and keeps downloading, so the margin is thinner
than it looks. **Halving the source resolution is the cheapest way to widen it**
— see below.

### Source resolution is the biggest remaining lever

Measured on these frames, re-encoded in-browser:

| source | megapixels | decodes/sec | decoded size | 36-frame cache | file size |
|---|---|---|---|---|---|
| 2400×1700 (current) | 4.08 | 113 | 16.3 MB | **560 MB** | ~58 KB |
| 1920×1360 | 2.61 | ~160 | 10.4 MB | 376 MB | ~45 KB |
| 1600×1133 | 1.81 | 230 | 7.3 MB | 261 MB | ~39 KB |
| 1280×907 | 1.16 | 332 | 4.9 MB | 176 MB | ~31 KB |

The frames are drawn at roughly the viewport width — 1920 on a 1080p monitor —
so 1920×1360 is sharp for most screens while cutting decode cost ~40%, memory
~33% and bandwidth ~22%. It is a build step on our side; the delivered files do
not change.

---

## Performance limitations worth knowing

1. **Decoded memory is the real constraint, not the 85 MB download.** At 1080p
   a decoded frame is ~8 MB. `maxDecoded: 90` is a desktop-class budget —
   lower it for mobile, or ship a smaller frame set.
2. **A hidden tab pauses `requestAnimationFrame`**, so a transition started
   just before the tab is hidden will not progress until it is visible again,
   then completes immediately. Correct behaviour, but it does mean the input
   stays locked while hidden.
3. **Decode throughput sets the ceiling on smoothness.** A 2.5 s / 200-frame
   transition is 80 fps of source material; a 60 Hz display shows ~150 of
   those frames. If decoding falls behind, the renderer holds the nearest
   decoded frame rather than blanking — smooth degradation, but visible as a
   slight stutter on a very large window. Lower the decode width or
   `aheadFrames` if that appears.
4. **72 MB total.** At spike traffic that is the dominant cost. The chunked
   loader means a visitor who never passes state 1 only pulls chunk 1, but a
   visitor who walks the whole sequence pulls all of it.
5. **Phone portrait runs out of bleed.** At 0.46 aspect the safe area is kept
   whole, so the frame letterboxes against black. Either accept it, or ask for
   more vertical bleed in a future export.
6. **These frames carry no UI**, so the nav, headlines and buttons now have to
   be live HTML on top — that work is not in this prototype.
